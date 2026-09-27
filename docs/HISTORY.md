# 加载更早消息

进入已加入的会话，点击“加载更早消息”。面板最初最多显示近期 200 条消息；每次手动操作最多显示 50 条已有缓存消息，或请求 SDK 向前拉取一页（最多 50 条）。仅含状态事件的一页可能需再点一次；应用不会无限自动翻页。网络失败保留当前时间线并允许重试，分页、解密与请求退避由 SDK 管理。

较早消息插入时尽量保持首个可见事件的相对滚动位置；相同事件 ID 只渲染一次。切换房间不会把前房间的异步结果应用到新房间；同一 `ChatSession` 的多个面板共享待完成请求。卸载自管适配层只拆监听，不取消宿主 SDK 请求或退出帐号。共享会话的分页状态仍在 session 中，新建适配层则从默认显示数量开始。

预览版每会话最多渲染 1000 条，限制的是 DOM 窗口，**不是** SDK 缓存、完整服务器历史或全局搜索上限。新消息会让最老的可见消息移出窗口；任意长历史仍需未来的时间线窗口导航。“已到开头”只表示当前 SDK 无可访问的更早分页令牌且没有隐藏缓存；服务器保留策略与成员资格也会限制可见历史。分页不能补回缺失密钥，只有已有备份中实际存在的密钥可恢复。准确测试记录见 [VALIDATION.md](VALIDATION.md)。

---

# Loading earlier messages

Select a joined room and choose **加载更早消息**. The panel initially renders at most 200 recent message events. Each explicit action reveals up to 50 more cached messages or asks the Matrix SDK for one backward page of up to 50 events. State-only pages may require another action; the app never loops automatically. Network failures preserve the visible timeline and allow a manual retry. The SDK owns server pagination, event decryption and request backoff.

The component keeps the first visible event at the same relative scroll position while older events arrive, instead of jumping to the bottom. Duplicate event IDs are rendered once. Room switching does not apply the old room's async completion to a different room. Each room shares its pending request across panels using the same ChatSession. Unmounting an owned adapter detaches its observers; it does not cancel the host SDK's in-flight request or log out the host. Shared-session pagination state remains with that session, while a new adapter starts with the default view size.

The preview stops expanding at 1,000 rendered messages per room and labels that boundary. This is a rendered-DOM limit, **not** a bound on the host SDK's history cache, a full-history archive, search or a guarantee that older messages are absent. New live events can shift the oldest displayed message out of this window. Future timeline-window navigation is needed for arbitrarily long histories. The “history beginning” label means the SDK has no further accessible backward token and there are no hidden cached messages; server retention and room membership may restrict access.

Pagination does not grant missing encryption keys. Existing backup recovery can recover only keys included in the user's available backup. Unrecoverable messages remain a missing-key placeholder; source ciphertext and internal decryption-error bodies are not shown as message text.

Implementation uses the locked SDK's [MatrixClient.scrollback](https://matrix-org.github.io/matrix-js-sdk/classes/matrix.MatrixClient.html#scrollback) and room backward pagination token. Actual test results are tracked in [VALIDATION.md](VALIDATION.md).
