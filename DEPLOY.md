# 部署到 Vercel（GitHub + Vercel）

本文假设你在自己的电脑上操作，并且浏览器能访问 GitHub（必要时开代理）。

## 0. 安全前提

- `.env.local` 已被 `.gitignore` 忽略（`.env`、`.env.*`、`*.local`），**不要提交**。
- 只允许 anon key；`service_role` key 不得出现在仓库、构建产物、Vercel 环境变量或任何 `VITE_` 变量中。
- 仓库里已提供 `.env.example` 作为模板。

初始化后请务必检查：

```bash
git status --short
```

输出里不应出现 `.env.local`、`node_modules/`、`dist/`、`.tmp/`。

## 1. 安装 Git

- Windows：<https://git-scm.com/download/win> 下载安装，或 `winget install --id Git.Git -e`；
- macOS：`brew install git`；
- 验证：`git --version`。

## 2. 初始化并提交

在项目目录执行（把姓名/邮箱换成你的 GitHub 账号信息）：

```bash
cd "D:\高数闯关教程"
git init -b main
git config user.name "你的GitHub用户名"
git config user.email "你的GitHub邮箱"

git add .
git status --short
# 确认没有 .env.local / node_modules / dist / .tmp

git commit -m "feat: 高数闯关（主线 + 社区题库 + PWA）"
```

如果 `.env.local` 已经不小心进了暂存区：

```bash
git rm --cached .env.local
git commit -m "chore: stop tracking local env"
```

## 3. 在 GitHub 创建空仓库

浏览器打开 <https://github.com/new>：

- Repository name：例如 `gaoshu-quest`；
- 选择 Public 或 Private（Vercel 都能读）；
- **不要**勾选 “Add a README file”“Add .gitignore”“Choose a license”（保持空仓库，避免首推冲突）。

## 4. 推送

```bash
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

第一次推送会要求登录：浏览器弹窗登录 GitHub，或把 **Personal Access Token** 当密码粘贴（不要用账号密码）。推送成功后，仓库链接就是：

```
https://github.com/<你的用户名>/<仓库名>
```

如果 `github.com` 连接超时，需要给 Git 配代理（端口按你的代理软件实际填写，例如 7890）：

```bash
git config --global http.proxy  http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890
# 推送完成后可取消：
# git config --global --unset http.proxy
# git config --global --unset https.proxy
```

## 5. Vercel 导入

1. 打开 <https://vercel.com/new>，用 GitHub 登录并授权；
2. 选择刚推送的仓库 → Import；
3. 构建配置（`vercel.json` 已提供，通常自动识别）：

| 项 | 值 |
| --- | --- |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

4. 在 **Environment Variables** 添加（Production 与 Preview 都加）：

```
VITE_SUPABASE_URL=https://chkkogrmletzjrwwjkzd.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 legacy anon key>
```

5. Deploy。环境变量是**构建时注入**的，之后修改变量必须 Redeploy。

## 6. Supabase 侧

Supabase → Authentication → URL Configuration：

- Site URL：`https://calcpass.top`；
- Redirect URLs：
  - `https://calcpass.top/**`
  - `https://www.calcpass.top/**`

匿名登录不跳转，但邮箱确认、Google 绑定需要它。旧的 `*.vercel.app` 地址可暂时保留，确认新域名正常后再删除。

## 7. 上线后验证

1. 打开站点 → 社区：应自动匿名登录并拉到列表；
2. DevTools → Network 里 `/auth/v1/signup`、`/rest/v1/community_questions` 成功；
3. 上传一道题，另一台设备/另一个浏览器配置刷新可见；
4. 手机打开 HTTPS 地址 → 安装到主屏幕；断网后主线可开；
5. 两设备各自主线进度独立，社区题共享。

## 8. 绑定自定义域名 calcpass.top

### 为什么没有 SPA rewrite

项目使用 **hash 路由**（`/#/community`、`/#/wrong` 等）。浏览器刷新 `https://calcpass.top/#/community` 时，`#` 后面的部分不会发给服务器，Vercel 实际只请求 `/`，直接返回 `index.html`，所以**不需要** `rewrites` 兜底。

不要加 `"source": "/(.*)"` 这类全站 rewrite，它可能把 `/assets/*.js`、`/sw.js` 也改写成 HTML，反而制造 404/MIME 错误。

### Vercel 后台

1. 项目 → **Settings → Domains**；
2. 添加 `calcpass.top` 和 `www.calcpass.top`；
3. 把 `calcpass.top` 设为主域名，`www` 设为 **Redirect to calcpass.top**；
4. 按页面提示添加 DNS 记录；等待状态变成 **Valid Configuration**，HTTPS 证书会自动签发。

### 腾讯云 DNSPod

在域名所在账号的 **DNS 解析 → 记录管理** 中添加：

| 主机记录 | 类型 | 记录值 | TTL |
| --- | --- | --- | --- |
| `@` | A | `76.76.21.21`（以 Vercel Domains 页面显示为准） | 600 |
| `www` | CNAME | `cname.vercel-dns.com` | 600 |

- 删除 `@`/`www` 上冲突的旧 A/CNAME，保留邮箱 MX、TXT；
- 如果 Vercel 要求 TXT 验证，按它给的主机名和值添加；
- 域名需完成实名认证；Vercel 托管在境外，不需要 ICP 备案，但以后若改用腾讯云 CDN/服务器则需要。

### 环境变量

域名与 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 无关；这两个值仍然指向 Supabase 项目，不要改成 calcpass.top。Vercel 的 Production/Preview 环境变量改完后必须 **Redeploy**，因为 Vite 是构建时注入。

### 上线检查

1. `https://calcpass.top` 打开首页；
2. `https://calcpass.top/#/community` 刷新不 404；
3. 社区能匿名登录、列表/上传可用；
4. 手机可安装 PWA；
5. Supabase Authentication 的 Site URL/Redirect URLs 已改成新域名。

## 常见问题

- **社区显示“暂不可用”**：Vercel 没配 `VITE_*` 或配完没 Redeploy。
- **推送被拒 / 连接超时**：Git 没有走代理；给 `http.proxy`/`https.proxy` 配置，或换用能访问 GitHub 的网络。
- **首推被拒（non-fast-forward）**：创建仓库时勾了 README；删掉仓库重建空仓库，或先 `git pull --rebase origin main`。
- **部署后页面没更新**：Service Worker 缓存；硬刷新或清除站点数据，`sw.js` 已配置 no-cache。
- **构建 Node 版本**：Vercel 项目设置里选 Node 20/22；Netlify 会读 `.nvmrc`（20）。

## 不想装 Git 的替代方案

- **GitHub 网页上传**：在空仓库页点 “uploading an existing file”，拖入 `src`、`public`、`docs`、`scripts`、根目录配置与 Markdown 文件，**不要**拖 `node_modules`、`dist`、`.tmp`、`.env.local`；提交后同样可被 Vercel 导入。
- **Vercel CLI（不需要 GitHub）**：`npm i -g vercel` → `vercel login` → `vercel env add ...` → `vercel --prod`。适合只想尽快上线。
