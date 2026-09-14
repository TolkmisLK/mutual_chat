import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
export default defineConfig({
  root: 'examples/embed-host',
  build: { outDir: '../../dist/embed-host', emptyOutDir: true,
    rolldownOptions: { external: ['/widget/mutual-chat.js'] } },
  plugins: [{ name: 'ship-built-widget', generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'widget/mutual-chat.js', source: readFileSync(new URL('./dist/widget/mutual-chat.js', import.meta.url), 'utf8') });
  } }],
});
