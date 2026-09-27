# 帐号设备会话管理

独立 Web 与桌面应用可列出当前 Matrix 帐号的设备，并移除选中的**其他设备**登录。这是会话管理，不是设备密钥核对或跨签名；嵌入模块不接管宿主帐号。打开“设备会话”，按设备 ID 核对目标，明确确认后才发送移除请求；取消不发请求，当前设备请用正常退出流程。列表只展示设备 ID、显示名称和最后出现时间，不展示服务器提供的 IP；名称是普通文本，不证明设备归属。

移除交给官方 SDK 与服务器。若服务器要求交互式重新认证，此界面只支持剩余阶段为 `m.login.password` 的流程，并把帐号、目标设备和挑战绑定到原操作；本地挑战五分钟过期，取消/刷新/卸载会清理。密码输入在提交前清空，不存入保险箱或日志，但无法保证 JavaScript 字符串和已发请求物理清零。其他认证阶段会拒绝并提示使用兼容客户端，不绕过认证。

网络结果不明确时先刷新服务器设备列表再决定是否重试。服务器确认移除只撤销该设备令牌，不会远程擦除已下载副本、离线设备数据或已完成请求；未备份的本机历史密钥还可能因此丢失。此操作不删除房间历史、不重置备份、不旋转跨签名密钥。真实服务器 UIA、错误密码、旧令牌 401 等候选记录见 [VALIDATION.md](VALIDATION.md)。

---

# Account device sessions

The standalone Web and desktop shell can list devices belonging to its authenticated Matrix account. This is session management, not SAS/device-key verification or cross-signing. The embedded module does not take ownership of the host's account or expose this shell operation.

Open **设备会话**, identify another device by its ID, then choose removal and explicitly confirm the target. Cancelling before confirmation sends no deletion request. The current device is protected here; use normal logout for it. The list displays only the device ID, display name and last-seen timestamp; server-provided IP addresses are not rendered or exported. Names are plain text, not trusted markup or proof of ownership.

Removal delegates to the official Matrix SDK and the server's authenticated `/devices/{deviceId}` API. The server may accept the existing session or require User-Interactive Authentication. Only a flow whose remaining stage is `m.login.password` is supported here. The account identity, device target and server challenge are bound to the original operation. The challenge expires locally after five minutes and is cleared on cancellation, refresh or disposal. Password input is cleared before submission and is never added to a saved vault, log, report or controller property. JavaScript strings and an in-flight network request cannot be guaranteed to be physically zeroized. Unsupported authentication stages are refused and referred to a compatible client, never skipped.

An ambiguous network result is not reported as a successful removal: refresh and inspect the server's current list. Once the server confirms removal, the target's login is revoked, not its already downloaded data. In-flight requests may already have completed. Offline devices and local copies cannot be remotely erased, and unbacked-up local historical keys may be lost. This operation does not delete room history, reset backups, rotate cross-signing keys or mark a device trusted.

Validation must separately cover server-required reauthentication, a wrong password, confirmation cancellation, old-token rejection, preservation of the current device and room events, and lifecycle cleanup. Unit substitutes are not proof of server revocation. See [VALIDATION.md](VALIDATION.md) for the recorded candidate status.

Reference: [Matrix Client-Server API](https://spec.matrix.org/latest/client-server-api/#delete_matrixclientv3devicesdeviceid).
