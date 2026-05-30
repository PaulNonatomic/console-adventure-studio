/**
 * Adventure structural validation.
 *
 * Pure-function checks against an `AdventureJson` — surfaces
 * the three classes of error a player would actually hit:
 *
 *   1. unreachable    scenes never visited from the start
 *   2. deadEnds       scenes from which no path reaches a
 *                     terminal (`next: null`) choice — a player
 *                     who lands there can never finish
 *   3. missingTargets choices whose `next` points at a scene
 *                     id that doesn't exist in `scenes`
 *
 * Plus `inDegree` — how many choices target each scene. Used
 * by the ship dialog (cosmetic) and by Move 02's drag-to-wire
 * UX to flag orphans before the user wires them.
 *
 * Shared with Move 02. Keep it pure-functional — no React, no
 * DOM, no engine instantiation — so tests stay fast and the
 * UI can re-run it on every json change without a perf hit.
 */
import type { AdventureJson } from 'console-adventure';

export interface MissingTarget {
	/** Scene that owns the offending choice. */
	scene: string;
	/** 0-indexed position of the choice in that scene's `choices` array. */
	choiceIndex: number;
	/** The unresolvable scene id the choice's `next` points at. */
	target: string;
}

export interface MissingItemRef {
	/** Where the dangling id was found. */
	where:
		| { kind: 'scene-items'; scene: string }
		| { kind: 'choice'; scene: string; choiceIndex: number; field: 'requires' | 'consumes' | 'grants' }
		| { kind: 'item-onUse-scene'; item: string };
	/** The id that doesn't resolve. */
	id: string;
}

export interface Validation {
	/** Scene ids never visited starting BFS from `json.start`. */
	unreachable: string[];
	/** Scene ids from which no path reaches a `next: null` choice. */
	deadEnds: string[];
	/** Choices targeting scenes that don't exist in the scenes map. */
	missingTargets: MissingTarget[];
	/** Map of scene id → how many choices (across all scenes) point at it. */
	inDegree: Record<string, number>;
	/**
	 * Item ids referenced from scenes / choices / item.onUse.inScenes
	 * that aren't in the catalogue (or the other direction --
	 * scene ids in `onUse.inScenes` that don't exist). Lets the
	 * studio flag these before they bite at runtime.
	 */
	missingItemRefs: MissingItemRef[];
	/** `true` when every check passes — convenience flag for the UI. */
	ok: boolean;
}

export function validate(json: AdventureJson): Validation {
	const sceneIds = Object.keys(json.scenes);
	const sceneSet = new Set(sceneIds);

	// ─── unreachable: BFS from `start`, anything not visited fails.
	const reachable = new Set<string>();
	if (sceneSet.has(json.start)) {
		const queue: string[] = [json.start];
		reachable.add(json.start);
		while (queue.length) {
			const id = queue.shift()!;
			const scene = json.scenes[id];
			if (!scene) continue;
			for (const c of scene.choices) {
				if (c.next !== null && sceneSet.has(c.next) && !reachable.has(c.next)) {
					reachable.add(c.next);
					queue.push(c.next);
				}
			}
		}
	}
	const unreachable = sceneIds.filter((id) => !reachable.has(id));

	// ─── deadEnds: fixed-point sweep for "can reach a terminal".
	// A scene can reach a terminal if any of its choices is
	// `next: null` OR points at a scene that can reach a
	// terminal. Seed the set with scenes that have a direct
	// terminal choice, then iterate until stable.
	const canTerminate = new Set<string>();
	for (const [id, scene] of Object.entries(json.scenes)) {
		if (scene.choices.some((c) => c.next === null)) {
			canTerminate.add(id);
		}
	}
	let changed = true;
	while (changed) {
		changed = false;
		for (const [id, scene] of Object.entries(json.scenes)) {
			if (canTerminate.has(id)) continue;
			if (scene.choices.some((c) => c.next !== null && canTerminate.has(c.next))) {
				canTerminate.add(id);
				changed = true;
			}
		}
	}
	const deadEnds = sceneIds.filter((id) => !canTerminate.has(id));

	// ─── missingTargets + inDegree: one pass over every choice.
	const missingTargets: MissingTarget[] = [];
	const inDegree: Record<string, number> = {};
	for (const id of sceneIds) inDegree[id] = 0;
	for (const [sceneId, scene] of Object.entries(json.scenes)) {
		scene.choices.forEach((c, choiceIndex) => {
			if (c.next === null) return;
			if (!sceneSet.has(c.next)) {
				missingTargets.push({ scene: sceneId, choiceIndex, target: c.next });
				return;
			}
			inDegree[c.next] = (inDegree[c.next] ?? 0) + 1;
		});
	}

	// ─── missing item refs: walk scene.items, choice
	// requires/consumes/grants, and item.onUse.inScenes to make
	// sure every id resolves.
	const items = json.items ?? {};
	const itemSet = new Set(Object.keys(items));
	const missingItemRefs: MissingItemRef[] = [];
	for (const [sceneId, scene] of Object.entries(json.scenes)) {
		for (const id of scene.items ?? []) {
			if (!itemSet.has(id)) {
				missingItemRefs.push({
					where: { kind: 'scene-items', scene: sceneId },
					id
				});
			}
		}
		scene.choices.forEach((c, choiceIndex) => {
			(['requires', 'consumes', 'grants'] as const).forEach((field) => {
				for (const id of c[field] ?? []) {
					if (!itemSet.has(id)) {
						missingItemRefs.push({
							where: { kind: 'choice', scene: sceneId, choiceIndex, field },
							id
						});
					}
				}
			});
		});
	}
	for (const [itemId, def] of Object.entries(items)) {
		for (const sceneId of def.onUse?.inScenes ?? []) {
			if (!sceneSet.has(sceneId)) {
				missingItemRefs.push({
					where: { kind: 'item-onUse-scene', item: itemId },
					id: sceneId
				});
			}
		}
	}

	const ok =
		unreachable.length === 0 &&
		deadEnds.length === 0 &&
		missingTargets.length === 0 &&
		missingItemRefs.length === 0;

	return { unreachable, deadEnds, missingTargets, inDegree, missingItemRefs, ok };
}

/** Count of scenes that have at least one terminal (`next: null`) choice. */
export function countEndings(json: AdventureJson): number {
	return Object.values(json.scenes).filter((s) =>
		s.choices.some((c) => c.next === null)
	).length;
}
