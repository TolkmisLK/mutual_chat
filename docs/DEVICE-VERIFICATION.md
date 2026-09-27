# 同帐号设备 SAS 数字核对

独立应用可用官方 SDK 对同一帐号的另一台已列出设备发起 SAS 核对。两端打开“核对设备”，一端输入对方设备 ID，另一端核实请求身份并明确接受，再通过面对面或独立可信渠道逐个比较**全部三个数字**。不要只依赖未经核实的聊天转发数字确认。

请求不会自动打开、接受或确认；其他帐号、房间内核对和当前设备都不在此功能范围，仅提供 `m.sas.v1`。任一端可拒绝不一致或取消；关闭/锁定会拆监听并尝试按协议取消。发送 MAC 不代表成功，仍需 SDK 完成验证并在明确确认后报告本机设备信任。超时或对方不在线时应重试，不能手动标为可信。

此功能不是联系人身份验证、跨签名设置或首次远程备份；不会重置加密或创建/删除备份。临时登录关闭后本机信任状态会丢失；记住会话沿用现有加密 SDK 数据库。PR #14 的真实 Synapse 双上下文与受控 WASM 场景已分别验证不一致取消和双方确认，但后者的模拟传输不能替代真实服务器证据。嵌入组件的核对生命周期仍由宿主管理，详见 [VALIDATION.md](VALIDATION.md)。

---

# Same-account device SAS verification

The standalone app can request an official SDK SAS exchange with another listed device of the same account. Both devices open **核对设备**; enter the other device ID on one, inspect the request identity on the other, explicitly accept, and start number comparison. Compare all three numbers face-to-face or over an independently trusted channel. Never confirm based only on forwarded numbers in the unverified chat.

Incoming requests do not auto-open a dialog, accept, or confirm a SAS. Foreign accounts, room-based verification and the current device are excluded. Only `m.sas.v1` is advertised. Either side can reject a mismatch or cancel; closing/locking the app detaches listeners and attempts protocol cancellation. A MAC submission alone is not success: the SDK verifier must finish and report local device trust after explicit confirmation.

This is not peer/contact verification, a cross-signing setup wizard or first-time backup creation. It never calls trust setters, resets encryption, or creates/deletes a backup. The SDK may use existing cross-signing material during its protocol; the displayed success is deliberately limited to local device verification. Temporary sessions lose local trust on close; encrypted remembered sessions use the existing SDK database. An unavailable or timed-out counterpart must be retried, not marked trusted manually.

Controlled lifecycle/state tests and a two-context real Synapse/RustCrypto mismatch-then-confirmation scenario passed PR #14 acceptance (see [VALIDATION.md](VALIDATION.md)). Two additional real in-memory WASM tests use a simulated transport to pin request and completion shapes; they are not real-server interoperability evidence. The initial UI is standalone-only; embedded hosts continue to own their SDK verification lifecycle.
