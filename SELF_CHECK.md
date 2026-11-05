# 交付前自检报告

审计对象：`D:\高数闯关教程`  
审计日期：2026-11-03  
最终构建：`dist/`  
审计方式：静态数据审计 + 纯函数测试 + Edge 无头浏览器桌面/移动端/关闭重开/网络监听。

## 自检报告

- **构建：通过**。`npm install` 成功，`audit 76 packages`、`0 vulnerabilities`、锁文件存在；`npm run build` 的 `tsc -b && vite build` 零错误，生成 `dist/`（62 modules）。
- **题库：通过**。105 题，七章各 15 题；每章选择/判断/解答齐全，基础/进阶/挑战齐全；必填字段、来源、选项答案 id、关卡引用、Boss 挑战题全部通过校验；1183 个数学片段 KaTeX 解析零错误。
- **闯关闭环：通过**。实测 60%→1 星、80%→2 星、100%→3 星；部分对 4.5/5 → 2 星且连击 3；提交不泄题；提前结束 5 题全入分母；重试与历史最高正常。
- **解锁与进度：通过**。基础默认解锁；基础 1 星解锁进阶；基础+进阶累计 3 星解锁 Boss；Boss 1 星通关并等待手动确认下一章；跨章挑战已解锁基础关；进度条 6/9 同步。
- **XP/段位/激励：通过**。纯函数逐项核对 70/84/180/218/255/300/33/15 等边界；0 星无完成奖励；重复三星 ×0.3 向下取整且无 +50；试炼 24 小时不重复给 XP；连续天数跨零点、段位阈值、鼓励语去重、建议具体性均通过。
- **错题本与复习：通过**。错误/部分对自动入库；wrongCount 累加；章节筛选与 8/15 掌握度；三类初始间隔 15/30/60 分钟；SM-2 的 1/3/5 更新；归档恢复；到期红点；试炼优先到期并补足 5 题，章节星数不变。
- **交互与可访问性：通过**。390×844 完成选关→刷题→结算；无横向溢出；13 个公式块自动缩放后无遮挡；数字键、Enter、N、Ctrl+Enter 均实测；提交到结算不泄露对错；备份清空后恢复 549 XP / 10 次尝试 / 8 道错题。
- **不变量与边界：通过**。正常运行期 attempt 仅 `add`；选择按选项 id、判断按布尔、解答仅自评；难度标签可见；锁定关卡可见不可进；无 fetch/axios/XHR/WebSocket/localStorage；13 个请求全部为本地静态资源，外部请求 0。

## 证据索引

### E1 安装与构建

```text
> npm install
audited 76 packages
found 0 vulnerabilities

> npm run build
> tsc -b && vite build
✓ 62 modules transformed.
✓ built in 1.29s
```

`package-lock.json` 存在；产物位于 `dist/`。npm 提示 esbuild 的 postinstall 未被 allowScripts 自动批准，但构建使用已安装的二进制成功完成，无致命错误。

### E2 开发模式

`npm run dev -- --host 127.0.0.1` 输出：

```text
VITE v6.4.5 ready in 315 ms
➜ Local: http://127.0.0.1:5173/
```

浏览器检查：

```text
PASS 开发模式首页加载
PASS 开发模式刷新后恢复进行中关卡
PASS 开发模式刷新后仍显示已提交状态
PASS 开发模式难度标签可见
PASS 开发模式控制台无 error
PASS 开发模式无未捕获异常 / Promise
PASS 开发模式无外部来源请求
DEV_ORIGINS=http://127.0.0.1:5173
```

### E3 关闭再打开

持久化 Edge profile 完整关闭浏览器后重新打开：

```text
PASS 关闭前已产生进度 — 50/1
PASS 关闭再打开 XP 不丢失 — 50->50
PASS 关闭再打开尝试记录不丢失
PASS 关闭再打开地图星级不丢失
PASS 关闭重开无控制台错误
PASS 关闭重开无未捕获异常
PERSISTENCE_FAILURES=0
```

### E4 主流程浏览器审计

```text
PASS 60% 正确率得到 1 星 — 1/60%
PASS 80% 正确率得到 2 星 — 2/80%
PASS 100% 正确率得到 3 星
PASS 三星 XP 与公式一致为 188 — 188
PASS 部分对按 0.5 题计入，90% 且连击被中断 => 2 星 — 2/90%/combo=3
PASS 重复三星 XP ×0.3 且不再加 50，应为 33 — 33
PASS 提前结束未作答 5 题全部计入分母
PASS 0 星重试不降低历史最高星级
PASS 基础 1 星后进阶解锁、Boss 仍锁定
PASS 手动确认后第 2 章解锁
PASS 跳章：第 1、2 章基础关都可用
PASS 章节星数进度为 6/9
PASS 退出后保存未完成记录
PASS 三类错题初始间隔 15/30/60 分钟
PASS “记住”quality=5 更新 interval/ease/nextReviewAt
PASS “忘记”quality=1 降低 ease 并缩短间隔
PASS 到期不足 5 时用其他错题补足 5 题
PASS 错题试炼每题 +5 XP 且无加成 = 25 — 25
PASS 错题试炼不计章节总星数
PASS 同一错题 24 小时内重复答对不再给 XP — 0
PASS 清空 IndexedDB 成功 — deleted
PASS 清空后导入备份恢复 XP/尝试/错题 — 549/10/8
PASS 无外部网络请求
PASS 无失败资源响应
PASS 无失败请求
PASS 浏览器控制台无 error
PASS 无未捕获异常 / Promise

REQUESTS=13 EXTERNAL=0
CONSOLE_ERRORS=0 PAGE_ERRORS=0
FAILURES=0
```

