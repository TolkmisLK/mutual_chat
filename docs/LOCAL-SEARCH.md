# Search loaded messages

The standalone app, desktop package and embedded widget share literal, case-insensitive search over the **current room's loaded messages**. NFC-normalized text handles equivalent composed accents. Query length is limited to 200 characters; search scans at most the latest 1,000 rendered messages, not the complete SDK cache or server archive. Message bodies marked redacted, encrypted placeholders or failed decryption are excluded. Search does not interpret regular expressions or HTML.

Enter a query to outline matches and reveal the first. Previous/next wrap through matching messages; the counter counts messages, not every repeated occurrence within one message. Incoming updates preserve the current matched event when possible. Messages are not hidden or removed by search. Clear, room change or unmount removes the query from the widget state. Load earlier messages explicitly to expand the search window within the existing history cap.

No search endpoint, read receipt, automatic pagination, persistent index, query parameter or browser-storage entry is created. This protects against transmitting a search query through this feature; it does not protect an unlocked page from same-origin malicious code, extensions, screenshots or OS memory inspection. JavaScript cannot guarantee secure memory erasure. Embedded hosts retain control of their session and can implement independent telemetry; this widget does not send search telemetry.

There is no cross-room search, server search, attachments/OCR search, semantic matching or complete-history indexing. The input is not a promise that older unloaded messages were searched.

Tests cover normalization/literal matching, limits/exclusions/duplicates, controlled real-browser widget navigation/lifecycle and actual decrypted Matrix messages. Actual accepted run evidence belongs in [VALIDATION.md](VALIDATION.md).
