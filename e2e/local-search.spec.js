import { test, expect } from '@playwright/test';

test('embedded search navigates literal matches and clears per-room and unmount state without invoking host operations', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js'); const container = document.createElement('div'); document.body.append(container);
    let notify; let unsubscriptions = 0; let calls = 0;
    const session = { ready: true, rooms: () => [{ id: '!one', name: 'One', membership: 'join', encrypted: true }, { id: '!two', name: 'Two', membership: 'join', encrypted: true }],
      messages: () => [{ id: '$1', text: 'CAFÉ <img onerror=alert(1)>', sender: 'fixture', time: 1, status: 'sent' }, { id: '$2', text: 'cafe\u0301 second', sender: 'fixture', time: 2, status: 'sent' }, { id: '$3', text: 'CAFÉ', searchable: false, sender: 'fixture', time: 3, status: 'sent' }],
      subscribe: fn => { notify = fn; return () => { unsubscriptions++; }; },
      loadEarlier: () => { calls++; }, markRead: () => { calls++; }, sendText: () => { calls++; }, dispose: () => { calls++; } };
    const panel = mountChat(container, { session }); const root = container.firstChild.shadowRoot; root.querySelector('.room').click();
    const input = root.querySelector('.search-query'); input.value = 'cafe\u0301'; input.dispatchEvent(new Event('input'));
    const first = root.querySelector('.search-current')?.dataset.eventId; const count = root.querySelectorAll('.search-match').length;
    root.querySelector('.search-next').click(); const second = root.querySelector('.search-current')?.dataset.eventId;
    notify(); const retained = root.querySelector('.search-current')?.dataset.eventId === '$2';
    root.querySelector('.search-next').click(); const wrapped = root.querySelector('.search-current')?.dataset.eventId === '$1';
    root.querySelector('.search-prev').click(); const reversed = root.querySelector('.search-current')?.dataset.eventId === '$2';
    input.value = '<img onerror=alert(1)>'; input.dispatchEvent(new Event('input'));
    const literal = root.querySelector('.search-current')?.dataset.eventId === '$1' && root.querySelectorAll('img').length === 0;
    input.value = 'no match'; input.dispatchEvent(new Event('input')); const empty = root.querySelector('.search-next').disabled && root.querySelector('.search-state').textContent.includes('没有匹配');
    root.querySelectorAll('.room')[1].click(); const switched = input.value === '' && root.querySelectorAll('.search-match').length === 0;
    input.value = 'café'; input.dispatchEvent(new Event('input')); const staleInput = input.oninput; const staleNext = root.querySelector('.search-next').onclick;
    panel.unmount(); staleInput(); staleNext(); notify(); const detached = container.children.length === 0 && input.oninput === null;
    const secondPanel = mountChat(container, { session }); const cleanMount = container.firstChild.shadowRoot.querySelector('.search-query').value === ''; secondPanel.unmount(); container.remove();
    return { first, second, count, retained, wrapped, reversed, literal, empty, switched, detached, cleanMount, calls, unsubscriptions };
  });
  expect(result).toEqual({ first: '$1', second: '$2', count: 2, retained: true, wrapped: true, reversed: true, literal: true, empty: true, switched: true, detached: true, cleanMount: true, calls: 0, unsubscriptions: 2 });
});
