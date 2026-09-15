// Account-device management only: never marks devices verified or changes backup keys.
export class DeviceSessions {
  constructor(client, now = () => Date.now()) {
    if (!client?.getDevices || !client?.deleteDevice || !client?.getUserId || !client?.getDeviceId) throw new TypeError('An authenticated Matrix client is required');
    this.client = client; this.now = now; this.closed = false; this.busy = false; this.known = new Map(); this.challenge = null;
  }
  assertOpen() { if (this.closed) throw new Error('会话管理已关闭。'); }
  async operation(action) {
    this.assertOpen(); if (this.busy) throw new Error('设备操作仍在进行。'); this.busy = true;
    try { return await action(); } finally { this.busy = false; }
  }
  async list() {
    return this.operation(async () => {
      this.challenge = null;
      const { devices } = await this.client.getDevices(); this.assertOpen();
      if (!Array.isArray(devices)) throw new Error('设备列表格式不正确。');
      const known = new Map();
      for (const device of devices) {
        if (typeof device?.device_id !== 'string' || !device.device_id || device.device_id.length > 255) continue;
        known.set(device.device_id, { id: device.device_id, name: typeof device.display_name === 'string' ? device.display_name.slice(0,200) : '',
          current: device.device_id === this.client.getDeviceId(), lastSeen: Number.isSafeInteger(device.last_seen_ts) && device.last_seen_ts > 0 ? device.last_seen_ts : null });
      }
      this.known = known; return [...known.values()];
    });
  }
  target(id) {
    if (!this.known.has(id)) throw new Error('请先刷新设备列表并选择目标。');
    if (id === this.client.getDeviceId()) throw new Error('请使用退出帐号来撤销当前设备。');
  }
  async requestRemoval(id) {
    return this.operation(async () => {
      this.target(id); this.challenge = null;
      return this.remove(id);
    });
  }
  async confirmPassword(password) {
    return this.operation(async () => {
      const challenge = this.challenge;
      if (!challenge || this.now() >= challenge.expires) { this.challenge = null; throw new Error('请重新选择设备并确认移除。'); }
      this.target(challenge.id);
      if (typeof password !== 'string' || !password || password.length > 4096) throw new Error('请输入有效的帐号密码。');
      this.challenge = null;
      return this.remove(challenge.id, { type: 'm.login.password', identifier: { type: 'm.id.user', user: this.client.getUserId() }, password, session: challenge.session });
    });
  }
  async remove(id, auth) {
    try {
      await this.client.deleteDevice(id, auth); this.assertOpen();
      this.known.delete(id); this.challenge = null; return { removed: true, id };
    } catch (error) {
      this.assertOpen();
      const data = error?.data;
      if (error?.httpStatus === 401 && data && Array.isArray(data.flows)) {
        const completed = Array.isArray(data.completed) ? data.completed : [];
        const passwordOnly = data.flows.some(flow => Array.isArray(flow.stages) && flow.stages.filter(stage => !completed.includes(stage)).length === 1 && flow.stages.filter(stage => !completed.includes(stage))[0] === 'm.login.password');
        if (!passwordOnly || typeof data.session !== 'string' || !data.session || data.session.length > 4096) throw new Error('服务器要求其他认证方式，请使用受支持的客户端管理设备。');
        this.challenge = { id, session: data.session, expires: this.now() + 5 * 60 * 1000 };
        return { removed: false, passwordRequired: true, rejected: Boolean(auth), id };
      }
      throw new Error('设备移除未确认。请刷新列表核对结果，不要假定已退出对方设备。');
    }
  }
  cancel() { if (!this.busy) this.challenge = null; }
  dispose() { this.closed = true; this.challenge = null; this.known.clear(); }
}