结算顺序实测坐标：

```json
{"metrics":512.9,"review":669.1,"compare":2761.1,"encouragement":2911.8,"advice":3071.2,"xp":3231.1}
```

说明顺序为星级 → 成绩/逐题回顾 → 历史对比 → 鼓励 → 建议 → XP/解锁。

### E5 题库静态审计

```text
ch1: total=15, C/J/S=6/4/5, B/A/C=5/5/5
...
ch7: total=15, C/J/S=6/4/5, B/A/C=5/5/5

TYPES { choice: 42, judge: 28, solution: 35 }
DIFFICULTY { 基础: 35, 进阶: 35, 挑战: 35 }
NETWORK_ADAPTED 35
SOLUTION_STEPS 35/35
CHOICE_JUDGE_REASON_LENGTH_OK 70/70
EXPLANATION_LENGTH {
  choice: { min: 72, max: 446, avg: 215 },
  judge: { min: 130, max: 314, avg: 201 },
  solution: { min: 170, max: 563, avg: 282 }
}
MATH_TOKENS 1183 MATH_ERRORS 0
STATIC_ERRORS 0
```

题库与关卡种子：

- `src/data/seed/questions.json`
- `src/data/seed/levels.json`

### E6 纯函数单测

```text
PASS 60% => 1 star
PASS 80% within time => 2 stars
PASS 80% over time => 1 star
PASS 100% => 3 stars even over time
PASS 90% + combo4 => 3 stars
PASS 90% + combo3 + time => 2 stars
PASS 1-star basic XP = 70
PASS 2-star basic XP = 84 (×1.2)
PASS 3-star basic XP = 180 (×1.5, +50)
PASS advanced bonus +5 each => 218
PASS challenge bonus +10 each => 255
PASS 0 star has answers only, no completion bonus => 20
PASS single-level XP cap = 300
PASS repeat 3-star ×0.3 floor and no +50 => 33
PASS trial 5 XP each, no multiplier/completion => 15
PASS streak multipliers by band
PASS cross-midnight Asia/Shanghai increments
PASS rank thresholds and epithets
PASS rank progression never decreases
PASS choice/judge/solution initial intervals 15/30/60
PASS quality 1/3/5 SM-2 updates
PASS wrong again increments wrongCount and lowers ease
PASS trial XP blocked/allowed at 24h
PASS 8 repeat clears produce 8 distinct encouragement texts
PASS suggestions are topic-specific and 1–3 items
RULE_FAILURES=0
```

### E7 移动端与公式

```text
PASS 移动端首页无横向溢出 — 0
PASS 移动端地图无横向溢出
PASS 移动端关卡详情无横向溢出
PASS 关卡详情难度标签可见
PASS 移动端刷题页无横向溢出
PASS 刷题页难度标签可见
PASS 移动端键盘数字选选项
PASS 移动端提交后不显示对错
PASS 移动端键盘 N 进入下一题
PASS 移动端解答题可自评
PASS 移动端结算页无横向溢出
PASS 移动端完整流程得到 3 星
PASS Boss 长公式结果页渲染 — 13 blocks
PASS 长公式自动缩放后无遮挡溢出 — []
PASS 公式结果页无横向溢出 — 0
PASS 移动端控制台无 error
PASS 移动端无未捕获异常/Promise
```

### E8 题库导入

```text
PASS 导入前已有历史记录 — 549 XP / 10 / 8
PASS 导入题库成功且题量仍为 105 — 105
PASS 导入题库后关卡仍为 21 — 21
PASS 导入题库不影响已有记录 — 549/10/8
PASS 题库导入无控制台错误
BANK_IMPORT_FAILURES=0
```

### E9 代码不变量

```text
src/services/appService.ts:494  db.levelAttempts.add(attempt)
src/services/appService.ts:610  db.levelAttempts.add(attempt)
src/services/dataTransfer.ts:176 db.levelAttempts.clear()
src/services/dataTransfer.ts:184 db.levelAttempts.bulkAdd(levelAttempts)
```

正常闯关/退出只使用 `add`，没有 `put/update/delete`。`clear + bulkAdd` 只存在于用户显式“全量恢复备份”操作中，是全库替换而非单条历史修改。

网络/存储搜索：

```text
fetch/axios/XMLHttpRequest/sendBeacon/WebSocket: 无匹配
localStorage/sessionStorage/document.cookie: 无匹配
```

### E10 视觉证据

