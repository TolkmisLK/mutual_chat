# 私人已读状态与未读提示

会话徽标显示的是 SDK/服务器通知规则下的**未读通知数**，不是所有未读消息的精确数量。静音、推送规则、加密解密状态和同步进度都会影响它；界面最多显示 `999+`。在加密房间，SDK 42.3 可能保留过期的非零总数：适配层仅在有服务器确认的整房间已读边界，且后续事件完整可解密并在当前时间线内时重新统计；缺少边界、密钥、推送动作、线程或超过 1000 个后续事件时沿用 SDK 数值，可能继续过期。它不修改宿主 SDK 计数。

打开会话、滚动、解密历史或挂载面板都不会自动发送回执。用户点击“标为已读（仅自己）”时，针对当时已加载、已解密的最新接收消息发送整房间 `m.read.private`；请求过程中到来的新消息不会被自动包含。服务器及自己其他设备可见私人位置，其他成员原则上收不到；它对服务器不加密，也不会退回公开 `m.read`。线程专属已读未实现。

SDK 可能先显示本地回显，所以徽标消失不代表服务器确认；失败时仍显示重试。面板卸载只移除适配层监听，不中止宿主 client 或已发请求。真实双用户 Synapse 场景核对了显式操作、失败重试、新消息边界、服务器计数和对方同步中无回执；详见 [VALIDATION.md](VALIDATION.md)。

---

# Private read state

Room badges display **unread notifications**, not a complete count of all unread messages. Push rules, muted rooms, encryption/key availability and sync affect this value. The badge is capped visually at 999+; no independent local counter is persisted.

SDK 42.3 ignores non-zero server totals for encrypted rooms while receipt processing only recalculates highlights. To reconcile stale totals, the adapter counts SDK-notifying events after a server-confirmed, room-wide receipt when its boundary and complete decrypted suffix are in the live timeline. Synthetic receipt echoes are excluded, duplicate event IDs are counted once, and host SDK counters remain untouched. Missing boundaries, unknown push actions, missing keys, threads, or a suffix beyond 1000 events retain the SDK count rather than guessing. Such counts may remain stale until a later sync or a newer confirmed read boundary is available.

Opening a room, scrolling, decrypting history or mounting an embedded panel does not send a read receipt. The explicit **标为已读（仅自己）** button sends `m.read.private` for the latest loaded, decrypted, received message captured when clicked. It is a room-wide acknowledgment through that event, not a claim that every message was actually visible on screen. Pending local sends and missing-key placeholders cannot be targets. A newer event arriving while the request is in progress is not silently substituted.

The homeserver and the user's other devices can see the private read position. Other room members should not receive it. This is protocol privacy, not encryption from the homeserver. There is no fallback to public `m.read` if a server rejects private receipts, and this app does not update a public receipt or `m.fully_read` marker. Other clients on the same account can independently send public receipts. Thread-specific read state is not implemented.

The SDK may apply a local receipt echo before its HTTP request completes. Therefore a badge disappearing is **not proof of server acknowledgment**. Success text appears only after the request resolves; failures retain an explicit retry button even if the local count is already zero. Requests are coalesced per room. Unmounting removes adapter listeners, not the host's client or an already-issued request.

References: [Matrix receipts specification](https://spec.matrix.org/latest/client-server-api/#receipts), locked SDK `MatrixClient.sendReadReceipt` and `Room.getUnreadNotificationCount`.

Validation: controlled cases cover counts, exact targets, races, failure/retry and lifecycle. A regression using actual locked SDK Room/MatrixEvent models reproduces the stale total and verifies confirmed-receipt reconciliation without mutating host counters. A real two-user encrypted Synapse scenario checks explicit-only requests, an aborted request, a new message during a held receipt, server unread counts and absence of private/public acknowledgment in the other user's sync. See [VALIDATION.md](VALIDATION.md) for actual execution status; a test definition alone is not evidence of a passing run.
