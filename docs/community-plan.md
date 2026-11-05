# 第二阶段 · 社区题库规划

> 目标：在**不破坏第一阶段已验收功能**的前提下，新增跨设备共享的社区题库。
> 主线（七章、星级、XP、错题本、SM-2）仍本地优先、离线可用；只有社区模块依赖 Supabase。

## 0. 当前环境约束（重要）

- 仓库中**没有** `.env.local`，也没有可用的 Supabase 项目 URL / anon key；因此：
  - 建表、开启 RLS、开启匿名登录、两设备互访等**后端相关验收项无法在本环境真实验证**；
  - 交付物是可复现的 SQL 脚本 + 配置文档 + 完整客户端；客户端在缺少配置时按“社区不可用”降级。
- npm 可访问（SDK 已安装：`@supabase/supabase-js@2.119.0`）；PowerShell 自带 TLS 不可用，但 Node/npm 正常。

## 1. 架构边界

```
主线（不变）                         社区（新增）
─────────────────────────────       ─────────────────────────────
src/data, domain, db, services      src/domain/community*.ts
pages/Home, Map, Level, Play,       src/services/supabaseClient.ts
Result, WrongBook                   src/services/communityService.ts
IndexedDB gaoshu-quest              src/store/useCommunityStore.ts
无外部请求                           pages/Community*.tsx
                                    Supabase（Auth + Postgres/PostgREST）
```

- 主线数据表**不新增云同步**；社区题缓存、社区 XP 计数仍写本地 IndexedDB。
- 社区模块的失败被限制在社区页面内：首页/地图/主线页面不依赖社区 store。

## 2. 新增依赖与环境变量

```bash
npm install @supabase/supabase-js
```

`.env.local`（不入库，已在 .gitignore 中；只放 anon key）：

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon public key>
```

禁止：`service_role` key 出现在前端、`.env*`、构建产物或文档示例中。

## 3. 数据表与 RLS 清单

脚本：`docs/supabase/schema.sql`（可整段复制到 SQL Editor 执行，含回滚说明）。
说明：`docs/supabase/README.md`。

### community_questions

| 列 | 类型 | 说明 |
| --- | --- | --- |
| id | bigint identity PK | |
| chapter | smallint | 1–7 |
| topic | text | 2–30 字 |
| difficulty | text | 基础/进阶/挑战 |
| type | text | choice/judge/solution |
| stem | text | 5–500 字 |
| options | jsonb null | `[{id,text}]` |
| answer | jsonb | 选项 id / 布尔 / 文本 |
| explanation | text | 5–1000 字 |
| source | text | 原创/网络改编 |
| nickname | text | 2–20 字 |
| author_id | uuid | = auth.uid() |
| status | text | pending/visible/hidden，默认 pending |
| report_count | int | 默认 0 |
| content_hash | text | 归一化题干的 SHA-256 |
| created_at | timestamptz | 默认 now() |

策略：

- `select`：`status = 'visible'`（anon/authenticated 都可读）。
- `insert`：`to authenticated`，`with check (auth.uid() = author_id and status = 'visible')`。
- `delete`：`to authenticated`，`using (auth.uid() = author_id)`。
- 不开放 update（举报计数由 security definer 触发器维护）。

### community_reports

| 列 | 类型 |
| --- | --- |
| id | bigint identity PK |
| question_id | bigint FK → community_questions(id) on delete cascade |
| reporter_id | uuid |
| created_at | timestamptz 默认 now() |

- `insert`：`to authenticated`，`with check (auth.uid() = reporter_id)`。
- `select`：无常规策略（客户端读不到全量举报）。
- 唯一约束 `(question_id, reporter_id)`：同一用户对同一题只能举报一次。

### 阈值隐藏

`after insert` 触发器 `sync_question_reports()`（security definer）：
统计该题举报数写回 `report_count`，`>= 3` 时把 `status` 置为 `hidden`。
触发器绕过 RLS 执行更新；普通用户没有 update 权限。

## 4. 登录设计

- 客户端启动社区页时：`auth.getSession()`；无会话则 `signInAnonymously()`。
- 会话存储：自定义 IndexedDB 适配器（写入现有 `settings` 表，键前缀 `sb:`），不使用 localStorage，保持“数据只在本机 IndexedDB”的一致性。
- 作者身份：`author_id` 一律取 `session.user.id`，前端不接受表单传入。
- 升级：`auth.updateUser({ email, password })`（邮箱需在 Supabase 配置 SMTP 或确认邮件设置）；可选 `linkIdentity({ provider: 'google' })`。
- 升级后 `user.id` 不变，已上传题目归属不变。
- 匿名身份提示：清缓存/换设备会丢失作者身份；升级后可跨设备登录管理。
- 失败处理：社区 API 错误统一捕获 → 页面显示“社区功能暂不可用/离线模式”，主线不受影响。

## 5. 本地数据新增（Dexie v2）

| 表/字段 | 用途 |
| --- | --- |
| `communityQuestions`（新表：`id, chapter, difficulty, type, fetchedAt`） | 社区题缓存（离线浏览/作答） |
| `wrongItems.source`（可选 `'mainline' \| 'community'`） | 错题来源标记；不影响旧记录（缺省视为主线） |
| `wrongItems.communityId`（可选） | 关联社区题 id |
| `settings['communityRun']` | 进行中的社区练习（刷新可继续） |
| `settings['communityResult']` | 最近一次社区练习结算（结果页刷新可读） |
| `settings['communityXp']` | `{ date, xp }` 每日社区 XP 计数 |
| `settings['sb:...']` | Supabase 会话（IndexedDB 存储适配器） |

不新增 `community_attempts` 云端表：首版社区练习记录只存本地（符合“可选”）。

## 6. 组件树

```
App
├─ Header（新增“社区”入口）
├─ CommunityListPage            #/community
│  ├─ CommunityUnavailable      未配置/登录失败提示
│  ├─ CommunityFilters          章节/难度/题型
│  ├─ CommunityQuestionCard[]   题干摘要、作者、举报
│  └─ 加载更多 / 随机抽 5 题
├─ CommunityUploadPage          #/community/upload
│  ├─ 题型联动表单（选项/判断/解答）
│  ├─ 校验与长度计数
│  └─ 重复题干提示（不阻断）
├─ CommunityPracticePage        #/community/play
│  ├─ 复用组件：MathText、DifficultyBadge、AnswerInputs
│  ├─ 提交后不显示对错；结束后解答题自评
│  └─ 退出二次确认
├─ CommunityResultPage          #/community/result
│  ├─ 答对数 / XP（含每日上限提示）
│  ├─ 逐题解析
│  └─ 错题入库来源=社区
└─ MySubmissionsPage            #/community/mine
   ├─ 匿名升级（邮箱/密码）
   └─ 我的题目列表 + 删除