- `docs/screenshots/home.png`
- `docs/screenshots/map.png`
- `docs/screenshots/play.png`
- `docs/screenshots/result.png`
- `docs/screenshots/wrongbook.png`
- `docs/screenshots/mobile-home.png`
- `docs/screenshots/mobile-play.png`

## 逐项结果

| # | 检查项 | 结果 | 证据 |
|---|---|---|---|
| 1 | npm install、锁文件 | 通过 | E1；`package-lock.json` 存在 |
| 2 | npm run build / TS / 产物 | 通过 | E1；`dist/` |
| 3 | npm run dev、控制台、Promise | 通过 | E2 |
| 4 | 刷新、关闭重开、IndexedDB | 通过 | E2 + E3 |
| 5 | 无外部请求/后端 | 通过 | E4 `REQUESTS=13 EXTERNAL=0`；E9 |
| 6 | 105 题、每章 15 | 通过 | E5 |
| 7 | 每章三题型 | 通过 | E5 每章 C/J/S=6/4/5 |
| 8 | 每章三难度 | 通过 | E5 每章 B/A/C=5/5/5 |
| 9 | 必填字段、source | 通过 | E5 `STATIC_ERRORS=0`、`NETWORK_ADAPTED=35` |
| 10 | 3 关×5 题、复合题分母 | 通过 | E5 21 关每关 5 个唯一题号；题库无 parts 字段；结算分母为 `questionList.length` |
| 11 | 解析完整步骤/理由 | 通过 | E5：解答 35/35 步骤达标，选择+判断 70/70 理由长度达标；解答平均 282 字 |
| 12 | LaTeX 桌面/移动、长公式 | 通过 | E5 1183 tokens 0 错；E7 13 blocks 0 遮挡、页面 0 溢出 |
| 13 | JSON 种子、导入题库、不影响记录 | 通过 | E5 种子路径；E8 549/10/8 不变 |
| 14 | 首页四项信息、继续/试炼入口 | 通过 | E4 首页检查；`home.png` |
| 15 | 地图七章、三关、星级、锁定、进度 | 通过 | E4；`map.png` |
| 16 | 锁定关卡弹条件不可进 | 通过 | E4 `lock-detail` 且 URL 仍为 `#/map` |
| 17 | 目标卡六项 | 通过 | E4 目标卡六项齐全 |
| 18 | 选项洗牌、判断布尔、解答不判定 | 通过 | E4 选项洗牌；E9 代码路径；解答仅写入作答 |
| 19 | 提交不泄露、结算统一回顾 | 通过 | E4 无 `.result-badge/.correct-box`、无“正确答案/完整解析” |
| 20 | 结算页纵向顺序 | 通过 | E4 坐标；`result.png` |
| 21 | 60/80/100 星、部分对 0.5 打断连击 | 通过 | E4 1/2/3 星；部分对 90%/combo3/2 星；E6 |
| 22 | 未达 1 星重试、洗牌、记录 | 通过 | E4 重试洗牌；0 星/1 星尝试均入库 |
| 23 | 历史最高与本次对比 | 通过 | E4 刷新标记、0 星不降历史；`result.png` |
| 24 | 退出二次确认、未完成记录 | 通过 | E4 退出后 `abandoned`、activeRun null |
| 25 | 提前结束分母 | 通过 | E4 5 条答案、earned 全 0、正确率 0% |
| 26 | 基础/进阶/Boss 解锁条件 | 通过 | E4 1 星解锁进阶、Boss 锁；E6 3 星解锁 |
| 27 | Boss 通关、手动解锁下一章 | 通过 | E4 通关提示、unlock-banner、手动确认生效 |
| 28 | 跳章挑战已解锁基础关 | 通过 | E4 c1-basic 与 c2-basic 同时可用 |
| 29 | 章节进度条 | 通过 | E4 1 星→1、6 星→`aria-valuenow=6` |
| 30 | XP 各规则 | 通过 | E6：70/84/180/218/255 + 倍率；E4 UI 188 |
| 31 | 0 星无完成奖励、单关上限 | 通过 | E6 0 星=20、cap=300；E4 0 星=0 |
| 32 | 重复三星 ×0.3、无 +50 | 通过 | E4 重复三星=33；页面显示 ×0.3 说明 |
| 33 | 试炼 +5、无加成、24h 去重 | 通过 | E4 25 XP、第二次 0 XP |
| 34 | 自然日/跨零点/今日已闯关 | 通过 | E6 跨零点 2；E4 lastActiveDate 更新 |
| 35 | 段位只升不降、阈值 | 通过 | E6 12 个阈值点，index 单调 |
| 36 | 鼓励语组合与去重 | 通过 | E6 8 条全不同；E4 实际 7/7 不同 |
| 37 | 建议具体知识点/题型 | 通过 | E4 “「因式分解求极限」”；E6 洛必达建议 |
| 38 | 错题/部分对入库、wrongCount | 通过 | E4 q3 wrongCount≥3；earned 0.5 记录 |
| 39 | 筛选、字段、掌握度 | 通过 | E4 “8 / 15 题，掌握度 47%” |
| 40 | SM-2 1/3/5、interval/ease/next | 通过 | E6 全量；E4 记住/忘记实测 |
| 41 | 三类初始间隔 | 通过 | E4 `{"choice":15,"judge":30,"solution":60}` |
| 42 | 归档取消恢复 | 通过 | E4 归档列表可见、恢复后 archived=false |
| 43 | 试炼入口、星级/XP/不计章星、补足 5、计时 | 通过 | E4 due2→5 题、25 XP、章星 6→6 |
| 44 | 首页/地图红点 | 通过 | E4 两处 `.red-dot-label` 均出现 |
| 45 | 移动端完整流程 | 通过 | E7 3 星全流程、0 溢出 |
| 46 | 键盘 数字/Enter/N | 通过 | E7 数字选、Enter 提交、N 下一题；Ctrl+Enter 解答题 |
| 47 | 不泄露对错 | 通过 | E4 三处检查、提交区无徽标/解析 |
| 48 | 备份导出→清空→导入 | 通过 | E4 549/10/8 恢复一致 |
| 49 | levelAttempt 只追加 | 通过（边界见下） | E9 正常只 add；恢复备份例外 |
| 50 | 选项身份、布尔、自评 | 通过 | E9；E4 洗牌后按 option id 命中 |
| 51 | 难度标签可见 | 通过 | E7 关卡详情 5 个 + 刷题页 1 个 |
| 52 | 锁定可见不可进、条件明确 | 通过 | E4 |
| 53 | 无账号/上传/外部请求、仅 IndexedDB | 通过 | E4/E9；Dexie 七表；无网络 API |

