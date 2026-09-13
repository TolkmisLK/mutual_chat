import { defineConfig } from 'vite';
export default defineConfig({ build: { outDir: 'dist/widget', lib: { entry: 'packages/chat-ui/index.js', formats: ['es'], fileName: 'mutual-chat' } } });
