# Account device sessions

The standalone Web and desktop shell can list devices belonging to its authenticated Matrix account. This is session management, not SAS/device-key verification or cross-signing. The embedded module does not take ownership of the host's account or expose this shell operation.

Open **设备会话**, identify another device by its ID, then choose removal and explicitly confirm the target. Cancelling before confirmation sends no deletion request. The current device is protected here; use normal logout for it. The list displays only the device ID, display name and last-seen timestamp; server-provided IP addresses are not rendered or exported. Names are plain text, not trusted markup or proof of ownership.

Removal delegates to the official Matrix SDK and the server's authenticated `/devices/{deviceId}` API. The server may accept the existing session or require User-Interactive Authentication. Only a flow whose remaining stage is `m.login.password` is supported here. The account identity, device target and server challenge are bound to the original operation. The challenge expires locally after five minutes and is cleared on cancellation, refresh or disposal. Password input is cleared before submission and is never added to a saved vault, log, report or controller property. JavaScript strings and an in-flight network request cannot be guaranteed to be physically zeroized. Unsupported authentication stages are refused and referred to a compatible client, never skipped.

An ambiguous network result is not reported as a successful removal: refresh and inspect the server's current list. Once the server confirms removal, the target's login is revoked, not its already downloaded data. In-flight requests may already have completed. Offline devices and local copies cannot be remotely erased, and unbacked-up local historical keys may be lost. This operation does not delete room history, reset backups, rotate cross-signing keys or mark a device trusted.

Validation must separately cover server-required reauthentication, a wrong password, confirmation cancellation, old-token rejection, preservation of the current device and room events, and lifecycle cleanup. Unit substitutes are not proof of server revocation. See [VALIDATION.md](VALIDATION.md) for the recorded candidate status.

Reference: [Matrix Client-Server API](https://spec.matrix.org/latest/client-server-api/#delete_matrixclientv3devicesdeviceid).
