# GitHub → Vercel + Neon 部署说明

推荐：GitHub 保存代码，Vercel 部署网页和账号接口，Neon PostgreSQL 保存账号数据。**无需另购服务器；PDF 始终在浏览器压缩，账号数据库不保存 PDF。** 配置和代码已准备，不代表已创建 Neon、连接 Vercel 或验证真实邮件。

## 费用和区域

- Neon Free 在 2026-10-19 查阅的官方标准中，每项目含 1 GB 存储、每月 100 CU-hours 计算额度。它是有限额免费方案，不能承诺永久免费或无限用户。增长后重新评估。[官方价格](https://neon.com/pricing)
- Vercel Hobby 限个人非商业用途。项目计划收费，商业运营应使用允许商业用途的计划，并核算 Functions、流量等费用。Neon 免费不意味着整个商业网站零成本。[官方说明](https://vercel.com/docs/plans/hobby)
- Neon 和账号 Function 应选相近区域；在 Vercel 项目设置中选择与 Neon 接近的 Function 区域。静态网页仍使用 CDN。

## 1. GitHub 和 Vercel

仓库：[zhi168168/compresser-pdf](https://github.com/zhi168168/compresser-pdf)。代码推送后，在 Vercel 选择 Add New Project → Import 此仓库。

| 项目 | 配置 |
| --- | --- |
| Framework | Vite |
| Root Directory | `.`，不要选 server |
| Node.js | 22.x 或项目支持的更新版本 |
| Package manager | pnpm 11.19.0 |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm build` |
| Output | `dist` |

可先不配置账号密钥部署网页，取得稳定域名；账号未配置时压缩仍可用。生产建议绑定正式域名，并选定唯一 www/非 www canonical origin。下文示例必须替换成实际域名。

## 2. 创建 Neon 数据库

在 Neon 新建项目和 PostgreSQL 数据库。复制控制台 **pooled connection string**（主机通常含 -pooler），保留 `sslmode=require` 等 TLS 参数，作为 `DATABASE_URL`。另复制直接连接作为可选 `DIRECT_DATABASE_URL`，仅供迁移使用。

不要将连接字符串放入仓库、前端或公开聊天。数据库仅保存账号、会话、验证/OAuth 和限流记录。免费方案的备份和恢复有配额及保留期限制，上线前确认实际权益；定期做加密逻辑备份并测试恢复到独立数据库。

## 3. 配置 Vercel 环境变量

在 Settings → Environment Variables 设置，**只选 Production**。Preview 保持 noindex，不应自动接入生产账号库。不要使用 `VITE_*` 暴露密钥。

| 变量 | 用途 |
| --- | --- |
| `SITE_URL` | 正式网站 HTTPS origin，SEO 构建 |
| `PUBLIC_SITE_URL` | 与上面完全一致，认证和邮件回调 |
| `DATABASE_URL` | Neon pooled TLS 连接 |
| `BETTER_AUTH_SECRET` | 至少 32 字符独立随机密钥，后续部署保留 |
| `SMTP_HOST` / `SMTP_PORT` | 邮件服务器，通常 587 或 465 |
| `SMTP_USER` / `SMTP_PASS` | 邮件服务凭据，成对配置 |
| `SMTP_FROM` | 已验证发信地址，与 SMTP_HOST 配套 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google 登录，必须成对配置 |

PowerShell 可运行以下命令生成 auth secret，然后安全保存：

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

两个 URL 都是固定 origin，例如 `https://compresser.example`，不带路径、查询或凭据。变更生产环境变量后重新部署。不要复用数据库或邮件密码作为 auth secret。

## 4. 显式初始化数据库

迁移不在 Vercel build、每个请求或 GitHub CI 中自动执行。升级先备份并审核变化。

```powershell
pnpm --dir server install --frozen-lockfile --ignore-workspace
```

复制根 `.env.example` 为被 Git 忽略的 `.env.local`，填写生产数据库、正式 origin 和 auth secret。若有 `DIRECT_DATABASE_URL`，脚本优先使用它；否则使用 `DATABASE_URL`。从项目根运行：

```powershell
node --env-file=.env.local scripts/migrate.mjs
```

成功后重新部署 Vercel。不要把生产连接用于测试；普通测试使用一次性 PGlite，不需要生产凭据。

## 5. 邮件与 Google

SMTP 是邮箱注册、验证和找回密码的依赖；缺失时功能禁用。添加服务商要求的 SPF、DKIM、DMARC，测试真实收件箱及垃圾箱。邮件免费额度需另行确认。

Google Cloud Console 创建 OAuth Web application，配置同意屏幕。若正式网站为 `https://compresser.example`：

- JavaScript origin：`https://compresser.example`
- Redirect URI：`https://compresser.example/api/auth/callback/google`

不是 Neon 域名，也不是另一个账号域名。检查 OAuth 测试/发布状态，不要信任任意 Preview 域名。默认邮件法语，英文页面对应英语。

## 6. 上线验收

1. 法语首页、英文 /en/、指南及隐私页正常；正式 canonical、hreflang、sitemap、robots 与域名一致，Preview 继续 noindex。
2. /api/auth/config 正确返回能力，缺配置时禁用，不泄露密钥。
3. 真实跑通注册 → 验证邮件 → 登录 → 保持会话 → 退出；找回密码后旧会话失效。
4. 真实 Google 登录和 HTTPS Cookie 正常；跨来源和频繁失败登录被限制。
5. Network 检查选择、压缩、预览、下载不上传 PDF，账号请求不携带文件名或预览。
6. 监控账号错误、SMTP 和 Neon 配额，屏蔽 token、Cookie、密码、邮件链接查询及连接串。
7. 根据 [OPERATIONS.md](OPERATIONS.md) 启用每日加密备份并做隔离恢复演练；根据 [MONITORING.md](MONITORING.md) 创建外部监控。验证「我的账户」中的邮件确认删除流程和隐私联系方式。

CI 通过不等于真实服务已联调。GitHub Actions 只测试/构建，不持有部署或数据库密钥；连接 GitHub 后由 Vercel 自动部署。
