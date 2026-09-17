# Retract an own message

The standalone app and embedded panel offer **撤回** only for your own sent events. Confirming asks the homeserver to redact that exact event through the Matrix SDK; it does not delete the room, another person's message or arbitrary server files. Pending local sends and non-member rooms are refused. Concurrent clicks on the same event share one request.

A rejected or ambiguous response is shown as unconfirmed, not successful. The adapter releases only its own failed SDK local redaction echo, identified by its transaction ID, so an explicit retry is possible without cancelling a host-owned send. It does not cancel an in-flight request on unmount; a late remote redaction can still arrive. The server may deny permission or enforce a retention policy. A local echo disappearing is not proof of server acknowledgment.

After the SDK receives redaction state, the message becomes a placeholder and is excluded from local search. This **does not erase** other people's screenshots, notifications, exports, backups, retained keys or previously downloaded copies. It is not secure deletion or a legal retention guarantee. Server metadata and the redaction event itself remain.

New core regressions and a two-user encrypted browser scenario cover own-message restrictions, confirmation cancellation, a controlled HTTP rejection followed by real-server retry, both clients receiving redaction, unrelated-message preservation and independent server-event inspection. Actual candidate CI is pending; no stable-release claim.
