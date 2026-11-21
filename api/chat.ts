import { createClient } from '@supabase/supabase-js';

declare const process: { env: Record<string, string | undefined> };

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status(code: number): ApiResponse;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
};

type ChatResult = {
  status: number;
  body: Record<string, unknown>;
};

const DEFAULT_DAILY_LIMIT = 10;
const MAX_PROMPT_LENGTH = 8000;
const AUTH_TIMEOUT_MS = 5_000;
const MODEL_TIMEOUT_MS = 40_000;

function pickEnv(env: Record<string, string | undefined>, ...names: string[]): string {
  for (const name of names) {
    const raw = env[name]?.trim();
    if (!raw) continue;
    // 环境变量面板复制时偶尔会连引号一起粘进来，去掉首尾引号再使用。
    return raw.replace(/^["']|["']$/g, '').trim();
  }
  return '';
}

function headerValue(
  headers: ApiRequest['headers'],
  name: string,
): string {
  if (!headers) return '';
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return direct[0] ?? '';
  if (typeof direct === 'string') return direct;

  // Node/Vercel 通常会把 header 名转小写，但代理或测试环境可能保留 Authorization 原样。
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) continue;
    if (Array.isArray(value)) return value[0] ?? '';
    if (typeof value === 'string') return value;
  }
  return '';
}

/** 从 Authorization 中取纯 JWT：兼容大小写、多个空格和数组 header。 */
function readBearer(headers: ApiRequest['headers']): string {
  const authHeader = headerValue(headers, 'authorization').trim();
  if (!authHeader) return '';
  const parts = authHeader.split(/\s+/);
  // 必须是标准的 "Bearer <token>"，不能把 Bearer 前缀一起送到 Supabase。
  if (parts.length < 2 || parts[0].toLowerCase() !== 'bearer') return '';
  return parts.slice(1).join(' ').trim();
}

