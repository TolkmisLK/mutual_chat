# 独立桌面预览包

桌面包使用固定 Electron 44.3.0 装载现有独立应用，与嵌入 ES 模块分开。当前没有签名安装器、自动更新、公共服务或移动端。渲染进程只加载打包来源；关闭 Node 集成，启用上下文隔离与 Chromium 沙箱，不通过 preload/IPC 暴露文件、命令或令牌接口。自定义协议只提供入口页与编译资源；远端导航、弹窗、WebView 和下载被拒绝。远程 Matrix 仍须可信 HTTPS，不提供跳过证书错误的开关。

临时/记住会话逻辑与 Web 版相同；桌面资料位于 Electron 用户数据目录，和浏览器资料隔离，不自动导入。每份资料只允许一个进程。关闭窗口不会撤销服务器设备，需明确退出；删除资料可能失去未备份的历史密钥。

Windows 构建者在 Node.js 22.12+ 环境执行：

```sh
npm ci --ignore-scripts
npm run build
node tool/build-desktop.js win32
```

产物是 `dist/desktop` 下的未签名 x64 完整目录，分发时保留整个目录与运行时许可证，不携带测试资料或凭据。Windows CI 做过实际打包窗口启动，Linux CI 用两个 Electron 进程完成本机 Synapse 加密互通与记住会话重启；这不证明消费者 Windows 的 Matrix 互通、真实远程 TLS、物理设备或安装更新流程。准确结果见 [VALIDATION.md](VALIDATION.md)。

---

# Independent desktop preview

The desktop package embeds the existing standalone application with pinned Electron 44.3.0. It remains separate from the ES widget and Web distributions. Packaging and protocol-policy source alone do not establish native runtime acceptance; see VALIDATION.md for actual results. No signed installer, automatic update service, public homeserver or mobile client is included.

The renderer loads only the packaged app origin. Node integration is disabled, context isolation and the Chromium sandbox stay enabled, and no preload/IPC bridge exposes filesystem, shell or token APIs. The custom protocol serves only the entry page and compiled assets. Remote navigation, popups, webviews and downloads are denied. Remote Matrix servers still require trusted HTTPS; there is no certificate-error override. This initial text-only package does not request camera, microphone or notification permissions.

Temporary and remembered sessions use the same application logic as the Web version. Remembered credentials and SDK database keys use the user's local passphrase; profile data lives under Electron's user-data directory, outside the application bundle. Browser and desktop profiles are separate and are not silently imported. One process per profile is permitted. Closing the desktop quits its process; it does not revoke the server device. Use explicit logout to request revocation. Deleting a profile may lose unbacked-up history keys.

Build with Node 22.12+ and the lockfile: `npm ci --ignore-scripts`, `npm run build`, then `node tool/build-desktop.js win32` on the Windows builder. The packager downloads the pinned official Electron runtime and creates an unsigned x64 directory under dist/desktop. Keep the entire resulting directory and the runtime's license files. Do not distribute test profiles or credentials.

The room-creation form uses an application dialog instead of browser prompt(), which Electron does not support. Existing Web/embedded tests must continue to pass with this shared change. Physical Windows installation, trusted TLS against an operator's actual service, signing, update policy and native lifecycle acceptance remain release gates.

The CI native Matrix scenario packages the same app for Linux x64 on Ubuntu 22.04 and runs two isolated real Electron processes under Xvfb, with Chromium sandboxing explicitly enabled. It uses generated accounts on the loopback Synapse fixture, checks encrypted exchange, closes and reopens a remembered profile, and checks the original device can decrypt history and continue sending. It must pass before being recorded as evidence; it is not Windows Matrix interoperability or physical-device acceptance. No OS sandbox restrictions are disabled, certificate errors ignored, profiles uploaded or cryptographic SDK calls replaced.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [custom protocols](https://www.electronjs.org/docs/latest/api/protocol).
