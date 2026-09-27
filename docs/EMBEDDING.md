# 在宿主应用中嵌入 Mutual Chat

本文说明构建产物、SDK 客户端所有权、挂载与卸载，以及示例宿主的可复现运行方式。当前为开发预览；嵌入模块只提供聊天界面与 `ChatSession` 适配层，登录、同步、设备密钥、加密数据库和退出都由宿主管理。

## 构建与部署

需要 Node.js 22.12 或更新版本。在仓库根目录执行：

```sh
npm ci --ignore-scripts
npm run build
```

构建脚本依次生成三个产物：`dist/app/` 是独立 Web 应用，`dist/widget/mutual-chat.js` 是 ES 模块，`dist/embed-host/` 是完整宿主示例。模块只公开 `mountChat` 和 `ChatSession`；`validateHomeserver` 是示例从源码引用的辅助函数，**不是**模块公开 API。widget 模块本身不创建 Matrix SDK client，可单独拷入已有 SDK 构建与资源的宿主；宿主须自行打包/部署其 `matrix-js-sdk`、RustCrypto WASM 及其他所需资源，并验证浏览器加载路径。部署完整的 `dist/app/` 或 `dist/embed-host/` 时则须保留各自产物的 `assets/`，只复制其 `index.html` 或入口 JS 会缺资源。`dist/embed-host/` 示例按站点根路径构建；不要假定它可直接放在任意子路径。

远程 Matrix 服务应使用可信 HTTPS；示例运行还需要 HTTPS 或 localhost，供浏览器密码学与 Web Locks 使用。嵌入页面所在来源、CSP、静态资源路径和 Matrix 服务的跨来源访问策略都须由宿主部署时核对，模块不会替宿主配置这些条件。

## 客户端准备与挂载

宿主须先建立已认证的 `matrix-js-sdk` client，初始化 RustCrypto，并启动同步。下面的生命周期顺序与 [`examples/embed-host/main.js`](../examples/embed-host/main.js) 一致；其中 `auth` 是宿主登录结果，`baseUrl` 是已验证的服务器地址，例中数据库前缀仅用于该示例。实际应用必须保证同一加密数据库同时只有一个 SDK client 写入。

```js
import { createClient } from 'matrix-js-sdk';
import { ChatSession, mountChat } from './widget/mutual-chat.js';

const client = createClient({
  baseUrl, userId: auth.user_id,
  deviceId: auth.device_id, accessToken: auth.access_token,
});
await client.initRustCrypto({ cryptoDatabasePrefix: `mutual-embed:${auth.user_id}:${auth.device_id}` });
const shared = new ChatSession(client);
await client.startClient({ initialSyncLimit: 30 });

const container = document.getElementById('chat');
let panel = mountChat(container, { session: shared });
// 路由离开：仅卸载界面；SDK client 和共享 session 继续工作。
panel.unmount();
panel = mountChat(container, { session: shared });

// 宿主最终销毁时，由宿主按自己的退出/持久化策略处理：
panel.unmount();
shared.dispose();
client.stopClient();
```

`ChatSession.ready` 在 SDK 同步状态达到 `PREPARED` 或 `SYNCING` 时才为真。宿主可以在 `startClient` 前挂载，此时界面显示等待同步，不能发送；应等待同步就绪并处理连接失败。不要只因 `startClient()` 调用返回便假定历史和加密密钥均可用。真实登录/恢复逻辑、Web Lock、失败后清理及服务器确认退出，请参照示例代码与 [本机会话安全说明](SESSION-SECURITY.md)。示例登录采用内存令牌、每次登录新设备，没有设备核对或密钥恢复界面，不能当作生产会话管理方案。

## 两种所有权与宿主框架

`mountChat(container, { session: shared })` 适合多个页面或面板共享宿主创建的 `ChatSession`。`unmount()` 只撤销本面板订阅与 DOM；最终不再使用时由宿主调用 `shared.dispose()`。`mountChat(container, { client })` 会为该面板创建自己的适配层，返回的 `panel.session` 由面板管理；卸载会释放它的 SDK 监听，但**不会**停止、注销或销毁宿主的 client。不要为同一个加密数据库再创建第二个 SDK client。两种方式都返回 `{ session, unmount }`，重复调用 `unmount()` 是安全的。

React 的最小挂载方式如下。`client` 须由更高层认证与生命周期逻辑提供，并保持实例稳定；路由组件重渲染不应重新登录或创建新的 SDK client。

```jsx
import { useEffect, useRef } from 'react';
import { mountChat } from './widget/mutual-chat.js';

export function ChatPanel({ client }) {
  const container = useRef(null);
  useEffect(() => {
    const panel = mountChat(container.current, { client });
    return () => panel.unmount();
  }, [client]);
  return <div ref={container} style={{ height: 'min(80vh, 700px)', minHeight: 420 }} />;
}
```

若多个路由需要保留同一适配层，在框架外层创建一次 `new ChatSession(client)`，改传 `{ session: shared }`，并在外层最终卸载时调用 `shared.dispose()`。原生 DOM 或其他框架遵循同样的“容器挂载、路由卸载、宿主最终处理 client”顺序。正在发送的请求由 SDK 继续负责；卸载不会撤销它。重新挂载后从同一会话读取结果。未发送草稿和当前选中会话属于面板内存，卸载后重置；需要跨路由保存草稿的宿主目前须自行管理。