## 不通过项与修复情况

1. **首页在错题为 0 时没有可见的“错题试炼”入口**
   - 影响范围：首页激励/复习入口，不阻断关卡。
   - 修复：首页复习卡始终显示“错题试炼”按钮；无错题时进入空状态页面，有到期题时直接开始试炼。
   - 复测：E4 首页入口检查通过。

2. **结算页“刷题建议”和“XP/解锁”并排，不符合纵向顺序**
   - 影响范围：仅结算页信息层级。
   - 修复：两栏改为单列纵向；实测坐标 `advice 3071 < xp 3231`。
   - 复测：E4 顺序检查通过。

3. **题库初稿使用 TypeScript 对象而非真正的 JSON 种子**
   - 影响范围：可扩展性与“JSON 种子”要求的证据。
   - 修复：生成并改为读取 `src/data/seed/questions.json` 与 `levels.json`；题库校验仍通过。
   - 复测：E5 `STATIC_ERRORS=0`；E8 导入不变记录。

4. **长公式原先只在公式块内滚动，未保证自动缩放**
   - 影响范围：极窄屏幕上的长公式可读性。
   - 修复：`MathText` 对超宽块级公式测量后按容器宽度等比缩小字号，并保留内部滚动兜底。
   - 复测：E7 13 个长公式块全部 `overflow=[]`，页面 `0` 溢出。

5. **全量恢复备份曾使用 `bulkPut` 写历史尝试；KaTeX 0.16 有 1 个 low 级公告**
   - 影响范围：恢复路径的 append-only 边界与依赖安全。
   - 修复：恢复改为清空目标库后 `bulkAdd`；KaTeX 升级至 0.19.1，移除重复类型包；`npm audit` 变为 0。
   - 复测：E1 `0 vulnerabilities`；E8、E4 恢复一致；E9 无 `levelAttempts.put/update`。

6. **一次审计失败由未重新构建的旧 `dist` 引起（首页入口/错题属性未进产物）**
   - 影响范围：测试观察到的是旧产物，不是源代码逻辑。
   - 修复：重新 `npm run build` 后复测。
   - 复测：E4 全部通过。

> 最终复测：主流程 `FAILURES=0`、移动端 `MOBILE_FAILURES=0`、关闭重开 `PERSISTENCE_FAILURES=0`、开发模式 `DEV_SMOKE_FAILED=0`、题库导入 `BANK_IMPORT_FAILURES=0`；控制台错误与未捕获异常均为 0。

## 已知限制

1. **错题总数少于 5 时**，错题试炼按现有题数开始；到期不足 5 但总错题 ≥5 时已实测补足 5 题。不会复制题目凑数。
2. **SM-2 为简化版**：初错间隔为选择 15 分钟、判断 30 分钟、解答 60 分钟；自评固定 1/3/5，不包含完整 Anki 参数体系。
3. **目标用时是配置估算值**，不根据个人历史动态学习。
4. **全量备份恢复是显式数据库替换**：会清空当前存储再导入备份，这是唯一非追加路径；日常闯关/退出没有修改历史 attempt 的代码。
5. **解答题依赖用户诚实自评**，这是产品边界，不做伪造自动判分。
6. 浏览器兼容性实测为 Edge/Chromium；未在 Safari、Firefox 实机复测。
7. 数据只存在当前浏览器；清理站点数据会丢失，必须依赖 JSON 备份。

## 启动与使用说明

```bash
cd "D:\高数闯关教程"
npm install
npm run dev
```

