# 聊聊 Web / 嵌入预览包

这个 ZIP 含 `app/` 独立 Web 站点、`widget/mutual-chat.js` ES 模块、`embed-host/` 宿主示例及许可证。先将 ZIP 与发布页同名 `.sha256` 核对。部署独立页面时，托管完整 `app/` 目录并保留其中 `assets/`；示例宿主同理托管完整 `embed-host/`，其构建路径以站点根目录为准。请使用可信 HTTPS 或 localhost，并检查 Matrix 服务的 CORS 和宿主 CSP。仅复制 widget 模块不会获得可运行的聊天：宿主须自行提供 Matrix SDK、RustCrypto WASM、client 创建、登录、同步、加密数据库和凭据生命周期。

这是开发预览，不含公共 Matrix 服务；尚未经过真实远程 TLS、生产通信或首次密钥备份/跨签名完整验收。不要用它保存唯一的加密历史副本。详细嵌入接口和限制见同包的 `EMBEDDING.md`；其中指向其他指南与源码示例的链接会打开本次发布提交对应的 GitHub 页面，其他指南不随 ZIP 附带。当前下载版本以本次 GitHub Release 页面为准。

# Mutual Chat Web / embedded preview

This ZIP contains the standalone `app/` website, the `widget/mutual-chat.js` ES module, an `embed-host/` example, and the license. Check the ZIP against its matching `.sha256` Release asset first. Host the whole `app/` directory, including `assets/`; likewise, keep all of `embed-host/` for the sample, which expects a site-root path. Use trusted HTTPS or localhost, and verify your Matrix server's CORS and host CSP. Copying only the widget module does not make a working client: the host must provide the Matrix SDK, RustCrypto WASM, client creation, login, sync, crypto database, and credential lifecycle.

This is a development preview with no included public Matrix server. Real remote TLS, production communication, and complete first key backup/cross-signing remain unaccepted. Do not keep the only copy of encrypted history here. The enclosed `EMBEDDING.md` documents the API and further limits; its links to other guides and source examples open GitHub at this release's exact commit. Those other guides are not included in this ZIP. Use this release's GitHub page for its download version.
