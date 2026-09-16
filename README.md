# Mutual Chat

可独立运行，也可嵌入其他产品的聊天界面。参考常见即时聊天软件的会话列表和消息交互，使用 Matrix 协议连接聊天服务。

**开发预览，尚未达到正式上线验收。** 当前包含独立 Web 应用、可嵌入 ES 模块与 Windows 桌面预览包，以及文字消息、邀请、私密加密会话和历史分页。本机 Matrix 服务、双用户加密互通、已有备份的新设备历史恢复、Windows 实际窗口启动及 Linux 桌面进程加密互通已通过相应测试；公开服务、Windows 真机与原生加密验收、移动客户端、首次备份、设备验证和附件仍待完成。

## 开发运行

需要 Node.js 22.12 或更新版本：

```sh
npm ci
npm run dev
```

在浏览器打开终端显示的 localhost 地址，登录一个支持密码登录的 Matrix 服务。远程服务器必须使用 HTTPS；HTTP 仅允许 localhost 开发地址。当前没有公共默认服务，也不会代建外部帐号。建议先使用测试帐号。

本机可复现的 Matrix 服务与真实浏览器集成测试入口见 [LOCAL-SERVER.md](docs/LOCAL-SERVER.md)。需要 Docker Compose，服务只绑定回环地址，默认关闭公开注册；它不是公开部署方案。

```sh
npm test
npm run build
```

产物：`dist/app/` 为独立静态 Web 应用；`dist/widget/mutual-chat.js` 为可嵌入界面模块；`dist/embed-host/` 为带登录和页面切换的宿主示例。完整部署必须保留 WASM 与其他 assets 文件。构建通过不等于服务端或真机验收通过。

Windows 构建者还可运行 `node tool/build-desktop.js win32` 生成独立 Electron x64 目录。CI 的 `mutual-chat-windows-desktop` 产物包含 ZIP、SHA-256 与真实窗口验收报告。必须完整解压目录后运行 `MutualChat.exe`，不是只复制 EXE；此包未签名，无自动更新。桌面与浏览器登录数据各自隔离，详见 [DESKTOP.md](docs/DESKTOP.md)。

## 嵌入其他应用

宿主创建并管理自己的 Matrix SDK client，初始化 Rust Crypto，并开始同步：

```js
import { mountChat } from './mutual-chat.js';

const panel = mountChat(document.getElementById('chat'), { client });
// 宿主路由卸载时：
panel.unmount();
```

容器需有明确高度。UI 使用 Shadow DOM 隔离样式，不替换宿主页面或强制退出宿主帐号。也可传入共享 `ChatSession`：组件卸载时仅移除自己的监听，不销毁外部 session。`packages/chat-core/session.js` 不依赖 UI 框架；SDK 负责同步、事务 ID、发送队列与加密。

运行宿主示例、共享会话用法和卸载行为见 [EMBEDDING.md](docs/EMBEDDING.md)。构建模块同时导出 `mountChat` 和 `ChatSession`。

会话中的「加载更早消息」按页读取历史，保留阅读位置并支持失败重试。预览版每个会话最多展示最近 1,000 条消息；这不是完整历史搜索或 SDK 总内存上限，详见 [HISTORY.md](docs/HISTORY.md)。

会话列表显示 SDK 未读通知数。只有明确点击「标为已读（仅自己）」才发送私人回执，打开会话不会自动标记；通知数不等于全部未读消息数，失败时可重试。详见 [READ-STATE.md](docs/READ-STATE.md)。

## 当前数据边界

- 密码只用于登录，随后清空输入框。默认临时登录的令牌和密钥仅在内存；刷新后不能恢复临时设备。
- 加密使用 [Matrix SDK 的 Rust Crypto](https://matrix-org.github.io/matrix-js-sdk/index.html#end-to-end-encryption-support)，不自造加密协议。
- 新会话默认私密并请求端到端加密；已有会话明确标注是否加密。
- 可选“在此浏览器保留会话”：用独立本机口令加密保存登录和随机存储密钥，并使用 SDK 加密 IndexedDB；刷新或锁定后输入口令恢复原设备。详见 [本机会话安全与限制](docs/SESSION-SECURITY.md)。
- 已有 Matrix 远程备份的历史密钥恢复已通过真实服务新设备验收，包括错误密钥拒绝和刷新后保留已恢复历史；不创建或重置备份。使用范围见 [RECOVERY.md](docs/RECOVERY.md)。
- 设备验证、跨签名和首次远程备份设置 **尚未实现**。没有已保存的恢复密钥或有效备份时，清理浏览器数据、退出未备份设备仍可能失去历史密钥，不能将预览版当成完整通信产品。
- 只允许一个独立窗口持有 SDK；嵌入场景的 client 生命周期由宿主管理，不允许多个 client 同时写同一个加密数据库。
- 消息正文按纯文本渲染，不执行消息中的 HTML。
- 独立应用中的「设备会话」可查看本帐号设备、确认后撤销其他设备登录，并按服务器要求重新认证。当前设备受保护；此操作不是密钥身份验证，也不能远程擦除已有消息副本。见 [设备会话说明](docs/DEVICE-SESSIONS.md)。

## 验证与下一步

最近设备管理候选通过 26 项单元测试、三种 Web/模块构建和 9 项 Chromium 场景；Windows 打包启动与独立 Linux 桌面进程加密互通/重启恢复也再次通过。此前 Windows ZIP 校验和最新设备撤销的真实手机视口截图已检查。结果与平台边界见 [VALIDATION.md](docs/VALIDATION.md)，后续验收见 [ROADMAP.md](docs/ROADMAP.md)。