```

`AnswerInputs` 从现有 PlayPage 中抽出（选择题/判断题/解答题输入），主线与社区共用，行为不变。

## 7. 与主线的最小适配点

1. `WrongItem` 增加可选 `source`/`communityId`；旧数据缺省为主线。
2. 错题本：显示“社区”来源徽章；章节掌握度只统计主线题（社区题不计入 15 题分母）。
3. `profile.totalXp` 接受社区 XP（+10/题，每日上限 100）；不改连续天数与“今日已闯关”。
4. 路由新增 5 条社区路由；Header/Home/Map 增加社区入口。
5. `dataTransfer` 备份包含新表与新设置（新增字段向后兼容）。
6. 不改主线 `questions/levels` 表、不动主线 `activeRun` 的键；社区练习使用独立键，互不干扰。

## 8. 离线与降级规则

- 列表成功 → 写入 `communityQuestions`；失败/断网 → 读缓存并显示“离线模式，仅显示已缓存题目”。
- 上传/举报/删除/拉新题：断网或未配置时禁用并明确提示。
- 社区页任何异常都在边界内捕获；主线页面不订阅社区 store。
- Supabase 未配置：社区列表显示缓存（若有），否则“社区功能暂不可用”，主线完全正常。

## 9. 验收对应

| 验收项 | 本环境可验证性 |
| --- | --- |
| 1–4 回归 | 可验证（浏览器 + 断网 + 构建产物扫描） |
| 5–8 RLS/阈值 | **不可验证**（无项目）；交付 SQL/触发器 + 手工步骤 |
| 9 匿名登录 | 需项目；无配置时验证“失败降级” |
| 10–11 升级/换设备 | 需项目与邮箱；交付实现 + 步骤 |
| 12 双设备 | 需项目；可用本地 mock 验证客户端链路（标注非真实 Supabase） |
| 13–16 功能/离线 | 表单校验、缓存、XP 上限、错题来源可在本地/mock 验证 |
| 17 降级 | 可验证（移除 env 后跑主线） |

## 10. 明确不做

- 不把主线题库/记录/XP 迁云。
- 不做管理员后台、图片上传、富文本；题干只支持轻量 LaTeX。
- 不做社区题的章节进度/星级/Boss 解锁。
- 首版不做云端社区练习记录。
