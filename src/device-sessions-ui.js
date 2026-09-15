export function mountDeviceSessions(controller, setShellBusy) {
  const dialog = document.createElement('dialog'); dialog.id = 'devices-dialog';
  dialog.innerHTML = '<h2>帐号设备会话</h2><p>只管理你自己帐号的登录设备，不代表设备身份已验证。移除会撤销该设备登录，但无法擦除已下载的消息、文件或密钥；未备份的历史密钥可能丢失。</p><div id="device-list"></div>' +
    '<section id="device-confirm" hidden><h3>确认移除此设备</h3><p id="device-target"></p><p>请核对设备 ID。当前正在使用的设备不能在这里移除。</p><button id="device-remove" type="button">确认移除设备</button><button id="device-cancel" type="button">取消移除</button></section>' +
    '<form id="device-auth" hidden><label>帐号密码<input id="device-password" type="password" autocomplete="current-password" maxlength="4096" required></label><p>服务器要求重新认证。密码只用于这次移除请求，不保存在本机。</p><button type="submit">认证并移除</button></form>' +
    '<p id="devices-status" role="status"></p><button id="devices-refresh" type="button">刷新设备列表</button><button id="devices-close" type="button">关闭</button>';
  document.body.append(dialog); const $ = selector => dialog.querySelector(selector);
  let busy = false; let disposed = false; let selected = null;
  const say = text => { if (!disposed) $('#devices-status').textContent = text; };
  function clear() { controller.cancel(); selected = null; $('#device-confirm').hidden = true; $('#device-auth').hidden = true; $('#device-remove').hidden = false; $('#device-password').value = ''; }
  function controls(disabled) {
    for (const node of dialog.querySelectorAll('button,input')) node.disabled = disabled || node.dataset.current === 'true';
  }
  async function perform(action) {
    if (busy || disposed) return; busy = true; controls(true); setShellBusy(true);
    try { await action(); }
    catch (error) { say(error.message?.match(/^(请|设备|服务器|会话|输入)/) ? error.message : '设备操作未完成，请刷新列表核对结果。'); }
    finally { busy = false; if (!disposed) controls(false); setShellBusy(false); }
  }
  async function refresh() {
    clear(); const devices = await controller.list(); if (disposed) return;
    $('#device-list').replaceChildren();
    for (const device of devices) {
      const row = document.createElement('div'); row.className = 'device-row'; row.dataset.deviceId = device.id;
      const label = document.createElement('p'); label.textContent = `${device.name || '未命名设备'} · ${device.id}${device.current ? ' · 当前设备' : ''}`;
      const seen = document.createElement('small'); seen.textContent = device.lastSeen ? '最近活跃：' + new Date(device.lastSeen).toLocaleString() : '最近活跃：服务器未提供';
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = device.current ? '当前设备' : '移除设备'; remove.dataset.current = String(device.current); remove.disabled = device.current;
      remove.onclick = () => { if (disposed || busy || device.current) return; clear(); selected = device.id; $('#device-target').textContent = `${device.name || '未命名设备'} · ${device.id}`; $('#device-confirm').hidden = false; say('请确认你要移除的设备。'); };
      row.append(label, seen, remove); $('#device-list').append(row);
    }
  }
  async function result(value) {
    if (disposed) return;
    if (value.removed) { await refresh(); say('已移除指定设备；其他设备和服务器消息不变。已有本地副本不会被擦除。'); }
    else { $('#device-auth').hidden = false; $('#device-remove').hidden = true; say(value.rejected ? '认证未通过，请核对帐号密码。' : '服务器要求帐号密码重新认证。'); }
  }
  $('#device-remove').onclick = () => perform(async () => { if (selected) await result(await controller.requestRemoval(selected)); });
  $('#device-auth').onsubmit = event => { event.preventDefault(); const password = $('#device-password').value; $('#device-password').value = ''; perform(async () => { await result(await controller.confirmPassword(password)); }); };
  $('#device-cancel').onclick = () => { if (!busy && !disposed) { clear(); $('#device-remove').hidden = false; say('已取消移除。'); } };
  $('#devices-refresh').onclick = () => perform(async () => { $('#device-remove').hidden = false; await refresh(); say('设备列表已刷新。'); });
  const close = () => { if (busy || disposed) return; clear(); dialog.close(); };
  const cancel = event => { event.preventDefault(); close(); };
  $('#devices-close').onclick = close; dialog.addEventListener('cancel', cancel);
  return { open() { if (disposed || busy) return; dialog.showModal(); $('#device-remove').hidden = false; perform(async () => { await refresh(); say('设备列表已刷新。'); }); },
    dispose() { if (disposed) return; disposed = true; $('#device-password').value = ''; dialog.removeEventListener('cancel', cancel); for (const button of dialog.querySelectorAll('button')) button.onclick = null; $('#device-auth').onsubmit = null; dialog.close(); dialog.remove(); } };
}
