import { validateHomeserver } from '../../packages/chat-core/session.js';

export function prepareHost(server, { secureContext, locks }) {
  if (!secureContext) throw Object.assign(new Error(), { setupCode: 'secure-context' });
  if (!locks) throw Object.assign(new Error(), { setupCode: 'web-locks' });
  try { return validateHomeserver(server); }
  catch { throw Object.assign(new Error(), { setupCode: 'server-address' }); }
}

// Only fixed messages are shown: SDK responses can contain private server data.
export function connectionHint(error, stage) {
  const hints = {
    'secure-context': '请通过 HTTPS 或本机 localhost 打开示例，浏览器加密需要安全环境。',
    'web-locks': '当前浏览器不支持 Web Locks，请使用支持该功能的浏览器。',
    'server-address': '服务器地址无效：远程服务须使用 HTTPS，且不能带帐号密码、查询参数或片段。',
    'window-busy': '另一个示例窗口正在使用聊天连接，请先在该窗口退出帐号。',
  };
  if (hints[error?.setupCode]) return hints[error.setupCode];
  if (stage === 'login' && (error?.errcode === 'M_FORBIDDEN' || error?.httpStatus === 401)) return '登录被拒绝，请核对服务器、用户 ID 和密码；帐号须支持密码登录。';
  if (stage === 'login' && (error?.errcode === 'M_LIMIT_EXCEEDED' || error?.httpStatus === 429)) return '服务器暂时限制登录，请稍后重试。';
  if (stage === 'crypto') return '加密存储初始化失败，请检查浏览器存储权限和可用空间，再重试。';
  return '连接未完成，请检查服务器是否可访问、证书是否可信及跨来源设置，再重试。';
}
