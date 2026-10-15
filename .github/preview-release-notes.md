## 中文

开发预览版，非稳定通信产品。Windows ZIP 是未签名的 Electron x64 完整目录；解压完整目录后运行 `MutualChat.exe`。Web/嵌入 ZIP 分别包含 `app/` 独立页面、`widget/` ES 模块和 `embed-host/` 示例。部署页面需保留对应的 `assets/`；嵌入模块的登录、同步、加密数据库、WASM 与凭据生命周期由宿主管理。请先核对随附 `.sha256`。使用步骤与限制见仓库 `README.md`、`docs/DESKTOP.md` 和 `docs/EMBEDDING.md`。

本包没有签名、自动更新、内置公共 Matrix 服务或移动客户端。CI 验证不等于消费者 Windows 干净机器、真实远程 HTTPS、手机或生产通信验收。缺少首次密钥备份/跨签名等能力时，不应依赖它保存唯一的加密历史副本。

## English

Development preview, not a stable communications product. The Windows ZIP is an unsigned Electron x64 directory; extract the whole directory and run `MutualChat.exe`. The Web/embedded ZIP contains the standalone `app/`, ES module `widget/`, and sample `embed-host/`. Keep each app's `assets/`; the embedding host owns login, sync, crypto database, WASM, credentials, and their lifecycle. Check the accompanying `.sha256` files. See `README.md`, `docs/DESKTOP.md`, and `docs/EMBEDDING.md` for setup and limits.

There is no signing, auto-update, public Matrix server, or mobile client. CI is not consumer Windows clean-machine, real remote HTTPS, phone, or production acceptance. Do not keep the only copy of encrypted history in this preview before backup and device-trust flows are complete.
