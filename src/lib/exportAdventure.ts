/**
 * Export / clipboard helpers for an `AdventureJson`.
 *
 * The same wire-format builder feeds the ship dialog's
 * download / copy actions AND the adventure-editor panel's
 * existing export / copy buttons. Single source of truth so
 * the `$schema` URL doesn't drift and the formatting stays
 * consistent.
 */
import type { AdventureJson } from 'console-adventure';
import { getAdventureFilename } from './wrapperSnippet';

export const SCHEMA_URL =
	'https://raw.githubusercontent.com/PaulNonatomic/console-adventure/main/adventure.schema.json';

/**
 * Serialise an adventure to its canonical wire format.
 * Prepends `$schema` so any editor / IDE pointing at the
 * downloaded file gets autocomplete + validation for free.
 */
export function toWireFormat(json: AdventureJson): string {
	return JSON.stringify({ $schema: SCHEMA_URL, ...json }, null, 2);
}

/**
 * Trigger a browser download of the adventure as a JSON file.
 * Filename derived from the start scene id via
 * `getAdventureFilename`.
 */
export function downloadAdventure(json: AdventureJson): void {
	const blob = new Blob([toWireFormat(json)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = getAdventureFilename(json);
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}

/**
 * Copy the wire-format JSON to the clipboard. Returns a
 * boolean promise — `false` if the clipboard API is
 * unavailable (insecure context, blocked permissions, etc.).
 */
export async function copyAdventureToClipboard(json: AdventureJson): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(toWireFormat(json));
		return true;
	} catch {
		return false;
	}
}

/** Generic clipboard write — used by the ship dialog for the wrapper snippet too. */
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
