import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages deploys this app under
// https://paulnonatomic.github.io/console-adventure-studio/
// so the base path needs to match. Set VITE_BASE=/ when
// deploying elsewhere (Vercel, custom domain, local preview).
const base = process.env.VITE_BASE ?? '/console-adventure-studio/';

// Build-time timestamp + short hash injected as a compile-time
// constant. Surfaced in the toolbar so a developer can confirm
// at a glance whether they're looking at the latest deploy or
// a cached older version while we're still iterating.
const BUILD_TIME = new Date().toISOString();
const BUILD_TAG = `${BUILD_TIME.slice(5, 10)}·${BUILD_TIME.slice(11, 16)}`; // MM-DD·HH:mm

export default defineConfig({
	base,
	plugins: [react()],
	define: {
		__BUILD_TAG__: JSON.stringify(BUILD_TAG),
		__BUILD_TIME__: JSON.stringify(BUILD_TIME)
	},
	build: {
		outDir: 'dist',
		sourcemap: true
	}
});
