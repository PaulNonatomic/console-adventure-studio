/**
 * Shared "import an adventure from somewhere" helpers.
 *
 * Both the toolbar buttons and the boot overlay reach for the
 * same three import paths (paste / upload / fetch URL). The
 * actual JSON parsing + error surfacing logic lives here so
 * neither component has to duplicate it.
 *
 * Each helper takes `onLoad` (success path) and `onError`
 * (failure path) callbacks and returns nothing — the caller
 * decides what to do with the parsed JSON.
 */

interface ImportCallbacks {
	onLoad: (json: unknown) => void;
	onError: (message: string) => void;
}

/**
 * Read a file as text, parse it as JSON, hand it to `onLoad`.
 * Surfaces parse failures via `onError`.
 */
export function readFileAsJson(file: File, { onLoad, onError }: ImportCallbacks): void {
	const reader = new FileReader();
	reader.onload = () => {
		try {
			const parsed = JSON.parse(String(reader.result));
			onLoad(parsed);
		} catch (err) {
			onError(`Could not parse file: ${(err as Error).message}`);
		}
	};
	reader.onerror = () => {
		onError('Could not read file.');
	};
	reader.readAsText(file);
}

/**
 * Pull JSON from the clipboard. Asks for clipboard permission
 * if the browser hasn't already granted it.
 */
export async function pasteJsonFromClipboard({ onLoad, onError }: ImportCallbacks): Promise<void> {
	try {
		const text = await navigator.clipboard.readText();
		if (!text.trim()) {
			onError('Clipboard is empty.');
			return;
		}
		const parsed = JSON.parse(text);
		onLoad(parsed);
	} catch (err) {
		onError(`Paste failed: ${(err as Error).message}`);
	}
}

/**
 * Fetch a URL and parse its body as JSON. Caller passes the
 * URL — the existing toolbar uses `window.prompt` to ask, the
 * boot overlay uses an inline input.
 */
export async function fetchJsonFromUrl(
	url: string,
	{ onLoad, onError }: ImportCallbacks
): Promise<void> {
	try {
		const res = await fetch(url);
		if (!res.ok) {
			onError(`Fetch failed: ${res.status} ${res.statusText}`);
			return;
		}
		const parsed = await res.json();
		onLoad(parsed);
	} catch (err) {
		onError(`Fetch failed: ${(err as Error).message}`);
	}
}
