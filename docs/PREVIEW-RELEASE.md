# 预览版下载 / Preview releases

## 中文

当前公开版本是 [v0.1.0-preview.1](https://github.com/TolkmisLK/mutual_chat/releases/tag/v0.1.0-preview.1)，固定在提交 `ee188da657bc69f398e4a9da7f9b5fdea8f139b8`。同一发布页提供四个文件：[Windows x64 ZIP](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-windows-x64.zip) 与 [`.sha256`](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-windows-x64.zip.sha256)，以及 [Web/嵌入 ZIP](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-web-embed.zip) 与 [`.sha256`](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-web-embed.zip.sha256)。此版本的应用 CI、PostgreSQL 恢复 CI 和发布工作流已在该提交通过；这不等于目标环境验收。

后续预览版仍须由维护者在当前 `main` 的 CI 全部通过后创建 `v0.1.0-preview.N` 标签。发布工作流只接受该标签与当前 `main` 指向同一提交、且这一提交有唯一一条成功的 `main` push CI；它只取该运行中的两个指定产物。标签早于 CI 完成、`main` 已前进、选中了 PR/旧提交或产物过期时会失败，不应通过改用另一条运行绕过。

下载后先在 PowerShell 执行 `Get-FileHash .\文件名.zip -Algorithm SHA256`，与相应 `.sha256` 中的值逐字比对。Windows ZIP 解压**整个** `MutualChat-win32-x64` 目录后运行 `MutualChat.exe`；该目录不是安装器，也不会自动更新。Web/嵌入 ZIP 包含 `app/` 独立站点、`widget/` ES 模块、`embed-host/` 示例、双语 `README.md`、嵌入接口说明 `EMBEDDING.md` 和 `LICENSE`；部署完整站点时保留其 `assets/`。只拿 `widget/mutual-chat.js` 的宿主还须按 [嵌入指南](EMBEDDING.md) 自行提供 SDK、RustCrypto WASM、登录、同步及凭据管理。

此通道只延长下载可用性并提供固定标签与 SHA-256 校验，不改变应用验收范围。Windows 包未签名，没有自动更新；干净机器启动、真实远程 Matrix/TLS、物理设备和生产通信尚未验收。首次密钥备份与跨签名仍不完整，不要把唯一的加密历史副本保留在预览客户端。详见 [桌面说明](DESKTOP.md)和 [验证记录](VALIDATION.md)。

## English

The published version is [v0.1.0-preview.1](https://github.com/TolkmisLK/mutual_chat/releases/tag/v0.1.0-preview.1), fixed at commit `ee188da657bc69f398e4a9da7f9b5fdea8f139b8`. Its four assets are the [Windows x64 ZIP](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-windows-x64.zip) and [`.sha256`](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-windows-x64.zip.sha256), plus the [Web/embedded ZIP](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-web-embed.zip) and [`.sha256`](https://github.com/TolkmisLK/mutual_chat/releases/download/v0.1.0-preview.1/mutual-chat-0.1.0-preview-web-embed.zip.sha256). Application CI, PostgreSQL recovery CI, and the publishing workflow passed for this commit; this does not establish target-environment acceptance.

For later previews, the maintainer must tag the current `main` commit after its CI passes, using `v0.1.0-preview.N`. The publishing workflow requires the tag to resolve to the current `main` HEAD and exactly one successful `main` push CI run for that SHA; it downloads only the two named artifacts from that run. It fails if CI is unfinished, `main` moved, a PR or older run is selected, or an artifact expired.

Compare each ZIP with its matching `.sha256` before extraction (`sha256sum -c file.zip.sha256` on a Unix shell). Extract the entire `MutualChat-win32-x64` directory from the Windows ZIP, then run `MutualChat.exe`. It is not an installer and has no auto-update. The Web/embedded ZIP contains the standalone `app/`, ES module `widget/`, sample `embed-host/`, bilingual `README.md`, API guide `EMBEDDING.md`, and `LICENSE`; keep each deployed site's `assets/`. A host copying only `widget/mutual-chat.js` must supply the SDK, RustCrypto WASM, login, sync, and credential lifecycle as described in the [embedding guide](EMBEDDING.md).

This channel gives a durable tagged download and checksum, not a wider acceptance claim. The Windows app is unsigned and has no update channel. Consumer clean-machine startup, real remote Matrix/TLS, physical devices, and production communications remain unaccepted. First key backup and cross-signing are incomplete; do not keep the only copy of encrypted history in this preview. See [desktop details](DESKTOP.md) and [validation evidence](VALIDATION.md).
