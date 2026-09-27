# PostgreSQL 本机部署与恢复演练

这是**仅回环地址**的开发部署，不是公共服务。需 Docker Compose、Node.js 24 和足够磁盘空间；现有 SQLite 数据不会迁移。固定镜像为 Synapse 1.160.0 与 PostgreSQL 17.11。数据库为 UTF-8、`C` 排序规则，Synapse 使用非超级用户；PostgreSQL 不发布宿主端口，Matrix 客户端仅监听 `127.0.0.1`。Docker 桥接流量未做 TLS 加密。

在仓库外准备已存在的私有父目录，再按顺序初始化、启动、备份、恢复到**全新**目录并停止：

```sh
node tool/postgres-server.js init /private/chat-pg 18018
node tool/postgres-server.js up /private/chat-pg
node tool/postgres-server.js snapshot /private/chat-pg /private/chat-backup-001
node tool/postgres-server.js restore /private/chat-backup-001 /private/chat-restore-001 18019
node tool/postgres-server.js stop /private/chat-restore-001
node tool/postgres-server.js stop /private/chat-pg
```

初始化/恢复拒绝已存在的目标目录；`stop` 保留数据，不删除卷。命令通过独占实例锁避免并行操作；崩溃后可能留下锁，须先人工确认无操作或容器转换仍在进行，不能靠猜 PID 或强制删锁。备份先暂停 Synapse，转储 PostgreSQL，再复制配置、签名密钥和媒体，然后重启源服务，期间会停机；一次性加密密钥行按 Synapse 指南排除。恢复校验转储摘要与版本，只向空数据库执行事务性导入；恢复实例保留同一服务器身份，不可与源实例一起作为同一个公开服务器暴露。

备份含数据库凭据、注册密钥、访问令牌和私有签名密钥，须限制目录权限并只恢复可信快照。SHA-256 只检测意外损坏，不提供防篡改认证；备份未加密也未做异地保存，不含浏览器持有的加密密钥。恢复前写入 `restore.pending`，只有 `pg_restore` 事务成功才移除；失败时禁止 `up` 和 `snapshot`，保留现场，重新恢复到新目录，**不要**删标记强行启动。该保护只覆盖协作命令，不覆盖手动 Docker 操作或硬件故障。

可运行 `npx playwright test --config playwright.postgres.config.js` 进行隔离的真实 Chromium/Synapse/PostgreSQL 演练。PR #11 与 #13 的相关 CI 记录见 [VALIDATION.md](VALIDATION.md)。可信远端 TLS、受控帐号发放、异地加密备份、磁盘监控与独立安全审查仍需完成。

---

# PostgreSQL deployment and recovery rehearsal

This is an isolated, **loopback-only development deployment**, not a publicly hosted service. Docker Compose, Node 24 and sufficient disk space are required. Existing SQLite data is not migrated. Never use the fixture account-registration secret on a public listener.

Pinned images: Synapse 1.160.0 and PostgreSQL 17.11 (the supported PostgreSQL 17 minor listed by upstream when checked on 2026-09-17). The database has UTF-8 encoding and `C` collation. Synapse uses a separate, non-superuser database role. PostgreSQL publishes no host port; the Matrix client listener binds only `127.0.0.1`. Docker bridge traffic is not TLS-encrypted: this does not constitute trusted remote TLS staging.

Use new private directories **outside this checkout**; their parents must already exist:

```sh
node tool/postgres-server.js init /private/chat-pg 18018
node tool/postgres-server.js up /private/chat-pg
node tool/postgres-server.js snapshot /private/chat-pg /private/chat-backup-001
node tool/postgres-server.js restore /private/chat-backup-001 /private/chat-restore-001 18019
node tool/postgres-server.js stop /private/chat-restore-001
node tool/postgres-server.js stop /private/chat-pg
```

Initialization and restoration refuse existing destination directories. Each instance records a random Compose project identifier, owning an independent named database volume. `stop` retains data. The command has no delete-volume or overwrite-source action. A failed init/restore is left for administrator inspection; do not reuse its directory or remove volumes until confirming their ownership.

Cooperating up/stop/snapshot/restore commands acquire an exclusive instance lock. Concurrent commands fail rather than restarting a source while another snapshot is copying media. A crash may leave the lock: no automatic stealing/removal or PID killing is performed. An administrator must first verify that no operation or container transition remains active before manually recovering a stale lock. This does not coordinate manual Docker commands, other hosts or network filesystems.

Snapshot pauses Synapse, creates a PostgreSQL custom-format dump, copies configuration/signing keys/media and then restarts the source. Application downtime is expected. Following Synapse guidance, one-time encryption-key rows are excluded to prevent old keys being reissued. Snapshot completion is marked only after the dump and file copy finish. Restoration checks the dump digest and pinned version, starts only a fresh PostgreSQL volume, checks that its public schema is empty, restores transactionally and finally starts the copied Synapse. The restore port can differ, while server identity and signing key remain the same. Never expose both copies as one public homeserver.

Backups contain **database credentials, registration secrets, access tokens and private signing keys**. The directory is mode 0700 on POSIX. Configuration and dumps are mode 0600; two read-only PostgreSQL bootstrap files are mode 0444 inside that private directory so the container's PostgreSQL UID can read their explicit file mounts. Other host users cannot traverse the 0700 parent. Windows requires appropriate filesystem ACLs. These are not encrypted/offsite backups. SHA-256 detects accidental dump corruption, not malicious changes; restore only trusted snapshots controlled by the server administrator. The database dump does not include browser-held encryption keys or replace the client's recovery key. Media/config copies are not a general hostile-archive importer.

Restoration writes `restore.pending` before copying configuration or creating the database. It removes that marker only after `pg_restore` confirms its single transaction succeeded. `up` and `snapshot` refuse any instance with the marker still present, even if `instance.json` exists; `stop` remains available. This prevents a failed restore followed by `up` from initializing an empty replacement homeserver. Preserve failed state for investigation and retry the trusted backup into a new directory. Do not remove the marker to force startup. A crash after database commit but before marker removal deliberately requires the same conservative recovery. This is an application guard for cooperating commands, not protection against manual Docker operations or physical storage failure.

## Acceptance

`npx playwright test --config playwright.postgres.config.js` creates unique disposable projects and directories, runs actual Chromium users against Synapse/PostgreSQL, uploads generated media, rehearses restore into an independent database, checks ciphertext event IDs and authenticated media bytes, confirms one-time-key exclusion and verifies the source still exchanges encrypted messages. Cleanup removes only those generated projects/volumes. No trace, SQL, service data or secret-bearing report is uploaded. The final PR #11 candidate passed the dedicated real-service scenario in 1.0 minute and all application checks; exact commits and evidence are recorded in [VALIDATION.md](VALIDATION.md).

Still required for deployment: authorized hostname and trusted TLS, restricted account provisioning, remote/offsite encrypted backup retention, disk monitoring, restore-time objectives, hardening for the deployment host and independent security review. No public deployment or paid resource was created.

References: [Synapse PostgreSQL setup](https://element-hq.github.io/synapse/latest/postgres.html), [Synapse backup requirements](https://element-hq.github.io/synapse/latest/usage/administration/backups.html), [PostgreSQL pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [supported versions](https://www.postgresql.org/support/versioning/).
