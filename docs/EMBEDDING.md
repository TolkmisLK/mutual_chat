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
