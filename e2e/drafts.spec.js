import { test, expect } from '@playwright/test';

test('room drafts survive switches and a late send cannot clear another room or newer edits', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js');
    const container = document.createElement('div'); document.body.append(container);
    let finish, fail; const calls = [];
    const session = { ready: true, rooms: () => ['a', 'b'].map(id => ({ id, name: id, membership: 'join', encrypted: true })),
      messages: () => [], subscribe: () => () => {},
      sendText: (room, text) => { calls.push({ room, text }); return new Promise((resolve, reject) => { finish = resolve; fail = reject; }); } };
    const panel = mountChat(container, { session }); const root = container.firstChild.shadowRoot;
    const input = root.querySelector('textarea'); const form = root.querySelector('section > form');
    const choose = room => [...root.querySelectorAll('.room')].find(node => node.textContent === room).click();
    const write = text => { input.value = text; input.dispatchEvent(new Event('input')); };
    const send = () => form.onsubmit({ preventDefault() {} });
    choose('a'); write('草稿 A'); choose('b'); const emptyB = input.value === '';
    write('草稿 B'); choose('a'); const restoredA = input.value === '草稿 A';
    const first = send(); await send(); choose('b'); finish(); await first;
    const preservedB = input.value === '草稿 B'; choose('a'); const clearedA = input.value === '';
    write('失败草稿'); const second = send(); choose('b'); fail(new Error('Controlled failure')); await second;
    const isolatedError = root.querySelector('.status').textContent === '' && input.value === '草稿 B';
    choose('a'); const failurePreserved = input.value === '失败草稿';
    const third = send(); write('修改中'); write('失败草稿'); finish(); await third;
    const editedDuringSend = input.value === '失败草稿';
    const fourth = send(); panel.unmount(); finish(); await fourth;
    const remounted = mountChat(container, { session });
    const next = container.firstChild.shadowRoot; next.querySelector('.room').click();
    const clearedOnUnmount = next.querySelector('textarea').value === '';
    remounted.unmount(); container.remove();
    return { emptyB, restoredA, preservedB, clearedA, isolatedError, failurePreserved, editedDuringSend, clearedOnUnmount, calls };
  });
  expect(result).toEqual({ emptyB: true, restoredA: true, preservedB: true, clearedA: true, isolatedError: true,
    failurePreserved: true, editedDuringSend: true, clearedOnUnmount: true,
    calls: [{ room: 'a', text: '草稿 A' }, ...Array.from({ length: 3 }, () => ({ room: 'a', text: '失败草稿' }))] });
});