打开 `http://localhost:5173`。生产构建：

```bash
npm run build
npm run preview
```

使用顺序：首页/地图 → 关卡目标卡 → 开始挑战 → 提交五题 → 解答题自评 → 结算 → 错题本/试炼。数据面板在右上角“数据”。

## 首次使用者可用性判断

**判断：能完成，且不需要看说明书。**  
这不是仅根据组件结构推断。我用全新的 IndexedDB、在桌面 1360px 和手机 390px 两种视口实际走了一遍：从首页“继续闯关”/章节地图进入基础关，目标卡上“开始挑战”直接进入五题；每题提交按钮独立，最后一题变成“完成本关”；进入等待页后，页面明确写出“解答题不自动判分”“请选择做对/部分对/做错”，完成后按钮是“完成自评，揭晓结果”；结算后顶栏“错题本”有到期红点，试炼卡直接提供“开始到期试炼”。

唯一会让人停一下的是解答题自评，它需要用户诚实判断“部分对”，但这不是说明书缺口：自评页、按钮和结算解释都在当前屏幕内，且无法误触自动判分。若一个学生只凭直觉乱点“做对”，他会得到虚高星级，这是自评机制本身的已知代价，而不是流程不可发现。

## 2026-11-03 交付前复核（独立重跑）

在初版自检之后，又做了一轮独立复核：不改测试脚本里的断言、直接重读源码，并用 `tsc -b`、纯函数测试和新开浏览器（全新 IndexedDB）重跑闭环。本轮发现并修正了 6 处问题。

### 本轮修正

1. **结算页信息顺序偏离规格**
   - 规格要求“用时与得分（含逐题对错回顾）”在“本次星级与历史最高对比”之前；实际源码把逐题回顾放到了页面最底部。
   - 修复：把逐题回顾移到成绩卡之后、星级对比之前；实测 DOM 顺序为 `hero → metrics → review → compare → encouragement → advice/xp`。
2. **首次通关被写成“刷新历史最高”**
   - `prevBestStars = 0` 时也判定为刷新，首次记录会显示“刷新历史最高”，鼓励语也走“刷新”文案。
   - 修复：只有历史最高 > 0 且本次更高才算刷新；首次记录显示“首次记录”，鼓励语使用非刷新文案。
3. **结算页 5 段完整解析全部展开，把对比与成长信息推到 3000px 之后**
   - 修复：逐题回顾的解析默认收起（`<details>`），点开仍是完整步骤；对错、作答与正确答案保持常显。
4. **刷新页面会重置本题计时（可反复刷新拖时间）**
   - 修复：刷新后继续计时，只有离开超过 10 分钟才按“重新开始本题”处理。
5. **键盘处理对非元素事件目标会抛异常**
   - `event.target` 为 `window` / `document` 时 `tagName.toLowerCase()` 报错；已加类型守卫。
6. **错题试炼顶部标题重复显示“错题试炼”**
   - 修复：试炼时副标题改为“5 题复习”。

### 复核证据

```text
$ npm run typecheck
> tsc -b --pretty false
（零输出，退出码 0）

$ npm run build
✓ built in 1.31s

$ npm run dev -- --host 127.0.0.1
VITE v6.4.5 ready in 286 ms
→ 开发模式首页正常、路由正常、console error 0、未捕获异常 0
```

纯函数复核（esbuild 打包后在 Node 中执行，30 条断言全部通过）：

```text
TOTAL=30 FAILURES=0
覆盖：星级 0/1/2/3 星边界、部分对 0.5、XP 70/84/180/218/255/300、
      重复三星 ×0.3、连续天数 1.0–1.5、段位 6 档阈值、解锁链、
      SM-2 15/30/60 分钟与 1/3/5 更新、试炼 24h 窗口、鼓励语去重、建议条数
```

浏览器闭环（Edge/Chromium，全新 IndexedDB，逐项读取 IndexedDB 核对）：

```text
地图           21 个节点、7 章、初始 20 个锁定；锁点弹层给出具体条件
基础关 60%     1 星，XP 55，解锁进阶关；2 道错题入库（判断 30 分钟 / 解答 60 分钟）
重试 100%      3 星，历史最高 1→3，XP 188，标记“刷新历史最高”，Boss 解锁
Boss 100%      3 星，XP 255，chapterCleared=true，pendingUnlocks=[2]
手动确认        unlockedChapters=[1,2]，第 2 章基础关可进
重复三星       XP 33 = floor(round(75×1.5)×0.3)，无 +50，标记“追平历史最高”
c2 基础 40%    0 星，XP 20（只有答题分，无完成奖励），进阶仍锁定
c2 基础重试    60% → 1 星，XP 50，进阶解锁
部分对         正确率 80%、最高连击 3（部分对打断）、2 星、XP 72、两处“部分对”标记
SM-2           忘记：ease 2.50→1.96，间隔回到 15 分钟；记住：ease 2.06，间隔 2.06 天
掌握度         整体 6/105=94%；第 2 章 4/15=73%
到期提醒       首页“6 道到期”、导航红点、地图“6 道错题到期”
错题试炼       5 题、全对 → XP 25、3 星、chapterCleared=false、无解锁、章节星不变
24h 规则       立即再试炼全对 → 仅 1 道从未给过 XP 的题得 5 XP
键盘           数字键选中、Enter 提交、N 下一题
退出确认       取消仍在关卡内；确认后写入 abandoned 记录（0 星 / 0 XP / 5 行作答），不写错题本
刷新续关       刷新后回到原题号继续，计时不重置
备份           导出 105 题 / 21 关 / 11 次尝试（含 1 条未完成）/ 55 行作答 / 8 道错题；恢复后一致
题库导入       空题库被拒并列出 8 条校验错误；导出题库原样导入成功，历史尝试与错题保留
移动端         492 CSS px 下首页/地图/错题本/结算/刷题均单列、无横向溢出（本机窗口最小宽度限制）
控制台         以上全流程 console error 0、uncaught 0
```

