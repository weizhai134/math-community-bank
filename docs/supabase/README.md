# Supabase 配置与 RLS 说明

本目录交付社区题库的**可复现后端**：建表、索引、RLS、举报阈值触发器。前端只使用 anon key，权限完全由 RLS 约束。

## 1. 创建项目

1. 登录 <https://supabase.com/dashboard>，New project，选一个离你近的区域，等待初始化完成。
2. 项目设置 → API：记下 **Project URL** 与 **anon public key**。
3. 项目设置 → API → 确认 **service_role key 只留在服务端**，不要粘贴到任何前端文件、`.env.local`、部署平台的前端环境变量或本文档。

## 2. 开启匿名登录

Dashboard → **Authentication → Providers → Anonymous Sign-Ins → Enable**。

匿名用户会获得 `authenticated` 角色和稳定的 `auth.uid()`，但 `is_anonymous = true`；清除浏览器数据/换设备后无法找回该身份。

建议同时检查：

- Authentication → Settings：确认 email provider 可用（升级邮箱时需要）；
- Authentication → Rate Limits：匿名登录有频率限制，开发期不要频繁清库重登。

## 3. 写环境变量

仓库根目录新建 `.env.local`（已被 `.gitignore` 忽略）：

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

只允许 anon key。构建产物里可以出现 anon key，这是设计允许的；**出现 `service_role` 即为安全事故**。

部署到 Netlify / Vercel 等平台时，在平台的环境变量里配置同名变量后重新构建。

## 4. 执行建表与 RLS

打开 **SQL Editor**，整段粘贴并执行 [`schema.sql`](./schema.sql)。

执行后自检：

```sql
-- 两张表都应 relrowsecurity = true
select relname, relrowsecurity
from pg_class
where relname in ('community_questions', 'community_reports');

-- 应看到 select/insert/delete 三类策略
select polname, polcmd
from pg_policy
where polrelid in ('public.community_questions'::regclass, 'public.community_reports'::regclass);
```

### 手工验证“anon 只能读 visible”

Supabase SQL Editor 默认以 `postgres` 身份运行，会绕过 RLS，需要显式切换角色：

```sql
begin;
set local role anon;
select count(*) from public.community_questions;   -- 只应统计 visible
reset role;
rollback;
```

### 手工验证“不能伪造 author_id”

```sql
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',
  true
);
-- 下面这条应被 RLS 拒绝（author_id 与 auth.uid() 不一致）
insert into public.community_questions
  (chapter, topic, difficulty, type, stem, answer, explanation, source, nickname, author_id, content_hash, status)
values
  (1, '测试', '基础', 'judge', '这是一道测试题', 'true'::jsonb, '测试解析内容', '原创', '测试', '22222222-2222-2222-2222-222222222222', 'hash', 'visible');
rollback;
```

### 手工验证“举报达 3 次隐藏”

用三个不同的匿名/登录用户分别举报同一题（或直接在 SQL Editor 以 postgres 插入三条不同 `reporter_id` 的举报，触发器同样生效）：

```sql
insert into public.community_reports (question_id, reporter_id) values
  (<question_id>, '11111111-1111-1111-1111-111111111111'),
  (<question_id>, '22222222-2222-2222-2222-222222222222'),
  (<question_id>, '33333333-3333-3333-3333-333333333333');

select id, status, report_count from public.community_questions where id = <question_id>;
-- 期望：status = hidden, report_count = 3
```

## 5. 可选升级：邮箱 / Google

- **邮箱 + 密码**：前端“我的投稿”调用 `auth.updateUser({ email, password })`。Supabase 默认会发确认邮件；确认后 `user.id` 不变。
  - 若项目未配置 SMTP，Supabase 内置邮件有严格频率限制，测试时注意。
  - 也可以在 Authentication → Providers → Email 关闭 “Confirm email” 便于本地联调（生产不建议）。
- **Google**：Authentication → Providers → Google，填 Client ID/Secret；在 URL Configuration 里加入部署域名。前端调用 `linkIdentity({ provider: 'google' })`，成功后仍是同一个 `user.id`。

## 6. 已知边界

- 阈值隐藏由**数据库触发器**实现，不是前端逻辑，因此不可被普通客户端绕过。唯一绕过方式是拥有 service_role 的后端/控制台直接改表。
- 举报表不开放 select，客户端无法统计“谁举报了什么”；同一用户重复举报由唯一约束拦截，前端显示“你已经举报过”。
- 先发后审：客户端提交时 `status='visible'`，RLS 的 `with check` 强制这一点；`pending` 仅为将来接入审核后台预留。
- 免费项目有数据库容量、带宽与 Auth MAU 限制；本应用社区题单条 < 2KB，正常使用足够。
- SQL 未做全文检索；列表按 `created_at` 分页，过滤走 `(chapter, difficulty, type)` 索引。

## 7. 验收辅助

配套的客户端验收步骤见仓库根部 `SELF_CHECK`（第二阶段章节）。在没有真实项目时，客户端会按“社区功能暂不可用 / 离线缓存”降级，主线不受影响。