function jwtIssuer(token: string): string {
  try {
    const segment = token.split('.')[1] ?? '';
    if (!segment) return '';
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(
      Math.ceil(segment.length / 4) * 4,
      '=',
    );
    const payload = JSON.parse(atob(padded)) as { iss?: unknown };
    return typeof payload.iss === 'string' ? payload.iss : '';
  } catch {
    return '';
  }
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function fail(status: number, error: string, code: string, extra: Record<string, unknown> = {}): ChatResult {
  return { status, body: { error, code, ...extra } };
}

function readPrompt(body: unknown): string | null {
  let parsed = body;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const prompt = (parsed as { prompt?: unknown }).prompt;
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.trim();
  if (!trimmed || trimmed.length > MAX_PROMPT_LENGTH) return null;
  return trimmed;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function parseLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAILY_LIMIT;
  return Math.min(Math.max(parsed, 1), 100);
}

type SupabaseQuotaRow = {
  allowed?: unknown;
  used?: unknown;
  remaining?: unknown;
};

/**
 * Vercel Function 的核心逻辑：校验 Supabase 匿名会话 -> 扣每日额度 -> 调大模型。
 * AI_API_KEY / SUPABASE_SERVICE_ROLE_KEY 只在服务器端读取，绝不进入前端构建。
 */
export async function handleChat(
  request: ApiRequest,
  env: Record<string, string | undefined> = process.env,
): Promise<ChatResult> {
  const method = (request.method ?? 'GET').toUpperCase();
  if (method !== 'POST') return fail(405, '只支持 POST 请求', 'method');

  const prompt = readPrompt(request.body);
  if (!prompt) return fail(400, `prompt 必须是 1-${MAX_PROMPT_LENGTH} 字的字符串`, 'bad-request');

  const bearer = readBearer(request.headers);
  if (!bearer) return fail(401, '请先登录后再使用 AI 助教', 'auth');

  const supabaseUrl = pickEnv(env, 'SUPABASE_URL', 'VITE_SUPABASE_URL');
  const supabaseAnonKey = pickEnv(env, 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY');
  const serviceRoleKey = pickEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  const aiKey = pickEnv(env, 'AI_API_KEY');
  const urlSource = pickEnv(env, 'SUPABASE_URL') ? 'SUPABASE_URL' : 'VITE_SUPABASE_URL';
  const anonKeySource = pickEnv(env, 'SUPABASE_ANON_KEY')
    ? 'SUPABASE_ANON_KEY'
    : 'VITE_SUPABASE_ANON_KEY';

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey || !aiKey) {
    const missing = [
      !supabaseUrl ? 'SUPABASE_URL/VITE_SUPABASE_URL' : '',
      !supabaseAnonKey ? 'SUPABASE_ANON_KEY/VITE_SUPABASE_ANON_KEY' : '',
      !serviceRoleKey ? 'SUPABASE_SERVICE_ROLE_KEY' : '',
      !aiKey ? 'AI_API_KEY' : '',
    ].filter(Boolean);
    console.error(`[api/chat] 缺少服务端环境变量: ${missing.join(', ')}`);
    return fail(503, `AI 服务未配置，缺少：${missing.join(', ')}`, 'server-config');
  }

  let userId = '';
  try {
    // 用 anon key 初始化 Auth 客户端，再用用户自己的 JWT 校验；
    // 这里绝不能把 service_role 当作“跳过鉴权”的捷径。
    const authClient = createClient(supabaseUrl.replace(/\/+$/, ''), supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: { 'x-application-name': 'gaoshu-quest' },
      },
    });

    const { data, error } = await timeout(
      authClient.auth.getUser(bearer),
      AUTH_TIMEOUT_MS,
    );

    if (error) {
      const status = typeof error.status === 'number' ? error.status : 0;
      if (status === 401 || status === 403) {
        // 这些信息只写服务器日志/响应 details，不包含 token 本身，便于定位项目不匹配。
        console.error('[api/chat] Supabase 验证 Token 失败:', {
          status,
          code: (error as { code?: string }).code,
          message: error.message,
          supabaseHost: (() => {
            try {
              return new URL(supabaseUrl).host;
            } catch {
              return 'invalid-url';
            }
          })(),
          tokenIssuer: jwtIssuer(bearer),
          urlSource,
          anonKeySource,
          anonKeyKind: supabaseAnonKey.startsWith('eyJ')
            ? 'legacy-jwt'
            : supabaseAnonKey.startsWith('sb_publishable_')
              ? 'publishable'
              : 'unknown',
        });
        return fail(401, '登录状态已失效，请刷新页面后重试', 'auth', {
          details: error.message,
        });
      }
      console.error('[api/chat] Supabase 登录校验服务异常:', {
        status,
        code: (error as { code?: string }).code,
        message: error.message,
      });
      return fail(503, '登录校验服务暂时不可用，请稍后再试', 'auth-unavailable');
    }

    userId = typeof data.user?.id === 'string' ? data.user.id : '';
  } catch {
    return fail(503, '登录校验超时，请检查网络后重试', 'auth-unavailable');
  }

  if (!userId) return fail(401, '无法识别当前用户，请刷新页面后重试', 'auth');

  const dailyLimit = parseLimit(env.AI_DAILY_LIMIT);
  let quotaRow: SupabaseQuotaRow | null = null;

  try {
    const quotaResponse = await fetchWithTimeout(
      `${supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/consume_ai_quota`,
      {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_user_id: userId, p_limit: dailyLimit }),
      },
      AUTH_TIMEOUT_MS,
    );

    if (!quotaResponse.ok) {
      return fail(503, 'AI 次数配额服务未初始化，请先执行 docs/supabase/ai_quota.sql', 'quota-unavailable');
    }

    const payload = (await quotaResponse.json()) as SupabaseQuotaRow[] | SupabaseQuotaRow;
    quotaRow = Array.isArray(payload) ? (payload[0] ?? null) : payload;
  } catch {
    return fail(503, 'AI 次数配额服务暂时不可用，请稍后再试', 'quota-unavailable');
  }

  if (!quotaRow || quotaRow.allowed !== true) {
    const used = typeof quotaRow?.used === 'number' ? quotaRow.used : dailyLimit;
    return fail(429, `今天的 AI 助教次数已用完（${dailyLimit} 次/天），明天再来。`, 'quota', {
      limit: dailyLimit,
      used,
      remaining: 0,
    });
  }

  const used = typeof quotaRow.used === 'number' ? quotaRow.used : 1;
  const remaining =
    typeof quotaRow.remaining === 'number'
      ? quotaRow.remaining
      : Math.max(dailyLimit - used, 0);

  const apiUrl = pickEnv(env, 'AI_API_URL') || 'https://api.deepseek.com/chat/completions';
  const model = pickEnv(env, 'AI_MODEL') || 'deepseek-chat';

  try {
    const aiResponse = await fetchWithTimeout(
      apiUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${aiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          stream: false,
        }),
      },
      MODEL_TIMEOUT_MS,
    );

    if (!aiResponse.ok) {
      return fail(502, 'AI 服务暂时不可用，请稍后再试', 'upstream');
    }

    const data = (await aiResponse.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return fail(502, 'AI 没有返回内容，请重试', 'empty');
    }

    return {
      status: 200,
      body: { content: content.trim(), used, remaining, limit: dailyLimit },
    };
  } catch (error) {
    if (isAbortError(error)) {
      return fail(504, 'AI 请求超时，请稍后再试', 'timeout');
    }
    return fail(502, 'AI 服务网络异常，请稍后再试', 'upstream');
  }
}

/**
 * Vercel Node.js Function 入口。
 * 用结构化类型代替 @vercel/node，避免额外依赖；Vercel 用 esbuild 编译本文件。
 */
export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  const result = await handleChat(req);
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.status).json(result.body);
}

export const config = { maxDuration: 60 };
