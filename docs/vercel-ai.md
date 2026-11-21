# Vercel AI 代理配置

AI 助教不再由用户填写 API Key。前端只请求同源 `/api/chat`，真正的 Key 和 Supabase `service_role` 只存在于 Vercel Function 的服务器环境变量中。

## 1. 先在 Supabase 建每日配额

在 Supabase SQL Editor 执行：

```text
docs/supabase/ai_quota.sql
```

它会创建：

- `public.ai_usage`：每个用户、每天一行，记录已用次数；RLS 开启且无 policy，浏览器不可读写。
- `public.consume_ai_quota(uuid, int)`：服务端原子扣减额度，达到上限后返回 `allowed=false`。
- 表/函数只授权给 `service_role`；`anon`、`authenticated` 不能直接调用。

并确认 Supabase → Authentication → Providers → **Anonymous Sign-Ins** 已开启。用户第一次使用 AI 时，前端会静默创建匿名会话。

## 2. 在 Vercel 配环境变量

Vercel Dashboard → 你的项目 → **Settings → Environment Variables**，添加：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AI_API_KEY` | 是 | DeepSeek/百炼的 API Key，**不要加 `VITE_` 前缀** |
| `AI_API_URL` | 否 | 默认 `https://api.deepseek.com/chat/completions` |
| `AI_MODEL` | 否 | 默认 `deepseek-chat` |
| `SUPABASE_URL` | 是 | `https://<project-ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | 是 | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | Supabase service_role key，**只放服务器端，绝不加 `VITE_`** |
| `AI_DAILY_LIMIT` | 否 | 默认 `10`，可设 1–100 |

两个 Supabase URL/anon 变量也可以省略，函数会回退读取已有的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`。但 `SUPABASE_SERVICE_ROLE_KEY` 和 `AI_API_KEY` 必须单独配置。

建议三个环境都勾选：**Production、Preview、Development**。

### 用 Vercel CLI 配置

```bash
vercel env add AI_API_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SUPABASE_URL production
vercel env add SUPABASE_ANON_KEY production
```

预览环境把 `production` 换成 `preview`；本地 `vercel dev` 可用 `development`。也可以直接在 Dashboard 粘贴，避免 Key 出现在 shell history。

### 重要

- `VITE_` 开头的变量会被 Vite 打进浏览器产物；`AI_API_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` **绝不能**带这个前缀。
- 不要把真实 Key 写进 `.env.example`、README、源码或 GitHub。
- 添加/修改变量后重新部署（Dashboard 的 Redeploy，或 `vercel --prod`），Function 才能读到新值。
- `vercel.json` 已为 `api/chat.ts` 设置 `maxDuration: 60`。如果你的 Vercel 套餐上限更低，改成套餐允许的值。

## 3. 如果使用阿里云百炼

百炼提供 OpenAI 兼容接口时，可以设置：

```text
AI_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
AI_MODEL=qwen-plus
```

只要返回结构是 `choices[0].message.content`，前端不需要改。

## 4. API 约定

```http
POST /api/chat
Authorization: Bearer <Supabase access_token>
Content-Type: application/json

{ "prompt": "你是一个耐心的高数助教……" }
```

成功：

```json
{ "content": "...", "used": 1, "remaining": 9, "limit": 10 }
```

失败：

- `401`：没有/无效的 Supabase 会话
- `429`：当天 10 次已用完
- `503`：服务端环境变量缺失，或配额 SQL 未执行
- `504`：上游大模型超时
- `502`：上游模型网络/返回异常

## 5. 本地开发

Vite 开发服务器本身不运行 `api/` 目录，`npm run dev` 下 `/api/chat` 会 404。需要同时运行 Vercel Function 时使用：

```bash
vercel dev
```

然后在 Vercel CLI 提示的地址打开应用。没有安装 Vercel CLI 时，可以只在线上验证 AI，其他页面继续用 `npm run dev`。

## 6. 安全与额度说明

- 前端拿不到 `AI_API_KEY` 或 `service_role`；构建产物中不会出现它们。
- 每次请求先校验 Supabase 用户，再原子扣额度，最后才请求模型。
- 扣额度发生在模型调用之前；上游失败也会消耗一次，这是为了防止重试刷额度。
- 匿名登录用户清空浏览器数据/重新注册会得到新的匿名账号，因此“10 次/天”是**按账号**限制，不是按真人/IP 的绝对防刷。若要更强的防刷，需要再加 IP/设备风控。
- AI 回答由模型生成，仅供参考；错题本仍以官方解析为准。