### 与初版报告的差异说明

- 初版“结算顺序实测坐标”记录的是 review 在 compare 之前；本轮开始时代码已把 review 放到页面最底部，与初版记录不一致。已恢复为规格要求的顺序并重新实测。
- 初版移动端记录为 390×844；本轮审计环境的浏览器窗口被系统限制在 492 CSS px，因此移动端复核在 492px 完成。492px 已低于 680px 的移动断点，单列布局与无溢出结论仍然成立；更窄的 390px 结论保留初版记录。
- 本轮改动只涉及结算页顺序/文案、解析折叠、计时恢复、键盘守卫与试炼标题，未改题库、评星、XP、解锁和 SM-2 的规则实现；纯函数 30 条断言用于确认规则未被改动。

## 跨设备与部署复核（追加）

针对“换设备 / 手机能不能用”单独做了一轮可用性验证：

```text
构建产物         dist/index.html 使用相对路径（./assets/...、./favicon.svg）
子路径部署       把 dist 挂到 /gaoshu/ 下：7/7 资源全部命中 /gaoshu/ 前缀，
                 样式表加载成功、页面正常启动、无 404、无基线路径泄漏
局域网            npm run dev:lan（vite --host 0.0.0.0）
                 Network: http://192.168.201.195:5173/
                 GET 该地址返回 200，HTML 正常
移动端输入框      492px：解答题 textarea 16px、题库编辑器 16px
                 966px：恢复 14px / 10px（桌面设计不变）
```

结论与边界：

- 页面可部署到任意静态托管（根目录或子目录均可），手机/平板/另一台电脑只要能访问该地址就能用；没有后端、没有账号。
- **进度不跨设备同步**：IndexedDB 按“浏览器 + origin”隔离，换设备、换浏览器、换端口或域名都会得到全新数据。迁移必须走“数据 → 导出备份 / 恢复备份”。
- 手机端已升级为可安装 PWA（见下节）；首次安装仍需通过 HTTPS 打开一次，之后可完全脱离电脑离线使用。
- 真实 iPhone / Android 实机未测（环境只有 Chromium）；已针对 iOS 的输入框自动放大与 `safe-area-inset-*` 做适配。

## 移动端独立使用（PWA）复核（追加）

目标：手机上装成独立应用，之后不连接电脑、不连服务器也能刷题。

实现：

- `public/manifest.webmanifest`：standalone、start_url/scope 为相对路径、192/512 图标、maskable、两个快捷方式（地图 / 错题本）。
- `public/icons/`：192、512、Apple Touch Icon（180），由项目自身 `∫` 图标生成。
- `index.html`：manifest、apple-touch-icon、apple-mobile-web-app-* 元信息。
- `vite.config.ts` 内的构建插件：每次 build 扫描产物，生成带版本号的 `sw.js`，预缓存 `index.html`、全部 JS/CSS、KaTeX 字体与图标；导航请求 network-first，离线回退缓存 index。
- `src/main.tsx`：仅生产构建注册 Service Worker（开发模式不注册，避免 HMR 与缓存冲突）。
- `src/components/InstallHint.tsx`：手机宽度首次访问显示安装引导，关闭后写入 IndexedDB，不再打扰；独立窗口下不显示。

实测（Chromium，全新 origin，localhost 属于安全上下文）：

```text
manifest        Page.getAppManifest：errors=[]；Page.getInstallabilityErrors：[]
图标            icon-192 / icon-512 / apple-touch-icon 全部 200
SW              active=activated，controller=true，缓存版本 gaoshu-f5cc7t
预缓存          72 个 URL（index.html、4 个 JS、2 个 CSS、全部 KaTeX 字体、manifest、图标）
离线（关键）     直接停掉静态服务器后 reload：
                /index.html?dead=… 探测 = TypeError（确认无网络来源）
                首页正常渲染、章节地图 21 个节点、进入关卡并开始答题
                5 个 KaTeX 公式块正常渲染，document.fonts.check('16px KaTeX_Main') = true
                刷新后仍能继续关卡（IndexedDB + 缓存同时生效）
更新            重新 build 后 SW 版本变化，旧缓存被删除，仅保留新版本
安装引导         492px 显示 flex、966px display:none；点“知道了”写入
                settings.installHintDismissed=true，刷新后不再出现
安全区           已验证 CSS 生效（emulation 下 inset=0，不改变桌面布局）
```

