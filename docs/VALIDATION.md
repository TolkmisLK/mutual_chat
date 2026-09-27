# 验证记录（中文索引）

本页按候选版本记录执行证据，以下中文概述保留了“已通过”“曾失败后修复”和“仍待验证”的区别；英文各节保留精确提交、CI 链接、耗时、截图与测试条件。**所有结果都属于开发预览**，本机/CI 浏览器视口不能替代实体设备，回环服务不能替代公开部署或可信远端 TLS；没有稳定版发布。

| 日期或阶段 | 已记录的结果与边界 |
| --- | --- |
| 2026-09-19，同帐号 SAS，PR #14 | 最终候选 `476d88fc` 的应用四项 CI、PostgreSQL CI、57 项单测、三种构建、13 个浏览器场景、Windows 启动及 Linux 原生加密重启均通过。真实 Synapse 双设备先取消数字不一致，再双方明确确认；模拟传输 WASM 测试只用于补充 SDK 生命周期形状，不能替代服务器互通。仅独立应用、同帐号，不包含联系人/跨签名/首次备份。 |
| 2026-09-17，PostgreSQL 失败恢复防护，PR #13 | 候选 `838361f5` 的应用与 PostgreSQL CI 通过，46 项单测及三构建通过。真实 `pg_restore` 遇校验和正确但内容无效的归档后，失败目标保持零表，`restore.pending` 使后续启动与快照拒绝；成功恢复才移除标记。这是受控进程失败，不证明断电或物理磁盘持久性。 |
| 2026-09-17，本人消息撤回，PR #12 | 最终候选 `5887e493` 的应用/PostgreSQL CI、45 项单测、12 个浏览器场景及桌面/恢复门槛通过。真实双用户加密撤回含取消、拒绝后重试、双方同步和服务器事件核查。审查发现卸载后失败回显可能滞留，修复后回归；撤回不能删除已有副本或备份。 |
| 2026-09-17，PostgreSQL 恢复，PR #11 | 最终候选 `5047514c` 的真实 Docker/Chromium 演练、40 项单测与三构建通过：独立空库恢复 SQL、媒体/配置/签名密钥，核对加密事件 ID、65,537 字节媒体、一次性密钥排除和源服务继续通信。仅回环演练，非异地备份或丢失客户端密钥恢复。 |
| 2026-09-17，本地搜索，PR #10 | 候选 `10622a84` 的 36 项单测、三构建、11 个 Chromium 场景及桌面门槛通过。首次截图暴露窄屏输入框被祖先滚动裁切，修复后复验；搜索仅限当前已加载文字，不搜索附件/完整档案，也不发搜索/已读请求。 |
| 2026-09-16，私人已读，PR #9 | 最终候选 `e6ffe481` 的 32 项单测、三构建、10 个 Chromium 场景及桌面门槛通过。真实双用户 Synapse 验证显式私人回执、失败重试、新消息边界、服务器计数与对方同步不可见。SDK 加密房间旧计数需在完整已解密后缀及确认边界下谨慎协调；手机截图是浏览器视口。 |
| 2026-09-16，帐号设备管理，PR #8 | 候选 `82a82ab7` 的 26 项单测、三构建、九个 Chromium 场景及桌面门槛通过。服务器要求密码重新认证；错误密码拒绝，正确密码只移除选中设备，旧令牌 401、当前令牌 200，房间事件保持不变。不能远程擦除已有消息，也不等于设备密钥验证。 |
| 2026-09-15，桌面预览，PR #7 | 最终候选 `366a27a6` 的 Windows 打包实际窗口启动与 Linux 两个 Electron 进程的 Synapse 加密互通/记住会话重启通过。早期导航断言误用，改为检查原生取消事件并复验。Windows ZIP/内容与截图已检查；仍无消费者 Windows Matrix、签名、自动更新或可信远程 TLS 验收。 |
| 更早历史分页，PR #6 | 最终候选 `6615e06f` 的 19 项单测、三构建、七个浏览器场景通过；真实新设备恢复已有密钥、向前拉取 32 条加密消息并重试中断请求。初版截图发现旧失败提示滞留，最终版修复并复验；1000 条显示上限不等于完整历史能力。 |
| 已有远程备份恢复，PR #5 | 候选 `d8f8476f` 的 16 项单测、三构建、六个浏览器场景通过。测试备份由官方 SDK 仅为生成帐号创建；新设备拒绝错钥、恢复旧消息、备份版本不变、再解锁仍可读。初版 SDK 解密错误体处理失败后修复。大型/部分备份、物理设备与首次备份设置未验收。 |
| 本机加密会话，PR #4 | 候选 `e8a8ca0d` 的十项单测、三构建、五个 Chromium 场景通过：同设备解锁、错口令拒绝、窗口独占交接、明确退出后旧令牌 401。截图是浏览器视口，不能证明丢失资料恢复或联系人身份核对。 |
| 嵌入宿主，PR #3 | 候选 `434a7d75` 的六项单测、三产物、三个浏览器场景通过；真实宿主两种会话所有权反复挂卸、待发加密消息切页后单次到达、原设备和令牌维持，明确退出才失效。受控卸载场景仅验证生命周期，不是密码学验收；未发送草稿/选中会话卸载后重置。 |
| 初始互通与本机备份，PR #2 | 真实双 Chromium 帐号在本机 Synapse 双向加密互通并核对服务器仅存密文；停止源服务后复制完整 SQLite/配置/签名密钥到独立项目恢复，旧令牌可查询同一事件。首次复制路径冲突失败后修正并通过。它不证明 PostgreSQL、异地备份、媒体或客户端密钥恢复。 |

