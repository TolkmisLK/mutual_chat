# 开发路线与验收门槛

`packages/chat-core` 是与 UI 框架无关的会话层，`packages/chat-ui` 提供样式隔离的嵌入面板，`src` 是独立应用；身份、房间、事件历史由 Matrix 服务器管理，同步、事务 ID、重试和 RustCrypto 加密交给官方 SDK。不得自造加密或把 UI 测试当作加密互通证明。

已完成的阶段性验证包括：本机 Synapse 双用户加密与重启、回环 PostgreSQL 恢复演练；可选本机会话恢复、已有远程备份密钥恢复、同帐号设备 SAS 核对；邀请、文字消息、历史分页、私人已读、本地已加载消息搜索和本人消息撤回；Windows 打包启动、Linux Electron 加密互通；以及嵌入宿主的共享会话、切页和延迟发送。每项的具体 CI 与边界以 [VALIDATION.md](VALIDATION.md) 为准，不能合并理解为正式发布验收。

下一步包括首次备份与跨签名设置、联系人身份核对、长历史窗口、可信附件、生产级 TLS/异地加密备份、Windows 实际 Matrix 互通、消费者设备与移动端生命周期。首次备份不得直接使用会重置现有备份版本的 SDK 路径；需先验证部分初始化、并发设备和忘记恢复密钥的情况。公开上线前还需受控帐号发放、运维监测、安全审查与真实设备检查。

发布门槛：锁定依赖与可重现构建；核心/UI/真实服务器加密及多设备恢复验证；独立应用与嵌入模块均能运行且卸载不影响宿主；可信 TLS、存储及备份恢复；桌面和移动包实际验收。构建成功或单一 CI 通过都不代表稳定版，当前未发布稳定版。

---

# Delivery and acceptance roadmap

## Architecture

`packages/chat-core` provides a framework-neutral session boundary; `packages/chat-ui` mounts a style-isolated panel; `src` is the standalone application shell. Both UI forms share the same session logic. A Matrix homeserver owns identities, room membership and durable event history. The official Matrix SDK owns sync, local echoes, retries, transaction IDs and Rust-based encryption.

Reference: [Matrix SDK documentation](https://matrix-org.github.io/matrix-js-sdk/index.html), including its explicit single-client-per-crypto-database requirement. Do not implement custom cryptography or treat UI tests as encryption interoperability tests.

## Next development slices

1. Local reproducible Synapse 1.160.0 deployment, restricted test-account bootstrap, persisted storage and two-user encrypted browser/restart tests passed (see VALIDATION.md). PostgreSQL 17.11 loopback deployment and independent SQL/media/signing-key restore rehearsal also passed. Next: trusted TLS staging, restricted operator provisioning and encrypted offsite backup retention.
2. Opt-in encrypted local session restoration, existing remote-backup recovery and standalone same-account SAS verification passed real-server browser tests (see SESSION-SECURITY.md, RECOVERY.md, DEVICE-VERIFICATION.md and VALIDATION.md). Next: first-time backup setup, cross-signing setup and contact identity verification. Never use a backup-reset API as an unguarded first-time initializer: the locked SDK's reset path deletes existing backup versions. Test partial setup, competing clients and forgotten-recovery-key paths before enabling setup for users.
3. Two-user encrypted messages, invites, reconnect, duplicate-send behavior, explicit backward pagination, private read receipts, bounded local search and own-message redaction passed their recorded gates. Pagination currently stops at 1,000 rendered messages; full timeline-window navigation and safe authenticated chat attachments remain. PostgreSQL's media restore test is not a chat-attachment UI feature.
4. Standalone Windows x64 packaging/startup and Linux native encrypted exchange/profile-restart passed PR #7 gates, with sandboxing retained. Next: Windows native Matrix and consumer-machine checks, accessible distribution/signing/update policy, and mobile wrapper with secure token storage and lifecycle handling. Never embed tokens in builds or source code.
5. A separate host example consumes the built module; real-browser mount/unmount, shared sessions, pending encrypted sends, host navigation and authentication ownership passed (see EMBEDDING.md and VALIDATION.md). Next: retained drafts and framework-specific adapters as needed.
6. Contact/block/report controls and server-side access restrictions appropriate to an invite-only initial deployment. Voice/video calls and Telegram protocol interoperability are not initial release requirements.

## Release gates

- Reproducible locked build, automated core/UI/integration tests and dependency audit.
- Real homeserver tests for encrypted delivery, multi-device verification and key recovery.
- Windows desktop and Android package validation; iOS signing/device acceptance requires an authorized Apple environment.
- Independent application and embedded module both work; unmount never logs out the host or leaks listeners.
- Reviewed browser/mobile UI, bounded timeline memory, stable reconnect and explicit failure states.
- Deployed staging service with verified TLS, persistence, backup restoration and observability; no paid infrastructure purchased without authorization.
- Clearly separate tested functionality from remaining gates. Do not publish a stable release merely because the bundle compiles.
