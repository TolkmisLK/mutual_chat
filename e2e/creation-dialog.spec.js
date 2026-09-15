import { test, expect } from '@playwright/test';

test('application creation dialog cancels, retries and ignores duplicate or detached completion', async ({ page }) => {
  await page.goto('http://127.0.0.1:14174');
  const result = await page.evaluate(async () => {
    const { mountChat } = await import('/widget/mutual-chat.js');
    const container = document.createElement('div'); document.body.append(container);
    let attempts = 0; let finish; const names = []; const invites = []; let unsubscribe = 0;
    const session = { ready: true, rooms: () => [], messages: () => [],
      subscribe: () => () => { unsubscribe++; },
      createRoom: async (name, members) => { attempts++; names.push(name); invites.push(members); if (attempts === 1) throw new Error('Controlled failure'); return new Promise(resolve => { finish = resolve; }); } };
    const panel = mountChat(container, { session }); const root = container.firstChild.shadowRoot;
    const dialog = root.querySelector('dialog'); const form = dialog.querySelector('form');
    const name = form.querySelector('[name=name]'); const members = form.querySelector('[name=invites]');
    root.querySelector('.create').click(); name.value = 'discarded draft'; root.querySelector('.cancel-create').click();
    const cancelled = !dialog.open && name.value === '' && attempts === 0;
    root.querySelector('.create').click(); name.value = 'retry room'; members.value = ' @one:example.org, @two:example.org ';
    const submit = form.onsubmit; await submit({ preventDefault() {} });
    const failurePreservedDraft = dialog.open && name.value === 'retry room' && root.querySelector('.create-error').textContent.includes('创建失败') && !name.disabled;
    const pending = submit({ preventDefault() {} }); await submit({ preventDefault() {} });
    const duplicatePrevented = attempts === 2 && [...form.querySelectorAll('button,input')].every(control => control.disabled);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true })); const pendingCancelPrevented = dialog.open;
    panel.unmount(); panel.unmount(); finish({ room_id: '!fixture:example.org' }); await pending;
    await submit({ preventDefault() {} });
    const detachedIgnored = !dialog.open && container.children.length === 0 && attempts === 2 && unsubscribe === 1;
    container.remove();
    return { cancelled, failurePreservedDraft, duplicatePrevented, pendingCancelPrevented, detachedIgnored, names, invites };
  });
  expect(result).toEqual({ cancelled: true, failurePreservedDraft: true, duplicatePrevented: true, pendingCancelPrevented: true, detachedIgnored: true, names: ['retry room', 'retry room'], invites: [['@one:example.org', '@two:example.org'], ['@one:example.org', '@two:example.org']] });
});
