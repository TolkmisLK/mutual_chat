# 聊聊嵌入接入工程 / Embedded host starter

本目录是可运行的原生 JavaScript 宿主：登录、SDK 与加密存储由宿主管理，聊天模块负责界面。它展示共享会话、面板独立适配层和页面切换；不会提供测试帐号，需使用自己的 Matrix 测试服务器与帐号。

## 一条命令启动

在**仓库根目录**，使用 Node.js 22.12 或更新版本：

```sh
npm ci --ignore-scripts
npm run example:embed
```

命令构建模块、独立应用和宿主，然后在 `http://127.0.0.1:14174` 启动宿主预览。端口被占用时直接报错，不终止其他进程。终端按 Ctrl+C 停止预览；先在页面退出帐号，以便服务器撤销本次登录。

可选：将本目录 `.env.example` 复制为 `.env`，把 `VITE_MATRIX_HOMESERVER` 改成自己的服务器地址，再执行启动命令。此变量只预填地址，连接仍需点击确认。**所有 VITE 变量在构建后公开可见，不得放密码、令牌或恢复密钥。** `.env` 不提交 Git。远程服务器须使用可信 HTTPS；回环测试地址可用 HTTP。

## 移入自己的应用

1. 从 `main.js` 理解客户端初始化与清理顺序；将页面登录替换成自己的认证流程。示例只在内存保留令牌，每次登录创建新设备。
2. 在已初始化 RustCrypto、启动同步的客户端上调用 `mountChat`；容器有明确高度。路由离开时调用返回值的 `unmount()`。
3. SDK 与共享 `ChatSession` 的最终释放由宿主负责。切换面板无需重新登录；同一加密数据库只允许一个客户端写入。
4. 发布完整示例时部署 `dist/embed-host/` 全目录。只嵌入组件时，复制 `dist/widget/mutual-chat.js`，由宿主自己的构建提供 SDK/WASM。

React 挂载示例、接口与安全边界见[完整中文指南](../../docs/EMBEDDING.md)。输入错误、登录被拒、登录限流、窗口冲突及加密存储初始化失败会给出对应操作提示；网络/证书/CORS 错误可能表现相同，界面不会猜定根因。

## English

From the repository root, install locked dependencies with `npm ci --ignore-scripts`, then run `npm run example:embed`. Open `http://127.0.0.1:14174` and use your own Matrix test account. The command builds all three artifacts and serves the host with a strict loopback port. Sign out before stopping the preview with Ctrl+C.

Optionally copy this directory's `.env.example` to `.env` and set the public `VITE_MATRIX_HOMESERVER` default before building. Never put credentials in Vite variables: they are embedded in public assets. Deploy the entire `dist/embed-host` directory, including assets; the standalone widget instead relies on its host's SDK/WASM deployment. See [EMBEDDING.md](../../docs/EMBEDDING.md) for ownership, React integration, and preview limitations.
