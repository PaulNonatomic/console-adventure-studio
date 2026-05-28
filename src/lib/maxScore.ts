/**
 * Compute the maximum achievable score across all paths in the
 * scene graph. Memoised DFS — handles reconverging branches
 * correctly (two scenes both pointing to a third don't
 * double-count the third's contribution).
 *
 * Identical algorithm to the one inside
 * console-adventure/adventure.ts, but re-implemented here so
 * the editor can compute scores for a JSON config without
 * having to instantiate a full Adventure runtime.
 */
import type { AdventureJson } from 'console-adventure';

export function computeMaxScore(json: AdventureJson): number {
	const cache = new Map<string, number>();
	function bestFrom(sceneId: string): number {
		const cached = cache.get(sceneId);
		if (cached !== undefined) return cached;
		const scene = json.scenes[sceneId];
		if (!scene) {
			cache.set(sceneId, 0);
			return 0;
		}
		const best = Math.max(
			...scene.choices.map(
				(c) => (c.points ?? 0) + (c.next ? bestFrom(c.next) : 0)
			)
		);
		cache.set(sceneId, best);
		return best;
	}
	return bestFrom(json.start);
}

/**
 * Resolve a tier label from a final score. Mirrors the
 * resolution logic in `createAdventure().tierFor()`. Returns
 * `null` when no tier table is supplied.
 */
export function tierFor(
	score: number,
	tiers: AdventureJson['tiers']
): string | null {
	if (!tiers || tiers.length === 0) return null;
	const sorted = [...tiers].sort((a, b) => b.minScore - a.minScore);
	for (const t of sorted) {
		if (score >= t.minScore) return t.label;
	}
	return null;
}
