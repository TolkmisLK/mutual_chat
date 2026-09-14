# Mutual Chat

可独立运行，也可嵌入其他产品的聊天界面。参考常见即时聊天软件的会话列表和消息交互，使用 Matrix 协议连接聊天服务。

**开发预览，尚未达到正式上线验收。** 当前包含独立 Web 应用、可嵌入的 ES 模块、会话列表、文字消息、手动接受邀请与创建私密加密会话。本机 Matrix 服务和真实双用户加密互通测试已通过；公开服务部署、桌面/移动原生打包、密钥恢复、设备验证和附件仍待完成。

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

## 当前数据边界

- 密码只用于登录，随后清空输入框。默认临时登录的令牌和密钥仅在内存；刷新后不能恢复临时设备。
- 加密使用 [Matrix SDK 的 Rust Crypto](https://matrix-org.github.io/matrix-js-sdk/index.html#end-to-end-encryption-support)，不自造加密协议。
- 新会话默认私密并请求端到端加密；已有会话明确标注是否加密。
- 可选“在此浏览器保留会话”：用独立本机口令加密保存登录和随机存储密钥，并使用 SDK 加密 IndexedDB；刷新或锁定后输入口令恢复原设备。详见 [本机会话安全与限制](docs/SESSION-SECURITY.md)。
- 设备验证、跨签名、远程密钥备份和丢失设备恢复 **尚未实现**。忘记本机口令、清理浏览器数据或退出未备份设备可能失去历史密钥，仍不适合依赖历史密文可恢复性的正式通信。
- 只允许一个独立窗口持有 SDK；嵌入场景的 client 生命周期由宿主管理，不允许多个 client 同时写同一个加密数据库。
- 消息正文按纯文本渲染，不执行消息中的 HTML。

## 验证与下一步

10 项单元测试、三种生产构建和 5 项 Chromium 场景通过：真实 Synapse 双用户加密通信与服务备份恢复、嵌入宿主生命周期、同设备会话恢复与历史解密、多窗口锁定交接和失效登录处理。实际桌面和手机视口截图已审阅。结果与边界见 [VALIDATION.md](docs/VALIDATION.md)，后续验收见 [ROADMAP.md](docs/ROADMAP.md)。