边界：

- Service Worker 需要安全上下文：`https://` 或 `localhost` 可用；局域网 `http://192.168.x.x` 只能在线使用，不能安装/离线。**首次安装必须有一次性 HTTPS 访问**（任意免费静态托管即可）。
- 无法在本环境实际点击“安装”并验证 standalone 窗口；`display-mode: standalone` 也不能用 CDP 模拟。安装判定逻辑（matchMedia + navigator.standalone）与引导隐藏逻辑已按标准写法实现，但真实 iOS/Android 的安装流程未实测。
- iOS 对 PWA 的存储可能在长期未使用后被系统回收；重要进度仍建议导出备份。

## 第二阶段：社区题库验收（2026-11-04）

### 前置说明（必须读）

- 本机**没有 Supabase 项目、也没有 `VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY`**。因此建表、RLS、匿名登录、双设备互访这些**真实后端项无法执行**，下表明确标为“未验证”，不以 mock 结果冒充。
- 客户端交互链路使用**仅本地测试的 mock 服务**（`.tmp/audit/mock-supabase.mjs`，不随应用交付）验证；mock 模拟了匿名登录、可见性过滤、作者校验、举报计数/隐藏，但**不是真实 RLS**。
- 最终 `dist/` 已按用户提供的真实项目（`https://chkkogrmletzjrwwjkzd.supabase.co` + publishable key）重新构建，URL 已进入产物；但**真实后端验收仍因本机网络无法访问 `supabase.co` 而未执行**（见下方“真实环境阻塞”）。

### 命令与产物

```text
$ npm install @supabase/supabase-js
added 9 packages（@supabase/supabase-js@2.119.0）

$ npm run typecheck
> tsc -b --pretty false
（零输出，退出码 0）

$ npm run build
✓ built in 1.61s

$ 扫描 dist
NO_SERVICE_ROLE
NO_MOCK_URL（127.0.0.1:54321 未进入产物）

$ 纯函数回归（12 项）
PASS 星级边界 / XP / 重复三星 / 连续天数 / 段位 / 解锁链 / 章节星数
PASS SM-2 初始间隔 / 题库 105-21-每关5 / LaTeX 全部可解析
PASS 社区表单校验 / 题干归一化与映射 / 每日 XP 上限
TOTAL=12 FAILURES=0
```

### 第二阶段验收清单

| # | 验收项 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 主线结构/行为不变 | **通过** | 题库审计 105 题/7 章每章 15/21 关每关 5/Boss≥2 挑战/LaTeX 0 错误；在线主线 3 星、188 XP；规则断言 12/12 |
| 2 | 断网主线可完整走完 | **通过** | 停掉静态服务器后 reload：探测 `TypeError`；首页 → 地图 21 节点 → 基础关 → 5 题 → 结算 2 星/80%/23 XP → 错题本 1 条 |
| 3 | 主线只存 IndexedDB、无 service_role | **通过** | `dist` 扫描 `NO_SERVICE_ROLE`；主线只写 Dexie 表；备份导出含档案/尝试/错题 |
| 4 | 除社区外无外部请求 | **通过** | 干净构建：`crossOrigin=[]`；mock 构建：只有 `127.0.0.1:54321` 的 Supabase 请求 |
| 5 | 三表 RLS 可复现 | **未验证** | 无项目可执行。交付 `docs/supabase/schema.sql`（两张表 + RLS + 触发器）；`community_attempts` 按规格可选未建，因此是两张表 |
| 6 | anon 只读 visible | **未验证** | 仅交付 SQL 策略；mock 模拟了 `status=eq.visible` 过滤（在线 5 道、缓存 6 道），不代表真实 RLS |
| 7 | 不能删他人/伪造 author_id | **未验证** | SQL 的 `with check (auth.uid()=author_id)` 与 delete `using` 已写；mock 会拒绝伪造/非作者删除，但未在真实库执行 |
| 8 | 举报 3 次隐藏 | **部分通过（mock）** | 3 个不同匿名身份举报“夹逼准则”后，列表从 6 变 5、该题消失；真实数据库触发器未执行 |
| 9 | 自动匿名用户可上传/做题/举报 | **部分通过（mock）** | 进入社区自动 signup；上传成功（7 道）、练习 5 题、举报成功；真实匿名开关未验证 |
| 10 | 升级后 ID 不变、投稿归属不变 | **部分通过（mock）** | 绑定邮箱 `upgrade-test@example.com` 前后 ID 尾号均为 `000005`；OAuth 需真实 Provider，未测 |
| 11 | 换设备登录管理；匿名提示 | **部分通过** | “我的投稿”明确提示匿名清缓存/换设备会丢失作者身份；真实跨设备登录未测 |
| 12 | A 上传 B 可见、A 删除 B 不再见 | **部分通过（mock）** | 多个匿名会话都看到同一列表；作者删除后 myCount 2→1、列表总数变化；真实双设备未测 |
| 13 | 表单校验、重复仅提示不阻断 | **通过** | 空表提交：4 个字段错误 + 全局提示且停留表单；同题干再交：成功且提示“检测到相同题干（#7）” |
| 14 | 不泄题、结算解析、错题来源 | **通过** | 作答页无 `.explanation-box`/“正确答案”；结算展示解析；错题 `source='community'`、错题本显示“社区”徽章，且不计入掌握度 |
| 15 | 社区 XP 每日上限；不影响主线 | **通过** | 5 对 +50、4 对 +40、再 5 对只剩 +10（累计 100，`capped=true`，提示“今日已达上限”）；社区练习未新增 `levelAttempts` |
| 16 | 离线缓存可看可做；上传/举报不可用 | **通过** | Supabase+静态服务器全停：缓存 6 题、离线横幅、随机 5 题可作答；上传返回“网络不可用”；列表离线时举报按钮禁用 |
| 17 | Supabase 不可达不影响主线 | **通过** | mock 关闭后社区页回退缓存/显示不可用，无白屏；主线首页、地图、刷题、结算、错题本正常；干净构建同样只显示不可用面板 |

