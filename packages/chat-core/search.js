/** Local-only literal search. No request, index, storage or regular expressions. */
export function searchLoadedMessages(messages, query) {
  if (!Array.isArray(messages) || typeof query !== 'string' || query.length > 200) return [];
  const needle = query.trim().normalize('NFC').toLowerCase();
  if (!needle) return [];
  const seen = new Set(); const hits = [];
  for (const message of messages.slice(-1000)) {
    if (message.searchable === false || typeof message.id !== 'string' || !message.id || seen.has(message.id) || typeof message.text !== 'string') continue;
    seen.add(message.id);
    if (message.text.normalize('NFC').toLowerCase().includes(needle)) hits.push(message.id);
  }
  return hits;
}
