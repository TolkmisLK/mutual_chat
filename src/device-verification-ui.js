import { DeviceVerification } from './device-verification.js';

export function mountDeviceVerification(client) {
  const dialog = document.createElement('dialog'); dialog.id = 'verification-dialog';
  dialog.innerHTML = '<h2>核对自己的另一台设备</h2><p>仅用于同一帐号的设备。先核对两边的帐号和设备 ID，再通过面对面或独立可信渠道比较全部三个数字。不要把数字发送给陌生人，也不要仅根据聊天中转发的数字确认。</p>' +
    '<p id="verification-account"></p><label>另一设备 ID<input id="verification-device" maxlength="255" autocomplete="off"></label><button id="verification-begin" type="button">发起设备核对</button>' +
    '<p id="verification-target"></p><p id="verification-state" role="status"></p><button id="verification-accept" type="button" hidden>接受此设备请求</button><button id="verification-start" type="button" hidden>开始数字核对</button>' +
    '<p id="verification-numbers" hidden style="font-size:1.5rem;font-variant-numeric:tabular-nums;overflow-wrap:anywhere"></p><button id="verification-match" type="button" hidden>三个数字全部相同</button><button id="verification-mismatch" type="button" hidden>数字不同，拒绝</button>' +
    '<p>本机设备信任不等于联系人身份验证、首次密钥备份或完整跨设备签名配置。临时会话关闭后本机信任也会丢失。</p><button id="verification-close" type="button">取消并关闭</button>';
  document.body.append(dialog); const $ = id => dialog.querySelector('#verification-' + id); let disposed = false;
  $('account').textContent = `${client.getUserId()} · 当前设备 ${client.getDeviceId()}`;
  const controller = new DeviceVerification(client, state => {
    if (disposed) return;
    $('target').textContent = state.deviceId ? '核对目标设备：' + state.deviceId : '';
    $('state').textContent = state.message;
    // Boolean/enum completion diagnostics only: never keys, tokens or errors.
    dialog.dataset.verificationResult = JSON.stringify(state.result);
    $('begin').disabled = state.busy || (state.phase >= 2 && state.phase <= 4);
    $('device').disabled = $('begin').disabled;
    $('accept').hidden = !(state.incoming && state.phase === 2);
    $('start').hidden = state.phase !== 3;
    $('numbers').hidden = !state.decimal; $('numbers').textContent = state.decimal?.join(' · ') || '';
    $('match').hidden = !state.decimal || state.confirmed;
    $('mismatch').hidden = !state.decimal || state.confirmed;
    for (const id of ['accept', 'start', 'match', 'mismatch']) $(id).disabled = state.busy;
  });
  async function perform(action) {
    try { await action(); }
    catch (error) { if (!disposed) $('state').textContent = error?.message === 'Not a known device'
      ? '加密引擎尚未取得目标设备密钥。请确认另一设备已联网同步，再重试；设备未被验证。'
      : ['请选择同一帐号的另一设备 ID。', '设备不在此帐号的当前列表中。', '服务器返回了不同的核对目标。', '请先取消当前核对。'].includes(error?.message)
        ? error.message
        : '核对操作未完成。请取消后重新核对，不要假定设备已验证。'; }
  }
  $('begin').onclick = () => perform(() => controller.begin($('device').value.trim()));
  $('accept').onclick = () => perform(() => controller.accept());
  $('start').onclick = () => perform(() => controller.start());
  $('match').onclick = () => perform(() => controller.match());
  $('mismatch').onclick = () => perform(() => controller.cancel(true));
  const close = () => { if (disposed) return; $('numbers').textContent = ''; $('device').value = ''; dialog.close(); perform(() => controller.cancel()); };
  const cancel = event => { event.preventDefault(); close(); };
  $('close').onclick = close; dialog.addEventListener('cancel', cancel);
  return {
    open() { if (!disposed) { controller.notify(); dialog.showModal(); } },
    dispose() { if (disposed) return; disposed = true; controller.dispose(); for (const b of dialog.querySelectorAll('button')) b.onclick = null; dialog.removeEventListener('cancel', cancel); dialog.close(); dialog.remove(); },
  };
}