### 本轮发现并修复的问题

1. **连续自评互相覆盖**：两解答题快速点“做对”时，第二次用旧 `run` 快照覆盖第一次，导致“完成自评”永远不可用。改为基于 `runRef` 的最新快照写入。
2. **社区结算后主线不刷新**：错题与 XP 已写库，但顶栏/错题本仍是启动快照。社区结算页与错题本挂载时刷新主线 store；实测顶栏 90→100/238。
3. **Supabase 不可达时社区页卡在“载入中”**：`bootstrap` 先等匿名登录且无超时。改为列表与登录并行，并给请求加 5 秒超时，失败回退缓存。
4. **离线无明确 UI**：真断网时上传按钮禁用并显示离线横幅；列表处于离线缓存时举报按钮禁用。
5. **自评页无退出入口**：补充“放弃本组”二次确认。

### 第一阶段回归范围（诚实说明）

- 已复测：题库结构/LaTeX、星级/XP/SM-2/解锁规则、主线在线与断网完整闭环、PWA 离线、备份导出/恢复（含社区缓存 6 条与会话）、492px 下社区列表无横向溢出、构建产物无密钥。
- **未逐条重跑**第一阶段 53 项：原审计脚本未入库；题库导入、键盘操作、错题试炼、390px 极窄屏、关闭重开持久化未在本轮重新执行。相关代码路径本轮未改动，但按“不伪造通过”原则不标记为已复测。
- 社区新页面只做了 492px Chromium 检查；真实 iOS/Android 与真实 Supabase 仍未实测。

### 真实环境阻塞（2026-11-04 追加）

用户提供了真实项目与 publishable key 后，配置与构建已完成：

- `.env.local` 写入项目 URL 与 legacy anon key（不提交）；`npm run build` 成功，URL 已在 `dist/assets/index-*.js` 中。
- **本机网络无法访问 Supabase**：同一 Node 进程里 `https://example.com`、`https://registry.npmjs.org` 返回 200，而 `https://chkkogrmletzjrwwjkzd.supabase.co` 与 `https://supabase.co` 均 `ECONNRESET`；Chrome 同样打不开；改用 Cloudflare 另一个 A 记录（172.64.149.246）+ 相同 SNI 仍然 reset；系统无代理配置（`netsh winhttp` 直连、无 7890/1080 等本地代理端口）。
- 因此 `npm run verify:supabase` 在“A 匿名登录”一步以 `fetch failed` 中断（退出码 2），**真实匿名登录、RLS、双设备、举报阈值未取得真实结果**，仍不能标为通过。
- 真实验收脚本已交付：[`scripts/verify-supabase.mjs`](scripts/verify-supabase.mjs)，`npm run verify:supabase`。它会创建 4 个匿名用户、上传 1 道测试题，验证：anon 只读 visible、B 可见 A 的题、伪造 author_id 被拒、B 删 A 的题无效、重复举报被唯一约束拒绝、3 次举报后 hidden、A 删除后所有人读不到；成功路径自动删除测试题（匿名用户会留下）。
- 恢复真实验收的条件：在这台电脑开启**全局**代理/VPN（浏览器插件不够，Node 也要走代理），或把脚本拿到能访问 Supabase 的网络运行。

### 结论

- 主线：**通过**（结构、算法、在线/离线闭环、XP/错题、构建安全）。
- 社区客户端链路：**通过（对照 mock）**，包括上传、筛选、练习、错题来源、XP 上限、举报隐藏、删除、升级 ID 保持、离线缓存与降级。
- 社区真实后端：**未验证**（项目与 key 已提供，但本机网络无法访问 supabase.co，验收未执行）。`docs/supabase/schema.sql` 与 `docs/supabase/README.md` 提供了可复现的建表、RLS、触发器、验证 SQL 与逐步手工验收方法。
