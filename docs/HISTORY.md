# Loading earlier messages

Select a joined room and choose **加载更早消息**. The panel initially renders at most 200 recent message events. Each explicit action reveals up to 50 more cached messages or asks the Matrix SDK for one backward page of up to 50 events. State-only pages may require another action; the app never loops automatically. Network failures preserve the visible timeline and allow a manual retry. The SDK owns server pagination, event decryption and request backoff.

The component keeps the first visible event at the same relative scroll position while older events arrive, instead of jumping to the bottom. Duplicate event IDs are rendered once. Room switching does not apply the old room's async completion to a different room. Each room shares its pending request across panels using the same ChatSession. Unmounting an owned adapter detaches its observers; it does not cancel the host SDK's in-flight request or log out the host. Shared-session pagination state remains with that session, while a new adapter starts with the default view size.

The preview stops expanding at 1,000 rendered messages per room and labels that boundary. This is a rendered-DOM limit, **not** a bound on the host SDK's history cache, a full-history archive, search or a guarantee that older messages are absent. New live events can shift the oldest displayed message out of this window. Future timeline-window navigation is needed for arbitrarily long histories. The “history beginning” label means the SDK has no further accessible backward token and there are no hidden cached messages; server retention and room membership may restrict access.

Pagination does not grant missing encryption keys. Existing backup recovery can recover only keys included in the user's available backup. Unrecoverable messages remain a missing-key placeholder; source ciphertext and internal decryption-error bodies are not shown as message text.

Implementation uses the locked SDK's [MatrixClient.scrollback](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#scrollback) and room backward pagination token. Actual test results are tracked in [VALIDATION.md](VALIDATION.md).
