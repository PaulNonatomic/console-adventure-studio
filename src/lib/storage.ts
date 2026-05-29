/**
 * localStorage-backed save system.
 *
 * Saves live under a single key (`STORAGE_KEY`) as a JSON dict
 * keyed by an opaque id. Each entry carries the adventure json,
 * a human-readable name, and an ISO timestamp.
 *
 * Why one big key rather than one per save:
 *   - localStorage operations are synchronous and cheap; reading
 *     the whole dict on each list/save/delete is fine for tens
 *     of saves (a realistic upper bound for a personal-use tool)
 *   - keeps the key namespace clean (no per-id fragmentation)
 *   - migrations are easier — there's one schema to bump
 *
 * Storage failures (quota, private-browsing block, third-party
 * partitioning) are caught and treated as "no saves" — the
 * editor still works, just without persistence.
 */
import type { AdventureJson } from 'console-adventure';

const STORAGE_KEY = 'console-adventure-studio:saves';
/**
 * Single-slot draft. Holds the json the user was last editing
 * (unsaved). Auto-populated by App's debounced effect on every
 * json change; cleared on any explicit lifecycle transition
 * (save / load / new / example) so the draft is always "where
 * I was when I closed the tab," not "stale state from three
 * sessions ago."
 */
const DRAFT_KEY = 'cas:draft';

export interface SavedAdventure {
	/** Display name shown in the load dialog. */
	name: string;
	/** The actual adventure config. */
	json: AdventureJson;
	/** ISO 8601 timestamp of the last save. */
	savedAt: string;
}

export interface SaveEntry {
	id: string;
	save: SavedAdventure;
}

function readAll(): Record<string, SavedAdventure> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeAll(saves: Record<string, SavedAdventure>): boolean {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
		return true;
	} catch {
		return false;
	}
}

/**
 * Return all saves, newest first. The id field is what callers
 * pass to `loadSave` / `deleteSave` — opaque to the consumer.
 */
export function listSaves(): SaveEntry[] {
	return Object.entries(readAll())
		.map(([id, save]) => ({ id, save }))
		.sort((a, b) => b.save.savedAt.localeCompare(a.save.savedAt));
}

/**
 * Persist an adventure under a new save id. Returns the new id
 * on success or `null` if storage failed (quota etc.).
 */
export function createSave(name: string, json: AdventureJson): string | null {
	const id = `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const saves = readAll();
	saves[id] = { name, json, savedAt: new Date().toISOString() };
	return writeAll(saves) ? id : null;
}

/**
 * Update an existing save in place. The `savedAt` timestamp
 * bumps so the load dialog re-orders it to the top.
 */
export function updateSave(
	id: string,
	patch: Partial<Pick<SavedAdventure, 'name' | 'json'>>
): boolean {
	const saves = readAll();
	const current = saves[id];
	if (!current) return false;
	saves[id] = { ...current, ...patch, savedAt: new Date().toISOString() };
	return writeAll(saves);
}

export function loadSave(id: string): SavedAdventure | null {
	return readAll()[id] ?? null;
}

export function deleteSave(id: string): boolean {
	const saves = readAll();
	if (!saves[id]) return false;
	delete saves[id];
	return writeAll(saves);
}

/* ─── draft (single-slot autosave) ────────────────────────── */

/**
 * Persist the in-progress adventure to the draft slot. Silently
 * no-ops on storage failure -- the studio still works, the user
 * just won't have a refresh-restore safety net.
 */
export function saveDraft(json: AdventureJson): void {
	try {
		localStorage.setItem(
			DRAFT_KEY,
			JSON.stringify({ json, savedAt: new Date().toISOString() })
		);
	} catch {
		/* swallow */
	}
}

/**
 * Read the draft slot. Returns `null` when nothing is stored or
 * the payload doesn't look like an AdventureJson (missing
 * start / scenes). Defensive about shape because we own the
 * write but the read can happen after a localStorage edit by a
 * different version of the studio.
 */
export function loadDraft(): { json: AdventureJson; savedAt: string } | null {
	try {
		const raw = localStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (
			!parsed ||
			typeof parsed !== 'object' ||
			!parsed.json ||
			typeof parsed.json !== 'object' ||
			!('start' in parsed.json) ||
			!('scenes' in parsed.json)
		) {
			return null;
		}
		return {
			json: parsed.json as AdventureJson,
			savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : ''
		};
	} catch {
		return null;
	}
}

export function clearDraft(): void {
	try {
		localStorage.removeItem(DRAFT_KEY);
	} catch {
		/* swallow */
	}
}

/**
 * Whether the browser actually supports persistent storage at
 * all. Falls false in private browsing / blocked storage so the
 * UI can fade the save/load buttons rather than letting them
 * silently no-op.
 */
export function storageAvailable(): boolean {
	try {
		const k = '__cas_probe__';
		localStorage.setItem(k, '1');
		localStorage.removeItem(k);
		return true;
	} catch {
		return false;
	}
}