复现需 Docker Compose v2、Node.js 24、兼容环境及 Chromium。在仓库根目录运行 `npm ci --ignore-scripts`、`npm test`、`npm run build`、`npm run server:local`、`npx playwright install --with-deps chromium`、`npm run test:browser`，最后 `npm run server:local -- stop`；配置与私有数据边界见 [LOCAL-SERVER.md](LOCAL-SERVER.md)。历史记录中某些真实服务器步骤仅在 CI 执行，不能把这些记录当作本次本机复跑。尚未完成：联系人核对、跨签名、首次备份、大型/部分备份恢复、安全附件、超出渲染窗口的历史导航、可信 TLS/异地备份和实体设备生命周期。

---

# Validation — 2026-09-15 (Asia/Shanghai)

Development preview. This is not a public deployment or native-device acceptance.

## Incomplete PostgreSQL restore guard — 2026-09-17

PR #13 candidate `838361f5d66e0de011474b81c0a60b9241be26c2` passed [PostgreSQL CI 35223009270](https://github.com/TolkmisLK/mutual_chat/actions/runs/35223009270) and all four [application CI jobs 35223009295](https://github.com/TolkmisLK/mutual_chat/actions/runs/35223009295). All 46 local/CI unit tests passed, together with the three builds, browser regressions, Windows startup and Linux native encrypted messaging/relaunch.

The guard retains `restore.pending` until the database import succeeds, blocking startup and snapshots after failure. Its local regression checks repeated refusal, unchanged marker and lock release. The real-PostgreSQL scenario passed in 48.0 seconds: a checksum-matching invalid archive reached and failed actual `pg_restore`; the failed target retained zero tables with only PostgreSQL running, while subsequent startup and snapshot were refused. Successful restoration removed its marker and preserved encrypted event IDs/media bytes/one-time-key exclusion; the source continued encrypted communication. This is controlled process-level failure testing, not a power-loss or physical-disk durability guarantee.

## Own-message redaction — 2026-09-17

PR #12 final candidate `5887e493c9c59444962d8e57251c7f7facf3dd22` passed all four jobs in [application CI 35195372721](https://github.com/TolkmisLK/mutual_chat/actions/runs/35195372721) and [PostgreSQL CI 35195372709](https://github.com/TolkmisLK/mutual_chat/actions/runs/35195372709). All 45 unit tests and three builds passed; 12 browser scenarios passed in 3.2 minutes. The new real two-user encrypted redaction case took 3.3 seconds: cancellation sent no request, a controlled rejection allowed a real-server retry, both peers received redaction, another message remained and the server event no longer contained ciphertext. Local search excluded the redacted message. Artifact 10485822483's actual mobile screenshot was downloaded and reviewed; the composer remains visible.

