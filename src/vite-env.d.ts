/// <reference types="vite/client" />

/**
 * Build-time constants injected by vite.config.ts via `define`.
 * Visible in the toolbar so a developer can verify whether they
 * are looking at the latest deploy or a cached older version.
 */
declare const __BUILD_TAG__: string;
declare const __BUILD_TIME__: string;
