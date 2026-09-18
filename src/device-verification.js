import { VerificationPhase as Phase, VerifierEvent, VerificationRequestEvent } from 'matrix-js-sdk/lib/crypto-api/verification.js';
import { CryptoEvent } from 'matrix-js-sdk/lib/crypto-api/CryptoEvent.js';

// SAS for another device of this account only. Never resets cross-signing or
// backups, and never substitutes a local "trust" setter for the SDK protocol.
export class DeviceVerification {
  constructor(client, changed = () => {}) {
    this.client = client; this.crypto = client.getCrypto(); this.changed = changed;
    this.closed = false; this.busy = false; this.request = null; this.verifier = null; this.epoch = 0;
    this.sas = null; this.confirmed = false; this.verified = false; this.message = '请在两台设备上打开身份核对。';
    this.onIncoming = request => { if (!this.closed && !this.request?.pending && !this.busy && this.allowed(request)) this.adopt(request); };
    this.onChange = () => this.update(); this.onSas = () => this.update();
    client.on(CryptoEvent.VerificationRequestReceived, this.onIncoming);
  }
  allowed(request, expectedDeviceId) {
    if (request?.otherUserId !== this.client.getUserId() || request.roomId) return false;
    const valid = id => typeof id === 'string' && id.length > 0 && id.length <= 255 && id !== this.client.getDeviceId();
    // Rust leaves otherDeviceId unset on a newly created outgoing request,
    // even though requestDeviceVerification sent it to one exact device.
    // Only that locally bound Requested flow may temporarily omit the ID.
    if (request.otherDeviceId === undefined) return valid(expectedDeviceId) && request.initiatedByMe && request.phase === Phase.Requested;
    return valid(request.otherDeviceId) && (!expectedDeviceId || request.otherDeviceId === expectedDeviceId);
  }
  notify() { if (!this.closed) this.changed(this.snapshot()); }
  snapshot() {
    const request = this.request;
    return { deviceId: request ? this.target : '', phase: request?.phase || 0,
      incoming: Boolean(request && !request.initiatedByMe), busy: this.busy,
      decimal: this.sas?.sas.decimal?.slice() || null, confirmed: this.confirmed,
      verified: this.verified, message: this.message };
  }
  detach() {
    this.request?.off(VerificationRequestEvent.Change, this.onChange);
    this.verifier?.off(VerifierEvent.ShowSas, this.onSas);
    this.request = null; this.verifier = null; this.sas = null; this.confirmed = false; this.verified = false;
  }
  adopt(request, target = request.otherDeviceId) {
    if (this.closed || !this.allowed(request, target)) return false;
    this.detach(); this.request = request; this.target = target; this.accepted = request.initiatedByMe;
    request.on(VerificationRequestEvent.Change, this.onChange); this.update(); return true;
  }
  update() {
    if (this.closed || !this.request) return;
    const request = this.request;
    if (!this.allowed(request, this.target)) { this.sas = null; this.message = '设备身份改变，核对已停止。'; this.notify(); return; }
    if (request.phase === Phase.Cancelled) { this.sas = null; this.verified = false; this.message = '核对已取消或超时，设备未被本次核对确认。'; }
    else if (request.phase === Phase.Done) { this.sas = null; this.message = this.verified ? '此设备已通过本机 SAS 核对。' : '正在核对 SDK 的设备信任结果…'; }
    else if (request.phase === Phase.Requested) this.message = request.initiatedByMe ? '等待另一台设备接受请求。' : '请先核对下方设备 ID，再接受请求。';
    else if (request.phase === Phase.Ready) this.message = '双方已接受请求，请开始数字核对。';
    else if (request.phase === Phase.Started) this.message = this.confirmed ? '已确认本机数字，等待对方完成。' : '请通过面对面或可信渠道比较两台设备上的全部三个数字。';
    if (this.accepted && request.phase === Phase.Started && request.chosenMethod === 'm.sas.v1' && request.verifier && !this.verifier) {
      const verifier = request.verifier; this.verifier = verifier;
      verifier.on(VerifierEvent.ShowSas, this.onSas);
      // This continues the protocol after an explicitly accepted request. It
      // never confirms the displayed SAS on the user's behalf.
      Promise.resolve().then(() => verifier.verify()).then(async () => {
        const status = await this.crypto.getDeviceVerificationStatus(this.client.getUserId(), this.target);
        if (this.closed || this.request !== request || this.verifier !== verifier) return;
        this.verified = this.allowed(request, this.target) && request.phase === Phase.Done && this.confirmed && status?.localVerified === true;
        this.message = this.verified ? '此设备已通过本机 SAS 核对。' : '协议结束，但本机尚未确认设备信任；不要假定已验证。';
        this.sas = null; this.notify();
      }).catch(() => { if (!this.closed && this.request === request) { this.sas = null; this.verified = false; this.message = '核对未完成或已取消，请重新发起。'; this.notify(); } });
    }
    if (this.verifier && request.phase === Phase.Started && !this.confirmed) {
      const callbacks = this.verifier.getShowSasCallbacks(); const numbers = callbacks?.sas?.decimal;
      this.sas = Array.isArray(numbers) && numbers.length === 3 && numbers.every(n => Number.isInteger(n) && n >= 0 && n <= 9999) ? callbacks : null;
    }
    this.notify();
  }
  async operation(action) {
    if (this.closed || this.busy) throw new Error('核对操作不可用。');
    this.busy = true; this.notify();
    try { return await action(); }
    finally { this.busy = false; this.notify(); }
  }
  async begin(deviceId) {
    return this.operation(async () => {
      const epoch = this.epoch;
      if (this.request?.pending) throw new Error('请先取消当前核对。');
      if (typeof deviceId !== 'string' || !deviceId || deviceId.length > 255 || deviceId === this.client.getDeviceId()) throw new Error('请选择同一帐号的另一设备 ID。');
      const { devices } = await this.client.getDevices();
      if (!devices.some(d => d.device_id === deviceId)) throw new Error('设备不在此帐号的当前列表中。');
      // For our tracked own user SDK 42.3 refreshes /keys/query through the
      // Rust outgoing-request processor here. getUserDeviceInfo alone may
      // return an older cached list (or an HTTP-only untracked list). This
      // read-only query does not bootstrap or replace cross-signing keys.
      await this.crypto.userHasCrossSigningKeys(this.client.getUserId(), true);
      if (this.closed || epoch !== this.epoch) return;
      await this.crypto.getUserDeviceInfo([this.client.getUserId()], true);
      if (this.closed || epoch !== this.epoch) return;
      const request = await this.crypto.requestDeviceVerification(this.client.getUserId(), deviceId);
      if (this.closed || epoch !== this.epoch) { await request.cancel(); return; }
      if (!this.allowed(request, deviceId)) { await request.cancel(); throw new Error('服务器返回了不同的核对目标。'); }
      this.adopt(request, deviceId);
    });
  }
  async accept() {
    return this.operation(async () => {
      const request = this.request;
      if (!request || request.initiatedByMe || request.phase !== Phase.Requested || !this.allowed(request, this.target)) throw new Error('没有可接受的核对请求。');
      this.accepted = true;
      try { await request.accept(); } catch (error) { this.accepted = false; throw error; }
      this.update();
    });
  }
  async start() {
    return this.operation(async () => {
      const request = this.request;
      if (!request || !this.allowed(request, this.target) || request.phase !== Phase.Ready || !request.otherPartySupportsMethod('m.sas.v1')) throw new Error('双方尚未准备好进行 SAS 核对。');
      await request.startVerification('m.sas.v1'); this.update();
    });
  }
  async match() {
    return this.operation(async () => {
      const request = this.request, sas = this.sas;
      if (!sas || this.confirmed || request?.phase !== Phase.Started || !this.allowed(request) || request.otherDeviceId !== this.target) throw new Error('数字核对已失效。');
      this.confirmed = true; this.sas = null; this.notify();
      try { await sas.confirm(); }
      catch (error) { this.confirmed = false; throw error; }
      this.update();
    });
  }
  async cancel(mismatch = false) {
    this.epoch++;
    const request = this.request; const sas = this.sas; this.detach();
    if (mismatch && sas) sas.mismatch();
    else if (request?.pending) await request.cancel();
    if (!this.closed) { this.message = '核对已取消；没有确认这些数字匹配。'; this.notify(); }
  }
  dispose() {
    if (this.closed) return; this.closed = true; this.epoch++;
    const request = this.request; this.client.off(CryptoEvent.VerificationRequestReceived, this.onIncoming); this.detach();
    if (request?.pending) request.cancel().catch(() => {});
  }
}