容器必须是真实 DOM 元素且有明确高度；组件自身最小高度为 420px。窄于 640px 时布局变为单列。组件把内容放进开放的 Shadow DOM，隔离大部分宿主 CSS，并随浏览器深浅色偏好切换；宿主仍须给外层留足空间并自行处理页面布局与无障碍集成。多个面板可以挂载到不同容器，但应按需共享同一 client/session，避免重复 SDK 客户端和无谓监听。

## 运行完整宿主示例

在仓库根目录执行上述构建后：

```sh
npx vite preview --config vite.embed.config.js --host 127.0.0.1 --port 14174 --strictPort
```

打开 `http://127.0.0.1:14174`，用 Matrix 测试帐号登录；在“宿主共享会话”和“组件独立会话”之间切换并往返工作台，观察连接、设备 ID 与 SDK 监听数量。宿主示例只保留一个 client，并用 Web Lock 防止示例窗口同时写同一存储；诊断区不显示令牌或密码。退出帐号由宿主显式请求，关闭聊天面板不会退出帐号。有关已验证的真实 Synapse/浏览器挂载与待验边界，见 [VALIDATION.md](VALIDATION.md)。

## 常见问题与安全边界

| 现象 | 检查项 |
| --- | --- |
| 空白界面或资源 404 | 检查宿主 SDK/WASM 及相关资源的部署路径和浏览器控制台；完整示例按站点根路径部署。 |
| 一直显示正在同步 | 检查宿主是否初始化 RustCrypto、启动 client 同步，以及服务器、令牌和网络状态。 |
| 切页后消息/草稿状态变化 | 已提交请求仍由 SDK 处理；未发送草稿与选中会话在卸载时清除。 |
| 重复消息或监听增加 | 检查每次路由卸载是否调用对应 `panel.unmount()`，共享 session 是否只创建一次。 |
| 加密存储冲突 | 检查是否有多个 SDK client 同时写相同数据库，及宿主是否持有跨窗口独占权。 |

此模块没有替宿主实现安全登录、持久令牌保险箱、设备验证、首次密钥备份、跨签名、生产 TLS 部署或真机验收。SDK 加密和本地存储的安全性仍取决于宿主来源、帐号生命周期和密钥管理；详见 [SESSION-SECURITY.md](SESSION-SECURITY.md) 与 [ROADMAP.md](ROADMAP.md)。

---

# Embed Mutual Chat in a host application

The built ES module exports `mountChat` and `ChatSession`. The host supplies its authenticated, RustCrypto-initialized Matrix SDK client. Authentication, sync, device keys and logout stay with the host; the panel does not start or stop that client.

```js
import { mountChat, ChatSession } from './widget/mutual-chat.js';

// client is already authenticated and initialized by your application.
const shared = new ChatSession(client);
const panel = mountChat(document.querySelector('#chat'), { session: shared });

// A route change removes only this panel and its subscription.
panel.unmount();
const reopened = mountChat(document.querySelector('#chat'), { session: shared });

// On final host teardown, dispose the shared adapter as well.
reopened.unmount();
shared.dispose();
// The host decides separately when to stop or log out its Matrix client.
```

For a panel that owns its own adapter, use `mountChat(container, { client })`. Unmounting disposes that adapter's SDK listeners, while preserving the client and any other host listeners. Do not construct a second SDK client against the same crypto database. Provide a real DOM container with a defined height. Each mount returns `{ session, unmount }`; unmount is idempotent.

## Runnable host example

`examples/embed-host` is a separate host shell with its own login, workbench navigation, logout, and a selector for shared versus panel-owned sessions. It imports the actual emitted `dist/widget/mutual-chat.js`, copied unchanged into its build, rather than reaching into widget UI source. The host still imports the existing homeserver-address validation helper from source; that helper is not a published widget export.

```sh
npm ci --ignore-scripts
npm run build
npx vite preview --config vite.embed.config.js --host 127.0.0.1 --port 14174 --strictPort
```

Open `http://127.0.0.1:14174` and use a Matrix test account. The example's login has the same development limitations as the standalone app: memory-only token, new device per login, no verification or key-recovery interface. Its host owns a single SDK client protected by a Web Lock. The diagnostic disclosure shows identity, device ID and listener counts, never tokens or passwords. It is a developer integration example, not another public chat service.

Build outputs:

- `dist/app`: standalone application.
- `dist/widget/mutual-chat.js`: framework-neutral embedded module.
- `dist/embed-host`: complete host example with SDK/WASM assets and the built widget.

Serve the complete host output at its own origin root; do not copy only `index.html` or assume arbitrary subpath support. The example requires HTTPS or localhost for browser cryptography and Web Locks. Shadow DOM isolates host CSS from widget internals; both follow the browser color preference.

## Navigation behavior and validation

An already-submitted send remains owned by the SDK after unmount. Reopening the panel reads its result from the existing session. An unsent composer draft and the selected room currently belong to the panel and are reset by unmount; a host needing durable drafts should keep them in its own state until a draft API is added.

CI exercises the built module against real Synapse: repeated mounts in both ownership modes, an encrypted request held while navigating away, one delivered event after reopening, unchanged device/login, listener counts returning to baseline, and explicit host logout invalidating the token. A separate controlled-session browser case exercises stale controls and late promises after unmount. These cases passed in [PR #3 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34811896034); evidence and remaining gates are recorded in VALIDATION.md.

Reproduce with the local server running: `npm run test:browser`. See [LOCAL-SERVER.md](LOCAL-SERVER.md) and [VALIDATION.md](VALIDATION.md). Host mounting coverage does not complete cross-signing, secure session restoration, native packaging or real-device acceptance.
