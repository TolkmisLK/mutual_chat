# 撤回自己发送的消息

独立应用和嵌入面板只对本人已发送的服务器事件显示“撤回”。确认后经 Matrix SDK 请求服务器撤回该确切事件；待发送的本地消息、非成员会话和他人消息不可撤回，同一事件的并发点击共用一次请求。取消确认不发请求。

失败或结果不明确时界面不会宣称成功，可以检查事件状态后重试。适配层只移除自身失败事务的本地撤回回显；面板卸载不取消已发出的服务器请求，稍后的撤回仍可能到达。服务器有权拒绝撤回。SDK 收到撤回状态后，消息成为占位符并退出本地搜索；本地回显消失不等于服务器确认。撤回不能抹去对方截图、通知、导出、备份或下载副本，服务器元数据和撤回事件本身也可能保留。

PR #12 的候选在 CI 通过 45 项单测、12 个浏览器场景及桌面/PostgreSQL 相关门槛；真实双用户加密场景检查双方同步与独立服务器事件。准确执行记录见 [VALIDATION.md](VALIDATION.md)。

---

# Retract an own message

The standalone app and embedded panel offer **撤回** only for your own sent events. Confirming asks the homeserver to redact that exact event through the Matrix SDK; it does not delete the room, another person's message or arbitrary server files. Pending local sends and non-member rooms are refused. Concurrent clicks on the same event share one request.

A rejected or ambiguous response is shown as unconfirmed, not successful. The adapter releases only its own failed SDK local redaction echo, identified by its transaction ID, so an explicit retry is possible without cancelling a host-owned send. It does not cancel an in-flight request on unmount; a late remote redaction can still arrive. The server may deny permission or enforce a retention policy. A local echo disappearing is not proof of server acknowledgment.

After the SDK receives redaction state, the message becomes a placeholder and is excluded from local search. This **does not erase** other people's screenshots, notifications, exports, backups, retained keys or previously downloaded copies. It is not secure deletion or a legal retention guarantee. Server metadata and the redaction event itself remain.

New core regressions and a two-user encrypted browser scenario cover own-message restrictions, confirmation cancellation, a controlled HTTP rejection followed by real-server retry, both clients receiving redaction, unrelated-message preservation and independent server-event inspection. Candidate 5887e493 passed the 45-test suite, 12 actual browser scenarios and Windows/Linux desktop plus PostgreSQL gates; see [VALIDATION.md](VALIDATION.md). This remains a development preview.
