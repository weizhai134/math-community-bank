import { getCommunityAccessToken } from './supabaseClient';

const CHAT_ENDPOINT = '/api/chat';
const CLIENT_TIMEOUT_MS = 55_000;

export type AiTutorErrorCode =
  | 'auth'
  | 'quota'
  | 'timeout'
  | 'network'
  | 'http'
  | 'empty';

export class AiTutorError extends Error {
  readonly code: AiTutorErrorCode;

  constructor(message: string, code: AiTutorErrorCode) {
    super(message);
    this.name = 'AiTutorError';
    this.code = code;
  }
}

export interface AiTutorPromptInput {
  stem: string;
  wrongAnswer: string;
  correctAnswer: string;
  explanation: string;
}

export function buildAiTutorPrompt(input: AiTutorPromptInput): string {
  return [
    '你是一个耐心的高数助教。请用通俗易懂的语言，帮我分析这道题的易错点。',
    `题目：${input.stem}`,
    `我的错误答案：${input.wrongAnswer}`,
    `正确答案：${input.correctAnswer}`,
    `官方解析：${input.explanation}`,
  ].join('\n');
}

type ChatSuccess = {
  content: string;
  used?: number;
  remaining?: number;
  limit?: number;
};

type ChatErrorBody = {
  error?: unknown;
  code?: unknown;
  used?: unknown;
  remaining?: unknown;
  limit?: unknown;
};

/**
 * 只请求同源 /api/chat。AI Key、service_role 与配额判断都在 Vercel Function 内，
 * 浏览器只带 Supabase 匿名会话的 access token。
 */
export async function askAiTutor(input: AiTutorPromptInput): Promise<string> {
  let token: string;
  try {
    token = await getCommunityAccessToken();
  } catch (error) {
    throw new AiTutorError(
      error instanceof Error ? error.message : '无法获取登录状态，请刷新页面后重试',
      'auth',
    );
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 必须保留 "Bearer " 前缀后的空格；token 由 getCommunityAccessToken 负责 trim。
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ prompt: buildAiTutorPrompt(input) }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as
      | ChatSuccess
      | ChatErrorBody
      | null;

    if (!response.ok) {
      const errorBody = payload as ChatErrorBody | null;
      const serverMessage =
        errorBody && typeof errorBody === 'object' && typeof errorBody.error === 'string'
          ? errorBody.error
          : '';

      if (response.status === 401 || response.status === 403) {
        throw new AiTutorError(
          serverMessage || '登录状态已失效，请刷新页面后重试',
          'auth',
        );
      }
      if (response.status === 429) {
        throw new AiTutorError(
          serverMessage || '今天的 AI 助教次数已用完，明天再来。',
          'quota',
        );
      }
      if (response.status === 504) {
        throw new AiTutorError(serverMessage || 'AI 请求超时，请稍后再试', 'timeout');
      }
      throw new AiTutorError(
        serverMessage || `AI 服务暂时不可用（HTTP ${response.status}），请稍后再试`,
        'http',
      );
    }

    const content =
      payload && typeof payload === 'object' && 'content' in payload
        ? (payload as ChatSuccess).content
        : '';
    if (typeof content !== 'string' || !content.trim()) {
      throw new AiTutorError('AI 没有返回内容，请重试', 'empty');
    }
    return content.trim();
  } catch (error) {
    if (error instanceof AiTutorError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiTutorError('AI 请求超时，请检查网络后重试', 'timeout');
    }
    throw new AiTutorError('网络请求失败，请检查网络后重试', 'network');
  } finally {
    window.clearTimeout(timer);
  }
}
