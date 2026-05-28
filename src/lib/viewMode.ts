/**
 * View-mode persistence — the studio's top-level layout choice
 * (graph / write / split). Persisted to localStorage so the
 * author lands back in whichever mode they last used.
 *
 * Defaults to `graph` if storage is unavailable or empty — that
 * preserves today's behaviour for existing users, in line with
 * the Move 04 acceptance criterion "Nothing in graph-only mode
 * changes for existing users."
 */
export type ViewMode = 'graph' | 'write' | 'split';

const STORAGE_KEY = 'cas:viewMode';
const ALLOWED: readonly ViewMode[] = ['graph', 'write', 'split'];

export function loadViewMode(): ViewMode {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw && (ALLOWED as readonly string[]).includes(raw)) {
			return raw as ViewMode;
		}
	} catch {
		// localStorage disabled / quota / private browsing —
		// silently fall through to the default.
	}
	return 'graph';
}

export function saveViewMode(mode: ViewMode): void {
	try {
		localStorage.setItem(STORAGE_KEY, mode);
	} catch {
		// Swallow — same rationale as load.
	}
}
