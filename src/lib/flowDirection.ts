/**
 * Direction the graph flows in. Drives both `layoutGraph`
 * (which axis is layered vs spread) and `SceneNode` / `FinishNode`
 * (which edge of the card hosts the target handle so the edge
 * routing reads naturally).
 *
 * Horizontal is the default because the per-choice source
 * handles already sit on the right edge of each row — pairing
 * them with a left-edge target on the next node gives clean
 * straight-ish wires. Vertical keeps the previous behaviour
 * (target on top) as an option for authors who prefer the
 * top-down reading order.
 *
 * Persists to localStorage under `cas:flowDirection` so the
 * author's last choice survives a reload. Default + graceful
 * fallback on corrupt / unreadable storage match the
 * viewMode helper's pattern.
 */
export type FlowDirection = 'horizontal' | 'vertical';

const STORAGE_KEY = 'cas:flowDirection';
const ALLOWED: readonly FlowDirection[] = ['horizontal', 'vertical'];

export function loadFlowDirection(): FlowDirection {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw && (ALLOWED as readonly string[]).includes(raw)) {
			return raw as FlowDirection;
		}
	} catch {
		// localStorage disabled — fall through to default.
	}
	return 'horizontal';
}

export function saveFlowDirection(dir: FlowDirection): void {
	try {
		localStorage.setItem(STORAGE_KEY, dir);
	} catch {
		// Swallow — same rationale as load.
	}
}
