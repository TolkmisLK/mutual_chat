# Independent desktop preview

The desktop package embeds the existing standalone application with pinned Electron 44.3.0. It remains separate from the ES widget and Web distributions. Packaging and protocol-policy source alone do not establish native runtime acceptance; see VALIDATION.md for actual results. No signed installer, automatic update service, public homeserver or mobile client is included.

The renderer loads only the packaged app origin. Node integration is disabled, context isolation and the Chromium sandbox stay enabled, and no preload/IPC bridge exposes filesystem, shell or token APIs. The custom protocol serves only the entry page and compiled assets. Remote navigation, popups, webviews and downloads are denied. Remote Matrix servers still require trusted HTTPS; there is no certificate-error override. This initial text-only package does not request camera, microphone or notification permissions.

Temporary and remembered sessions use the same application logic as the Web version. Remembered credentials and SDK database keys use the user's local passphrase; profile data lives under Electron's user-data directory, outside the application bundle. Browser and desktop profiles are separate and are not silently imported. One process per profile is permitted. Closing the desktop quits its process; it does not revoke the server device. Use explicit logout to request revocation. Deleting a profile may lose unbacked-up history keys.

Build with Node 22.12+ and the lockfile: `npm ci --ignore-scripts`, `npm run build`, then `node tool/build-desktop.js win32` on the Windows builder. The packager downloads the pinned official Electron runtime and creates an unsigned x64 directory under dist/desktop. Keep the entire resulting directory and the runtime's license files. Do not distribute test profiles or credentials.

The room-creation form uses an application dialog instead of browser prompt(), which Electron does not support. Existing Web/embedded tests must continue to pass with this shared change. Physical Windows installation, trusted TLS against an operator's actual service, signing, update policy and native lifecycle acceptance remain release gates.

The CI native Matrix scenario packages the same app for Linux x64 on Ubuntu 22.04 and runs two isolated real Electron processes under Xvfb, with Chromium sandboxing explicitly enabled. It uses generated accounts on the loopback Synapse fixture, checks encrypted exchange, closes and reopens a remembered profile, and checks the original device can decrypt history and continue sending. It must pass before being recorded as evidence; it is not Windows Matrix interoperability or physical-device acceptance. No OS sandbox restrictions are disabled, certificate errors ignored, profiles uploaded or cryptographic SDK calls replaced.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [custom protocols](https://www.electronjs.org/docs/latest/api/protocol).
