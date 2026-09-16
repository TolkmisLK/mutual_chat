# Private read state

Room badges display the Matrix SDK's **unread notification count**, not a complete count of all unread messages. Push rules, muted rooms, encryption/key availability and sync affect this value. The badge is capped visually at 999+; no independent local counter is persisted.

Opening a room, scrolling, decrypting history or mounting an embedded panel does not send a read receipt. The explicit **标为已读（仅自己）** button sends `m.read.private` for the latest loaded, decrypted, received message captured when clicked. It is a room-wide acknowledgment through that event, not a claim that every message was actually visible on screen. Pending local sends and missing-key placeholders cannot be targets. A newer event arriving while the request is in progress is not silently substituted.

The homeserver and the user's other devices can see the private read position. Other room members should not receive it. This is protocol privacy, not encryption from the homeserver. There is no fallback to public `m.read` if a server rejects private receipts, and this app does not update a public receipt or `m.fully_read` marker. Other clients on the same account can independently send public receipts. Thread-specific read state is not implemented.

The SDK may apply a local receipt echo before its HTTP request completes. Therefore a badge disappearing is **not proof of server acknowledgment**. Success text appears only after the request resolves; failures retain an explicit retry button even if the local count is already zero. Requests are coalesced per room. Unmounting removes adapter listeners, not the host's client or an already-issued request.

References: [Matrix receipts specification](https://spec.matrix.org/latest/client-server-api/#receipts), locked SDK `MatrixClient.sendReadReceipt` and `Room.getUnreadNotificationCount`.

Validation: four controlled unit cases cover counts, exact targets, races, failure/retry and lifecycle. A real two-user encrypted Synapse scenario checks explicit-only requests, an aborted request, a new message during a held receipt, server unread counts and absence of private/public acknowledgment in the other user's sync. See [VALIDATION.md](VALIDATION.md) for actual execution status; a test definition alone is not evidence of a passing run.