Review identified a failure arriving after panel disposal that could strand an optimistic deleted placeholder in the surviving host client. Settlement now removes only this adapter's failed transaction echo even after unmount, without cancelling an in-flight operation. A regression verifies a remounted panel can retry and host-owned pending events remain intact. Windows startup, Linux encrypted desktop relaunch and PostgreSQL recovery passed again. See [REDACTION.md](REDACTION.md); retracting a message cannot erase saved copies or backups.

## PostgreSQL recovery — 2026-09-17

PR #11 final candidate `5047514c6ed47715205b970a6213c10dcf60b3d6` passed [PostgreSQL recovery CI 35153896611](https://github.com/TolkmisLK/mutual_chat/actions/runs/35153896611) and all four jobs in [application CI 35153896607](https://github.com/TolkmisLK/mutual_chat/actions/runs/35153896607). The 40-test unit suite and three builds also passed locally. The new actual Docker/Chromium scenario passed in 1.0 minute with PostgreSQL 17.11 and Synapse 1.160.0.

Evidence: Synapse's database role is not superuser; collation is `C:C`; two actual clients exchanged encrypted messages. After quiescing Synapse, a custom SQL dump plus media/config/signing-key copy was restored into a unique fresh project and empty database. Original access tokens read identical ciphertext event IDs, and authenticated media download matched all 65,537 generated bytes. The source one-time-key table was populated before backup while the restored table was empty; the source still exchanged encrypted messages afterward. Restore into the existing source directory was refused. Local regression cases also prove concurrent-operation exclusion, lock release on failure, stale-lock preservation and corrupt-dump rejection before any Docker operation.

The initial container bootstrap could not read host-owned 0600 bind-mounted secret files. Only its two read-only bootstrap files are now 0444 inside the unchanged 0700 private host directory; configuration/dumps remain 0600. No SQL, service directories, credentials or traces were uploaded. This is a loopback deployment and restore rehearsal, not trusted remote TLS, offsite encrypted backup, public hosting or lost-client-key recovery. See [POSTGRES.md](POSTGRES.md).

## Local loaded-message search — 2026-09-17

PR #10 candidate `10622a84d246ce4a4843d7959fc42f54f18d7b28` passed [CI 35152713942](https://github.com/TolkmisLK/mutual_chat/actions/runs/35152713942): 36 unit tests, three builds, all 11 Chromium scenarios (3.0 minutes), Windows packaged startup and Linux native encrypted restart. The real encrypted two-user case (26.4 seconds) searches decrypted text without issuing search/read-receipt requests. The controlled embedded case (228 ms) covers navigation, room reset, literal text and stale handlers.

Reviewed artifact `10469439101` including the actual mobile-viewport search capture: the selected match and composer remain visible. The first screenshot exposed ancestor scrolling that clipped the composer; navigation now moves only the message viewport, with explicit outer-scroll/composer-bounds assertions. A review finding also led to an explicit `m.text`/`m.notice`/`m.emote` allowlist and a session regression test excluding attachment captions. Search is local and bounded, not full archive or attachment search; see [LOCAL-SEARCH.md](LOCAL-SEARCH.md).

## Private read state — 2026-09-16

