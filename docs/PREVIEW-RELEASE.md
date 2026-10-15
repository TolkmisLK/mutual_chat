# 预览版下载 / Preview releases

## 中文

预览版发布后，可在 [GitHub Releases](https://github.com/TolkmisLK/mutual_chat/releases) 下载固定版本的四个文件：Windows x64 ZIP、对应 `.sha256`、Web/嵌入 ZIP、对应 `.sha256`。提交或 CI 构建成功本身不会自动产生 Release；维护者还须在当前 `main` 提交的 CI 全部通过后创建符合 `v0.1.0-preview.N` 格式的标签。发布工作流只接受该标签与当前 `main` 指向同一提交、且这一提交有唯一一条成功的 `main` push CI；它只取该运行中的两个指定产物。标签早于 CI 完成、`main` 已前进、选中了 PR/旧提交或产物过期时会失败，不应通过改用另一条运行绕过。

下载后先在 PowerShell 执行 `Get-FileHash .\文件名.zip -Algorithm SHA256`，与相应 `.sha256` 中的值逐字比对。Windows ZIP 解压**整个** `MutualChat-win32-x64` 目录后运行 `MutualChat.exe`；该目录不是安装器，也不会自动更新。Web/嵌入 ZIP 包含 `app/` 独立站点、`widget/` ES 模块和 `embed-host/` 示例；部署完整站点时保留其 `assets/`。只拿 `widget/mutual-chat.js` 的宿主还须按 [嵌入指南](EMBEDDING.md) 自行提供 SDK、RustCrypto WASM、登录、同步及凭据管理。

此通道只延长下载可用性并提供固定标签与 SHA-256 校验，不改变应用验收范围。Windows 包未签名，没有自动更新；干净机器启动、真实远程 Matrix/TLS、物理设备和生产通信尚未验收。首次密钥备份与跨签名仍不完整，不要把唯一的加密历史副本保留在预览客户端。详见 [桌面说明](DESKTOP.md)和 [验证记录](VALIDATION.md)。

## English

After a preview is published, [GitHub Releases](https://github.com/TolkmisLK/mutual_chat/releases) provides four fixed assets: a Windows x64 ZIP and `.sha256`, and a Web/embedded ZIP and `.sha256`. A commit or successful CI run alone does not publish a Release. The maintainer must tag the current `main` commit after its CI passes, using `v0.1.0-preview.N`. The publishing workflow requires the tag to resolve to the current `main` HEAD and exactly one successful `main` push CI run for that SHA; it downloads only the two named artifacts from that run. It fails if CI is unfinished, `main` moved, a PR or older run is selected, or an artifact expired.

Compare each ZIP with its matching `.sha256` before extraction (`sha256sum -c file.zip.sha256` on a Unix shell). Extract the entire `MutualChat-win32-x64` directory from the Windows ZIP, then run `MutualChat.exe`. It is not an installer and has no auto-update. The Web/embedded ZIP contains the standalone `app/`, ES module `widget/`, and sample `embed-host/`; keep each deployed site's `assets/`. A host copying only `widget/mutual-chat.js` must supply the SDK, RustCrypto WASM, login, sync, and credential lifecycle as described in the [embedding guide](EMBEDDING.md).

This channel gives a durable tagged download and checksum, not a wider acceptance claim. The Windows app is unsigned and has no update channel. Consumer clean-machine startup, real remote Matrix/TLS, physical devices, and production communications remain unaccepted. First key backup and cross-signing are incomplete; do not keep the only copy of encrypted history in this preview. See [desktop details](DESKTOP.md) and [validation evidence](VALIDATION.md).
