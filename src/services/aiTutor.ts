const AI_CONFIG_KEY = 'gaoshu-ai-config-v1';
const AI_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const AI_MODEL = 'deepseek-chat';
const AI_TIMEOUT_MS = 45_000;

export interface AiTutorConfig {
  apiKey: string;
}

export class AiTutorError extends Error {
  readonly code: 'missing-key' | 'timeout' | 'network' | 'http' | 'empty';

  constructor(
    message: string,
    code: AiTutorError['code'],
  ) {
    super(message);
    this.name = 'AiTutorError';
    this.code = code;
  }
}

export function readAiTutorConfig(): AiTutorConfig {
  if (typeof window === 'undefined') return { apiKey: '' };
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_KEY);
    if (!raw) return { apiKey: '' };
    const parsed = JSON.parse(raw) as { apiKey?: unknown };
    return { apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '' };
  } catch {
    return { apiKey: '' };
  }
}

export function saveAiTutorConfig(apiKey: string): AiTutorConfig {
  const normalized = apiKey.trim();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AI_CONFIG_KEY, JSON.stringify({ apiKey: normalized }));
  }
  return { apiKey: normalized };
}

export function clearAiTutorConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AI_CONFIG_KEY);
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

export async function askAiTutor(input: AiTutorPromptInput): Promise<string> {
  const { apiKey } = readAiTutorConfig();
  if (!apiKey) {
    throw new AiTutorError('请先在设置中配置 API Key', 'missing-key');
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: 'user',
            content: buildAiTutorPrompt(input),
          },
        ],
        temperature: 0.7,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new AiTutorError('API Key 无效或没有调用权限，请在设置中检查后重试', 'http');
      }
      if (response.status === 429) {
        throw new AiTutorError('请求太频繁或额度不足，请稍后再试', 'http');
      }
      throw new AiTutorError(`AI 服务返回错误（HTTP ${response.status}），请稍后再试`, 'http');
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new AiTutorError('AI 没有返回内容，请重试', 'empty');
    }
    return content.trim();
  } catch (error) {
    if (error instanceof AiTutorError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AiTutorError('AI 请求超时（45 秒），请检查网络后重试', 'timeout');
    }
    throw new AiTutorError('网络请求失败，请检查网络后重试', 'network');
  } finally {
    window.clearTimeout(timeout);
  }
}