[PR #9 final CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/35067423712), candidate `e6ffe481987f6937d5427e7c2df966937dc33df5`: all four jobs passed. The 32-test unit suite, three builds, ten Chromium scenarios (3.0 minutes), Windows packaged startup and Linux native encrypted-restart gates passed. The local 32-test suite was rerun successfully during review.

The real two-user encrypted Synapse private-receipt scenario passed in 3.3 seconds. Opening a room sent no receipt. An aborted private receipt showed a retryable error; a later message during a held retry remained unread. Both the independent incremental server-sync observer and displayed count progressed to one and then zero after explicit acknowledgment. The receipt was visible to the same account but neither a private nor public acknowledgment was delivered to the other user's sync. The exact newer event ID was checked, not just the count.

The initial candidate exposed SDK 42.3's stale non-zero total in encrypted rooms. The adapter now reconciles only a fully available decrypted suffix after a server-confirmed room-wide read boundary, using SDK notification actions without mutating host counters or trusting synthetic receipt echoes. Two regression cases use the actual locked SDK Room/MatrixEvent models. A follow-up test correction replaced repeated initial sync (which can return a cached snapshot) with an independent incremental observer. No privacy, new-arrival or failure/retry assertion was removed.

Browser artifact `10434572520` was downloaded and the actual mobile-viewport private-read screenshot inspected: both messages remain visible, the acknowledgment result and controls fit, and the read badge is gone. This is browser/CI evidence, not physical-phone acceptance. See [READ-STATE.md](READ-STATE.md) for notification-count and fallback limits.

## Account-device management — 2026-09-16

[PR #8 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/35028377496), candidate `82a82ab7508d343ea8bdfa69b4ed94557df660bb`: all four jobs passed. Windows and Linux unit gates pass 26 tests, the three Web builds pass, and nine real Chromium scenarios pass in 3.0 minutes. Windows packaged-window and Linux native encrypted restart gates also pass again.

The new real Synapse device-removal scenario took 4.5 seconds. Cancelling confirmation sends no DELETE request; the server requires UIA password authentication, an incorrect password is refused and its input cleared, and the correct password removes only the selected other device. Its old token subsequently returns 401 while the current device token returns 200. Encrypted room event IDs are unchanged. Five controlled tests additionally cover unknown/current targets, exact account/target binding, expired/cancelled/unsupported challenges, concurrent/disposed operations and ambiguous network outcomes. Local 26 tests and three builds passed before upload.

Artifact `10420527218` was downloaded and its real mobile-viewport device-removal screenshot inspected: the remaining current device is protected, the removed target is absent, controls fit, and the result warns that existing copies cannot be erased. This is Chromium/CI evidence, not physical phone or cryptographic device verification. See [DEVICE-SESSIONS.md](DEVICE-SESSIONS.md).

## Independent desktop package and actual runtime — 2026-09-15

[PR #7 final CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34967502143), candidate `366a27a6540f9b274a6f903e9eafb7ded4e897cd`: all four jobs passed. Windows and Linux each passed 21 unit tests; all three Web/widget/host builds passed. Eight actual Chromium scenarios passed in 3.0 minutes, including the new controlled creation-dialog cancel/retry/duplicate/disposal regression (185 ms). Local 21 unit tests and the three builds passed before this candidate was uploaded.

Windows 2022 built and launched the actual Electron 44.3.0 packaged executable using a fresh private profile. Assertions verify app.isPackaged, sandbox/context isolation, no renderer Node bridge, web security, secure-origin WebCrypto/IndexedDB/Web Locks, denial of extra protocol files and popups, and an external navigation whose native event was actually prevented while the app document remained intact. The application closes normally. Playwright is explicitly launched with chromiumSandbox:true; no --no-sandbox argument is permitted. An earlier candidate incorrectly used a navigation-load matcher for a deliberately cancelled navigation; the replacement checks the native cancellation event and live document, preserving the actual blocking requirement.

Ubuntu 22.04 separately packaged the same app for Linux and ran two real Electron processes under Xvfb with sandboxing enabled. Generated accounts on the actual loopback Synapse server create/join a private encrypted room, exchange decrypted messages, and produce only Megolm ciphertext on the wire and in independent server history. One remembered app is closed and relaunched from its same private profile: an incorrect passphrase fails without changing its vault; the correct passphrase restores the same device and decrypts old messages. It sends a further encrypted message received by the other process. Exactly two login requests occur, one per initial account. These are Linux native Matrix results, not Windows Matrix or trusted remote TLS acceptance.

Final artifacts `10395727559` (Windows) and `10396255765` (Linux Matrix evidence) were downloaded. The inner Windows ZIP SHA-256 and all 73 ZIP entries passed checks. Its app.asar contains only the minimal package metadata, app/compiled assets including the RustCrypto WASM, desktop entry/policy, license and desktop guide; no source fixture accounts, profiles or test tools are packaged. The actual Windows login-window and Linux restored-encrypted-chat screenshots were inspected. See [DESKTOP.md](DESKTOP.md). The package is unsigned, no stable release has been published, and consumer Windows, native Windows Matrix interoperability, mobile hardware and real remote TLS remain separate gates.

## Earlier-message pagination

[PR #6 final CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34926577158), candidate `6615e06ff39dc65c19f4445014e912da53388e07`: both jobs passed, with 19 unit tests, all three builds and seven browser scenarios in 3.0 minutes. Local 19 unit tests and three builds also passed. Controlled regressions cover cached expansion, event-ID deduplication, the 1,000-message rendering cap, shared pending requests, exhausted history, failed-page retry and disposed adapters ignoring later completion.

The real SDK/Synapse scenario took 2.0 minutes, including seeding 32 encrypted messages while respecting the fixture server's existing message rate limits. A distinct new browser device initially receives only 30 messages, restores their existing backed-up key, and loads the missing early messages through the real backward-history endpoint. A deliberately interrupted request fails visibly and retries successfully, with exactly 32 distinct event IDs, all decrypted. The first visible event stays within 3 pixels of its prior relative reading position. Loading reaches the server's accessible-history boundary and hides the paging control. Existing recovery, host lifecycle and restart scenarios pass again.

Artifact `10380420448` was downloaded and its actual history screenshot inspected: the earliest messages and history-beginning label are visible, the composer remains usable, and the old failure status is cleared after retry. The initial passing candidate `f34a72cc` exposed that stale status in its screenshot; the final candidate fixes it and repeats all gates. These are Chromium/CI results, not phone hardware or unlimited-history navigation acceptance. See [HISTORY.md](HISTORY.md).

## Existing remote backup recovery

[PR #5 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34896682693), candidate `d8f8476f633c6ee5ab90202b3379602f6127a3fd`: both jobs passed, with 16 unit tests, three production builds and six real/controlled Chromium scenarios (56.0 seconds). Local unit tests and three builds also passed after local execution became available again; Docker remains unavailable locally, so real-server execution is evidenced by CI.

The new recovery scenario (7.6 seconds) creates a backup only for a generated test identity using the official SDK, closes that original context, and signs in on a distinct production-app device. Old history initially lacks keys. Malformed and syntactically valid but wrong secrets are rejected; the correct recovery key imports the old message, leaves the server backup version unchanged, and permits a new encrypted send. A further reload/unlock retains the same new device and decrypts both messages without re-entering the recovery key. Existing session, revocation, host lifecycle and two-user/server-snapshot cases passed again.

The initial candidate failed because SDK decryption failures use a synthetic message event containing an internal error body. The core now explicitly handles `isDecryptionFailure()` as a localized missing-key placeholder, with a unit regression proving transition to recovered plaintext. No cryptographic assertion was removed.

Artifact `10368314826` was downloaded and actual recovered-backup and phone-viewport screenshots were inspected: old/new history is visible after reload, composer is ready, and header controls wrap on narrow screens. No secrets or browser traces are included. Production recovery never initializes, resets or deletes backup/cross-signing identities; first-time setup and peer verification remain unfinished. See [RECOVERY.md](RECOVERY.md).

## Encrypted local session restoration

[PR #4 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34817824421), candidate `e8a8ca0d3b1206bf63298673962909a6d2b3b2eb`: both jobs passed. Ten unit tests, all three builds and all five Chromium scenarios passed (browser suite 42.8 seconds). The standalone shell now offers temporary memory-only login and opt-in encrypted local session storage.

- Same-device restoration (3.1 seconds): a generated account sends an encrypted message, reloads, rejects a wrong local passphrase without changing the vault, unlocks with the original device ID, and decrypts the earlier message. Only the original login request occurs. A competing window cannot initialize until the first locks; after ownership transfers, the second window decrypts history and sends another encrypted message. Explicit logout removes the vault and the original server token returns 401.
- Revoked token (1.3 seconds): after server-side logout, unlocking remains blocked and preserves the encrypted vault rather than silently logging in as a replacement device.
- The previous real two-user/restart/snapshot scenario and both embedded lifecycle scenarios pass with the new default temporary storage mode.

Artifact `10337501056` was downloaded. Actual restored-session and phone-viewport screenshots were inspected: old and new messages are visible after lock handoff, the original device is identified, and the temporary mobile-viewport conversation remains usable. These are Chromium captures, not physical-device tests. See [SESSION-SECURITY.md](SESSION-SECURITY.md) for the format, threat model and deletion limitations. This does not establish lost-profile recovery or trusted peer verification.

## Embedded host navigation and lifecycle

[PR #3 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34811896034), candidate `434a7d756503431fe77476a1fc0cf09a6695e8eb`: `check` and `integration` passed. Six unit tests and all three production outputs (widget, standalone, host example) passed. The widget copied into the host output was also compared locally byte for byte with the standalone ES module; public exports are `ChatSession` and `mountChat`.

All three Chromium scenarios passed in 41.1 seconds:

- Real embedded host (2.8 seconds): shared and panel-owned session modes each repeatedly mounted/unmounted, returned SDK listener counts to baseline and removed panel subscriptions. In each mode a real encrypted request was held until after navigation away, then delivered exactly once and displayed after remount. The server stored two encrypted events in total. The original user/device/token remained active throughout navigation; only explicit host logout invalidated the token. No browser page errors occurred.
- Controlled adapter teardown (178 ms): stale controls and callbacks after unmount could not trigger another send or change the detached draft; repeated unmount was harmless and left the host-owned adapter intact. This case tests component lifecycle, not cryptography.
- Existing real two-user scenario (35.1 seconds): invitation, encrypted delivery, server restart and snapshot recovery passed again. It now sends and receives another message after the snapshot rehearsal restores the source server before taking screenshots.

Artifact `10334484902` was downloaded. The embedded host screenshot and the updated phone-viewport conversation were inspected: host navigation and its separate style remain intact, both delayed messages appear once, and the phone composer is ready after restored communication. These are actual Chromium renders with generated fixture identities, not native-phone captures.

The integration example is documented in [EMBEDDING.md](EMBEDDING.md). Unsent drafts and selected-room state reset on unmount. Secure session restoration, device verification and key recovery are still separate unfinished work.

## Real server/browser interoperability

[PR #2 candidate CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34794508200), commit `cc6a25c5fd923e7fc2c20a2a73147b5091574935`: both `check` and `integration` jobs passed.

- Core: 5 controlled-SDK tests passed. Standalone application and embedded ES module production builds passed.
- Deployment: pinned `matrixdotorg/synapse:v1.160.0` started using our loopback-only Compose configuration and persisted SQLite directory in the Ubuntu CI host.
- Browser: 1 end-to-end scenario passed (11.4 seconds; suite 13.4 seconds). Two independent Chromium browser contexts logged in as uniquely generated non-admin local accounts, initialized official SDK RustCrypto, invited/joined a private encrypted room, and displayed bidirectional decrypted text.
- Wire check: Alice's outbound message used `m.room.encrypted` with `m.megolm.v1.aes-sha2`; its payload did not contain the source message text. Bob's literal `<script>` message displayed as text, not executable HTML.
- Recovery scope: the Docker service restarted; existing browser devices reconnected and exchanged another message. A separate authenticated server messages request returned at least three encrypted events from persisted storage, with no message plaintext. This does **not** prove lost-device key recovery or power-loss consistency.
- UI: downloaded browser artifact `10329317080` and inspected actual desktop (1280×900) and mobile-viewport (390×844) screenshots. Chinese text, room list, wrapped message bubbles and composer render without horizontal overflow. These are desktop Chromium viewports, not physical-phone acceptance.

Tokens/passwords are never saved in the report. Browser network tracing is disabled to avoid capturing credentials. Screenshots contain only generated fixture accounts and messages. The server test fixture is not deployed to the public Internet.

## Local private backup restoration

[Final PR #2 CI](https://github.com/TolkmisLK/mutual_chat/actions/runs/34794923410), candidate `68ba5649b82fdaee1adab10fa0cb8e90d3532115`: both jobs passed, including all 6 unit tests (5 controlled-SDK tests plus 1 real filesystem snapshot-isolation regression) and the extended real-browser scenario.

The scenario stops the source fixture before copying its entire data directory into a newly created private temporary directory. A second independent Compose project starts the copy on loopback port 18009. The original test token can query the same room there, and the restored encrypted message event IDs match the source history. The copied server is removed before deleting only its private fixture copy; the source server is restarted without replacing source files. A regression test confirms editing the copied config does not change the source.

The first attempt failed because an existing temporary root collided with `fs.cp`'s no-overwrite option; the corrected absent child-path layout passed. No test gate was removed. This verifies local SQLite/config/signing-key restoration and retained session/history, **not** PostgreSQL disaster recovery, remote/off-site backups, media-file restoration or client secret-key recovery. No browser trace or copied secret directory is uploaded as an artifact.

Local production-dependency audit on this date (`npm audit --omit=dev --audit-level=high`) reported 0 vulnerabilities. This only reflects known registry advisories for that dependency scope, not a general security certification.

## Reproduce commands

Docker Compose v2, Node 24, and Linux/compatible Docker environment:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run server:local
npx playwright install --with-deps chromium
npm run test:browser
npm run server:local -- stop
```

See [LOCAL-SERVER.md](LOCAL-SERVER.md) for configuration, storage and private backup boundaries. Local development environment lacked Docker/browser binaries, so interoperability execution is evidenced by CI, not claimed as a local-container run.

## Unfinished launch gates

Contact identity verification and cross-signing setup; first-time backup setup and large/partial backup recovery; safe chat attachments and navigation beyond the bounded history window; trusted TLS staging and offsite backup restoration; remaining native/physical-device lifecycle checks. Same-account SAS, private receipts, local search, own-message redaction and loopback PostgreSQL restoration have their specific evidence recorded here; none establishes those remaining gates. No stable release has been published.
## Same-account SAS — 2026-09-19 (Asia/Shanghai)

PR #14 final candidate `476d88fc04a94b9c967312b9e620f0b79eb64c6d` passed all four [application CI jobs 35382151031](https://github.com/TolkmisLK/mutual_chat/actions/runs/35382151031) and [PostgreSQL CI 35382151023](https://github.com/TolkmisLK/mutual_chat/actions/runs/35382151023). All 57 local/unit tests and three builds passed; 13 browser scenarios passed in 3.1 minutes, alongside Windows packaged startup and Linux native encrypted relaunch. The real Synapse/two-context SAS scenario took 3.6 seconds: both devices explicitly accepted matching numbers, a deliberate mismatch first cancelled without success, a retry required both confirmations, and the server still had no backup. Artifact `10562352935` was downloaded and the actual narrow-viewport successful verification dialog reviewed.

The first candidates exposed real SDK request-shape assumptions: Rust leaves `otherDeviceId` unset before acceptance and clears it again at Done. Two real in-memory WASM regressions reproduce the lifecycle and complete the cryptographic exchange with a simulated transport; these are not substitutes for the separate real-server browser case. Production binds the exact selected device, checks the accepted SAS transcript, and retains that binding at completion; any observed identity change permanently invalidates the flow. No artificial trust setter, permissive fallback or arbitrary delay was used to pass the gate. Success still requires explicit local confirmation, completed SDK verification and `localVerified=true`. Same-account only, standalone only; not contact/cross-signing setup or first-time backup. See [DEVICE-VERIFICATION.md](DEVICE-VERIFICATION.md).
