export function mountBackupRecovery(controller, setShellBusy) {
  const dialog = document.createElement('dialog'); dialog.id = 'backup-dialog';
  dialog.innerHTML = '<h2>恢复已有的历史密钥备份</h2>' +
    '<p>输入此前在受信任 Matrix 客户端保存的恢复密钥。它不同于帐号密码或本机解锁口令。此功能不创建、覆盖或删除服务器上的备份，也不会将其他设备标记为已验证。</p>' +
    '<p>只能恢复备份已包含的密钥。未备份的消息、已删除的备份或丢失的恢复密钥无法由此功能找回。临时登录恢复的密钥仍只在本次窗口有效。</p>' +
    '<p id="backup-state" role="status"></p>' +
    '<label>Matrix 恢复密钥<input id="backup-key" type="password" autocomplete="off" maxlength="1024" spellcheck="false"></label>' +
    '<button id="backup-restore" type="button">恢复历史密钥</button>' +
    '<p id="backup-result" role="status"></p>' +
    '<button id="backup-close" type="button">关闭</button>';
  document.body.append(dialog); let busy = false; let disposed = false;
  const $ = selector => dialog.querySelector(selector);
  const say = text => { if (!disposed) $('#backup-result').textContent = text; };
  async function perform(action) {
    if (busy || disposed) return; busy = true; setShellBusy(true);
    for (const control of dialog.querySelectorAll('button,input')) control.disabled = true;
    try { await action(); }
    catch (error) { say(/^(恢|此|请|会)/.test(error.message || '') ? error.message : '恢复未完成，请核对帐号、恢复密钥、网络和备份状态。现有备份不会重置，可稍后重试。'); }
    finally {
      busy = false;
      if (!disposed) for (const control of dialog.querySelectorAll('button,input')) control.disabled = false;
      setShellBusy(false);
    }
  }
  $('#backup-restore').onclick = () => perform(async () => {
    say('正在恢复，请保持页面打开。较大的备份可能需要较长时间…'); let result;
    try { result = await controller.restore($('#backup-key').value, progress => say('正在恢复，已导入 ' + (progress.successes ?? 0) + ' 个密钥…')); }
    finally { $('#backup-key').value = ''; }
    say('恢复完成：备份包含 ' + result.total + ' 个密钥，本次导入 ' + result.imported + ' 个。');
  });
  const close = () => { if (busy) return; $('#backup-key').value = ''; dialog.close(); };
  $('#backup-close').onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  return {
    open() {
      if (disposed) return; dialog.showModal(); say('');
      perform(async () => {
        const state = await controller.status();
        if (!disposed) $('#backup-state').textContent = state ? '备份版本 ' + state.version + '，服务器已存储 ' + state.count + ' 个会话密钥。' : '尚无服务器密钥备份。首次备份设置仍待本应用后续实现。';
      });
    },
    dispose() { if (disposed) return; disposed = true; $('#backup-key').value = ''; dialog.close(); dialog.remove(); },
  };
}
