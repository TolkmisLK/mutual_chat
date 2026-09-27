# 搜索已加载消息

独立 Web、桌面包和嵌入组件都只在**当前会话已经加载**的消息中做不区分大小写的字面量匹配，并使用 NFC 规范化处理组合重音。输入上限 200 字符，最多扫描最近 1000 条已渲染消息；已撤回、加密占位、解密失败和非文字内容被排除。它不解析正则表达式或 HTML。

输入后可在匹配消息间循环跳转，计数按消息而非同一消息内的重复词；搜索不会隐藏消息。切换会话、清除输入或卸载面板会清除查询。需要寻找更早内容时须手动“加载更早消息”，仍受 1000 条窗口限制。此功能不会向服务器发送搜索请求或已读回执，也不建持久索引或浏览器存储；它不保证已解锁页面免受同源恶意代码、扩展、截图或内存检查。嵌入宿主可能另有自己的遥测，此组件不发送搜索遥测。

没有跨会话、服务器全文、附件/OCR、语义或完整档案搜索。受控及真实加密浏览器验证见 [VALIDATION.md](VALIDATION.md)。

---

# Search loaded messages

The standalone app, desktop package and embedded widget share literal, case-insensitive search over the **current room's loaded messages**. NFC-normalized text handles equivalent composed accents. Query length is limited to 200 characters; search scans at most the latest 1,000 rendered messages, not the complete SDK cache or server archive. Message bodies marked redacted, encrypted placeholders or failed decryption are excluded. Search does not interpret regular expressions or HTML.

Enter a query to outline matches and reveal the first. Previous/next wrap through matching messages; the counter counts messages, not every repeated occurrence within one message. Incoming updates preserve the current matched event when possible. Messages are not hidden or removed by search. Clear, room change or unmount removes the query from the widget state. Load earlier messages explicitly to expand the search window within the existing history cap.

No search endpoint, read receipt, automatic pagination, persistent index, query parameter or browser-storage entry is created. This protects against transmitting a search query through this feature; it does not protect an unlocked page from same-origin malicious code, extensions, screenshots or OS memory inspection. JavaScript cannot guarantee secure memory erasure. Embedded hosts retain control of their session and can implement independent telemetry; this widget does not send search telemetry.

There is no cross-room search, server search, attachments/OCR search, semantic matching or complete-history indexing. The input is not a promise that older unloaded messages were searched.

Tests cover normalization/literal matching, limits/exclusions/duplicates, controlled real-browser widget navigation/lifecycle and actual decrypted Matrix messages. Actual accepted run evidence belongs in [VALIDATION.md](VALIDATION.md).
