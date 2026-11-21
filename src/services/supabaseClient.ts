import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { deleteSetting, getSetting, setSetting } from '../db/db';
import type { CommunitySessionInfo } from '../domain/communityTypes';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

/** 单文件比赛版：file:// 或单文件构建，社区只做优雅降级。 */
export const isSingleFileDemo =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' ||
    (import.meta.env as Record<string, string | undefined>).VITE_SINGLE_FILE === 'true');

export const SINGLE_FILE_COMMUNITY_MESSAGE = '当前为单机演示版，社区题库功能暂不可用';

/** 缺少环境变量时，社区模块整体降级；主线完全不依赖它。 */
export const communityConfigured = Boolean(url && anonKey);

/**
 * 会话写入 IndexedDB（而非 localStorage），与“数据只在本机 IndexedDB”保持一致。
 * Supabase 的 SupportedStorage 允许返回 Promise。
 */
const indexedDbStorage = {
  async getItem(key: string): Promise<string | null> {
    return (await getSetting<string>(`sb:${key}`)) ?? null;
  },
  async setItem(key: string, value: string): Promise<void> {
    await setSetting(`sb:${key}`, value);
  },
  async removeItem(key: string): Promise<void> {
    await deleteSetting(`sb:${key}`);
  },
};

let client: SupabaseClient | null = null;

/** 普通请求超时，避免不可达时页面一直停在“载入中”。 */
const REQUEST_TIMEOUT_MS = 5000;

/** 试卷最大 10MB，慢网下上传要留足时间；普通 REST 请求仍用 5 秒。 */
const UPLOAD_TIMEOUT_MS = 120000;

const timeoutFetch: typeof fetch = (input, init) => {
  const isUpload =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  );
  const signal = init?.signal ?? controller.signal;
  return fetch(input, { ...init, signal }).finally(() => window.clearTimeout(timer));
};

function withTimeout<T>(task: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new CommunityUnavailableError(message, 'network')), ms);
    task.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function getCommunityClient(): SupabaseClient | null {
  if (!communityConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        storage: indexedDbStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'gaoshu-quest' },
        fetch: timeoutFetch,
      },
    });
  }
  return client;
}

export type CommunityUnavailableReason = 'unconfigured' | 'auth' | 'network' | 'server';

export class CommunityUnavailableError extends Error {
  readonly reason: CommunityUnavailableReason;

  constructor(message: string, reason: CommunityUnavailableReason) {
    super(message);
    this.name = 'CommunityUnavailableError';
    this.reason = reason;
  }
}

function looksOffline(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    (typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      /fetch|network|failed to fetch|load failed|offline/i.test(String((error as Error).message)))
  );
}

/** 无会话则静默匿名登录；失败抛 CommunityUnavailableError，由页面降级。 */
async function ensureCommunitySessionInner(): Promise<CommunitySessionInfo> {
  const sb = getCommunityClient();
  if (!sb) {
    throw new CommunityUnavailableError(
      '未配置 Supabase：缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY',
      'unconfigured',
    );
  }

  const { data: existing, error: sessionError } = await sb.auth.getSession();
  if (sessionError) {
    throw new CommunityUnavailableError(`读取登录状态失败：${sessionError.message}`, 'auth');
  }

  let session = existing.session;
  if (!session) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
      const message = /anonymous|disabled/i.test(error.message)
        ? 'Supabase 未开启匿名登录（Dashboard → Authentication → Providers → Anonymous Sign-Ins）'
        : error.message;
      throw new CommunityUnavailableError(`匿名登录失败：${message}`, 'auth');
    }
    session = data.session;
  }

  const user = session?.user;
  if (!user) {
    throw new CommunityUnavailableError('匿名登录没有返回用户信息', 'auth');
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    isAnonymous: user.is_anonymous !== false,
  };
}

/** 对匿名登录/会话恢复加超时：网络不可达时快速降级，而不是卡住社区页。 */
export function ensureCommunitySession(): Promise<CommunitySessionInfo> {
  if (isSingleFileDemo) {
    return Promise.reject(
      new CommunityUnavailableError(SINGLE_FILE_COMMUNITY_MESSAGE, 'network'),
    );
  }
  return withTimeout(
    ensureCommunitySessionInner(),
    9000,
    '连接 Supabase 超时，社区功能暂不可用（已缓存题目仍可浏览）',
  );
}

/**
 * 取当前 Supabase 会话的 access token，供同源 /api/chat 校验用户。
 * 没有会话时先静默匿名登录；单文件版或未配置 Supabase 时抛错，由 AI 弹窗展示。
 */
export async function getCommunityAccessToken(): Promise<string> {
  if (isSingleFileDemo) {
    throw new CommunityUnavailableError(
      'AI 助教需要在线版并启用 Supabase 匿名登录',
      'network',
    );
  }

  const sb = getCommunityClient();
  if (!sb) {
    throw new CommunityUnavailableError(
      '未配置 Supabase，AI 助教暂不可用',
      'unconfigured',
    );
  }

  try {
    // 必须显式拿 session；不能只看是否有 user。
    const { data, error } = await sb.auth.getSession();
    if (error) {
      throw new CommunityUnavailableError(`读取登录状态失败：${error.message}`, 'auth');
    }

    let session = data.session;

    if (!session) {
      const { data: signInData, error: signInError } = await sb.auth.signInAnonymously();
      if (signInError || !signInData.session) {
        throw new CommunityUnavailableError(
          signInError ? `匿名登录失败：${signInError.message}` : '匿名登录没有返回会话',
          'auth',
        );
      }
      session = signInData.session;
    } else if (
      typeof session.expires_at === 'number' &&
      session.expires_at * 1000 <= Date.now() + 30_000
    ) {
      // 会话存在但已过期/即将过期：先刷新，避免把过期 JWT 送到 /api/chat。
      const { data: refreshed, error: refreshError } = await sb.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new CommunityUnavailableError(
          refreshError ? `登录状态刷新失败：${refreshError.message}` : '登录状态刷新失败',
          'auth',
        );
      }
      session = refreshed.session;
    }

    const token = session.access_token.trim().replace(/^Bearer\s+/i, '');
    if (!token) {
      throw new CommunityUnavailableError('当前登录状态没有可用凭证，请刷新页面后重试', 'auth');
    }
    return token;
  } catch (error) {
    if (error instanceof CommunityUnavailableError) throw error;
    throw new CommunityUnavailableError(
      error instanceof Error ? error.message : '读取登录状态失败，请刷新页面后重试',
      'auth',
    );
  }
}

export async function refreshCommunityUser(): Promise<CommunitySessionInfo> {
  const sb = getCommunityClient();
  if (!sb) {
    throw new CommunityUnavailableError('未配置 Supabase，社区功能暂不可用', 'unconfigured');
  }
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    throw new CommunityUnavailableError(
      error ? `读取用户失败：${error.message}` : '当前没有登录用户',
      'auth',
    );
  }
  return {
    userId: data.user.id,
    email: data.user.email ?? null,
    isAnonymous: data.user.is_anonymous !== false,
  };
}

export function describeCommunityError(error: unknown): string {
  if (error instanceof CommunityUnavailableError) return error.message;
  if (looksOffline(error)) return '网络不可用：已切换到离线缓存';
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return '社区服务暂时不可用';
}

export function isOfflineError(error: unknown): boolean {
  return looksOffline(error);
}
