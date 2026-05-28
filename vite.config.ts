import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages deploys this app under
// https://paulnonatomic.github.io/console-adventure-studio/
// so the base path needs to match. Set VITE_BASE=/ when
// deploying elsewhere (Vercel, custom domain, local preview).
const base = process.env.VITE_BASE ?? '/console-adventure-studio/';

export default defineConfig({
	base,
	plugins: [react()],
	build: {
		outDir: 'dist',
		sourcemap: true
	}
});
