# 账号数据库备份与恢复

## 当前启用状态

仓库已提供每日加密备份工作流和恢复工具，**并不表示已经完成线上备份**。必须配置 GitHub Secrets，手动运行一次成功，再确认可下载加密产物。工具不会在网站请求、Vercel 构建或部署时修改数据库。

## 首次启用备份

1. GitHub 仓库 → Settings → Secrets and variables → Actions，添加 Repository secrets：
   - `DB_BACKUP_URL`：Neon 生产数据库连接 URL，保留 `sslmode=require` 或更严格 TLS 参数。建议单独的只读账号；不要将其放在公开变量或代码中。
   - `BACKUP_ENCRYPTION_KEY`：32 字节密码学随机密钥，表示为 64 位十六进制字符串。与 `BETTER_AUTH_SECRET` 使用不同值。
2. 在自己的 PowerShell 中一次性生成备份密钥，不要把输出发到聊天、提交仓库或写入日志：

   ```powershell
   $backupBytes = New-Object byte[] 32; $backupRng = [System.Security.Cryptography.RandomNumberGenerator]::Create(); $backupRng.GetBytes($backupBytes); $backupRng.Dispose(); ([System.BitConverter]::ToString($backupBytes)).Replace('-', '').ToLowerInvariant()
   ```

3. 把密钥另存到可信的密码管理器，限制 GitHub 仓库和 Actions 的管理权限。只有密文而丢失密钥无法恢复。
4. GitHub → Actions → **Encrypted account backup** → Run workflow，确认绿色成功且出现 `encrypted-account-backup-…` artifact。下载留作首次恢复演练。
5. 手动执行成功后，在同一页面的 Variables 标签添加 Repository variable：`ACCOUNT_BACKUPS_ENABLED` = `true`，启用每天 UTC 03:23（北京时间 11:23）的任务。未设置此开关时，定时任务跳过，仍可手动运行。GitHub 调度可能延迟或漏跑；公开仓库长期无活动时也可能暂停定时任务。不要将它视为严格的可用性或恢复时间承诺。开启 GitHub Actions 失败通知，并每日确认最近一次成功时间。

尚未配置 Secrets 时，手动执行会明确失败并标记未启用，不会假装备份成功。免费 Actions 的分钟和产物存储也有额度，以 GitHub 当前套餐为准；不要为了备份公开账号数据。

### 建议的只读数据库账号

可由管理员在 Neon SQL Editor 创建专用角色。以下为模板，密码占位符须替换为独立随机密码，不要使用网站账号密码；数据库名称按实际修改：

```sql
CREATE ROLE account_backup LOGIN PASSWORD '<独立随机密码>';
GRANT CONNECT ON DATABASE neondb TO account_backup;
GRANT USAGE ON SCHEMA public TO account_backup;
GRANT SELECT ON TABLE public."user", public.account TO account_backup;
```

将连接字符串中的用户、密码替换为此角色后设置 `DB_BACKUP_URL`，密码中的特殊字符必须 URL 编码。只读角色仅需读取两张数据表和可见的 schema 元数据，不需要任何写入权限。**不要修改网站使用的 `DATABASE_URL` 账号**。如果暂时使用原管理员连接，备份能运行，但权限较大，应尽快改用只读连接。

## 内容、安全和保留期限

- 在 PostgreSQL `REPEATABLE READ READ ONLY` 事务内读取一致快照，备份 `user` 和 `account`：邮箱、资料、验证状态、密码哈希、Google 关联身份及可能存储的凭据。
- 不包含 PDF。也不备份 `session`、`verification`、`rateLimit`；恢复后需重新登录，旧验证或重置链接不会因此复活。
- 保存格式版本、创建时间、GitHub 源码提交（若存在）和五张账号表的列/类型/可空性元数据，用于恢复时核对 schema。
- 每次使用独立随机 nonce，通过 AES-256-GCM 加密并验证完整性；磁盘和 GitHub artifact 仅写入加密文件，未写入明文临时备份。
- artifact 设置 **7 天**保留。不要把手动下载文件永久保存；下载副本、旧密钥和恢复演练库也须纳入同样的清理规则。密钥轮换时需要保留旧密钥直到对应备份过期，否则旧备份无法恢复。
- 账户删除在在线库立即生效，旧加密备份可能仍保留最多 7 天。发生恢复时必须在重新开放服务前重新应用备份时间之后的删除请求，防止已删除账号复活。删除请求台账仅记录恢复核对所需的最小标识，访问受控；不能直接将旧备份恢复为线上库。
- 这属于账号逻辑备份，不是完整 PostgreSQL 集群、角色、任意未来业务表或 Neon 整个项目的镜像。未来增加付费/订阅表时，必须同步扩展并演练备份；不能依赖本工具恢复支付账务。

## 恢复演练 / 故障恢复

**只恢复到单独新建、隔离的空数据库，不覆盖生产，不删除或清空现有数据。** Neon 从生产数据克隆的有数据 branch 不符合条件。

1. 暂停对外恢复切换，保留故障库，下载一个最近且可信的加密 artifact。使用备份对应源码版本的迁移代码。
2. 在隔离库先执行应用的 `db:migrate`，明确确认迁移的 `DATABASE_URL` / `DIRECT_DATABASE_URL` 均指向隔离库，不是生产。迁移所需站点地址和 auth 密钥也在仅本机的环境配置中提供。不要为此改 Vercel 线上环境变量。
3. 使用当前终端环境变量设置 `RESTORE_DATABASE_URL` 为隔离库、`BACKUP_ENCRYPTION_KEY` 为对应备份密钥。不要将密钥或连接字符串写进会提交的文件、截图或命令历史；可通过被 Git 忽略的本机环境文件加载。
4. 明确确认并执行（路径替换为下载的 `.enc` 文件）：

   ```powershell
   $env:RESTORE_CONFIRM = 'EMPTY_ISOLATED_DATABASE'
   node scripts/restore.mjs 'C:\安全目录\accounts-backup.enc'
   Remove-Item Env:RESTORE_CONFIRM
   ```

   也支持 `node --env-file=.env.restore.local scripts/restore.mjs '路径'`，文件应包含仅用于隔离恢复的变量。`.env.*` 已被 Git 忽略。不要让恢复终端继承生产数据库的迁移变量。

5. 工具先解密验证，再锁定五张账号表、检查 schema 完全一致且所有表为空，事务内恢复 `user` → `account`。任一插入失败回滚全部插入；已有记录时拒绝执行，绝不 drop/truncate/覆盖。
6. 核对账号数、抽测测试账号登录、重新应用删除台账、确认没有旧 session/verification。记录备份时间、恢复耗时、核对结果，不记录密码哈希、令牌、连接串或密钥。
7. 通过验收后由管理员有计划地切换生产连接，重新部署并验证；此步骤不是脚本自动执行的。演练后删除隔离库、下载副本及本机临时环境文件。

至少每季度执行一次隔离恢复演练。每日备份理论上最多丢失约一天新增数据；调度或备份失败会延长此窗口，实际恢复时间需通过演练确认。Neon 自身的恢复窗口按当前套餐核实，不作为此逻辑备份的替代。
