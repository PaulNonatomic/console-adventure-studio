/**
 * Immutable edit helpers for an `AdventureJson`.
 *
 * Every helper takes the current json and a delta, and returns
 * a new json. None of them mutate input — the editor in App.tsx
 * just calls `setJson(editFn(currentJson, ...args))`.
 *
 * Scene ids are stable (and not user-renamable yet) so we
 * avoid the cross-reference fixups (`start`, every `next`)
 * that renaming would require. Heading is the human-visible
 * label; the id is just a stable key.
 */
import type {
	AdventureJson,
	Scene,
	Choice,
	Tier,
	JsonShareConfig,
	ItemDef,
	ItemUseEffect
} from 'console-adventure';
import { omit, omitFromRecord } from './omit';

// ─── scene edits ──────────────────────────────────────────────

export function updateScene(
	json: AdventureJson,
	sceneId: string,
	partial: Partial<Scene>
): AdventureJson {
	const current = json.scenes[sceneId];
	if (!current) return json;
	return {
		...json,
		scenes: {
			...json.scenes,
			[sceneId]: { ...current, ...partial }
		}
	};
}

/**
 * Add a new scene with an auto-generated id. Returns the new
 * json plus the new scene's id so the caller can immediately
 * select it.
 */
export function addScene(json: AdventureJson): { json: AdventureJson; id: string } {
	const id = nextSceneId(json);
	return {
		json: {
			...json,
			scenes: {
				...json.scenes,
				[id]: {
					heading: id,
					narration: ['(narration)'],
					choices: [{ label: '(choice)', points: 0, next: null }]
				}
			}
		},
		id
	};
}

/**
 * Remove a scene. Any choice that used to point at it gets
 * rewired to `null` (terminal) so the script stays valid.
 * The `start` scene cannot be deleted while it's still the
 * start — the helper refuses and returns the original json
 * unchanged.
 */
export function deleteScene(json: AdventureJson, sceneId: string): AdventureJson {
	if (json.start === sceneId) return json;
	const remaining = omitFromRecord(json.scenes, sceneId);
	const sweptScenes: Record<string, Scene> = {};
	for (const [id, scene] of Object.entries(remaining)) {
		sweptScenes[id] = {
			...scene,
			choices: scene.choices.map((c) =>
				c.next === sceneId ? { ...c, next: null } : c
			)
		};
	}
	return { ...json, scenes: sweptScenes };
}

function nextSceneId(json: AdventureJson): string {
	// Prefer scene-N where N is the smallest positive integer
	// not already in use. Keeps newly-created ids human-readable
	// instead of timestamp-y.
	const taken = new Set(Object.keys(json.scenes));
	let n = Object.keys(json.scenes).length + 1;
	while (taken.has(`scene-${n}`)) n++;
	return `scene-${n}`;
}

// ─── choice edits ─────────────────────────────────────────────

export function updateChoice(
	json: AdventureJson,
	sceneId: string,
	choiceIndex: number,
	partial: Partial<Choice>
): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	const choices = scene.choices.map((c, i) =>
		i === choiceIndex ? { ...c, ...partial } : c
	);
	return updateScene(json, sceneId, { choices });
}

export function addChoice(json: AdventureJson, sceneId: string): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	return updateScene(json, sceneId, {
		choices: [
			...scene.choices,
			{ label: '(choice)', points: 0, next: null }
		]
	});
}

export function deleteChoice(
	json: AdventureJson,
	sceneId: string,
	choiceIndex: number
): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	// A scene with zero choices would be unreachable in any
	// playthrough, so refuse to delete the last one.
	if (scene.choices.length <= 1) return json;
	return updateScene(json, sceneId, {
		choices: scene.choices.filter((_, i) => i !== choiceIndex)
	});
}

/**
 * Reorder a single choice within a scene's choice list (drag-to-
 * reorder support in the inline editor). Out-of-range indices
 * silently no-op so the caller can be naive about bounds.
 */
export function moveChoice(
	json: AdventureJson,
	sceneId: string,
	from: number,
	to: number
): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	const n = scene.choices.length;
	if (from < 0 || from >= n || to < 0 || to >= n || from === to) return json;
	const next = scene.choices.slice();
	const [moved] = next.splice(from, 1);
	next.splice(to, 0, moved);
	return updateScene(json, sceneId, { choices: next });
}

/**
 * Drop-to-create: spawn a fresh scene AND rewire the chosen
 * choice on `sceneId` to point at it, in one atomic update.
 * Used by `onConnectEnd` in App.tsx when the user drags a choice
 * handle out to empty canvas. Returns the new json + the new
 * scene's id so the caller can immediately select it.
 */
export function addSceneFromChoice(
	json: AdventureJson,
	sceneId: string,
	choiceIndex: number
): { json: AdventureJson; id: string } {
	const { json: j2, id } = addScene(json);
	return { json: updateChoice(j2, sceneId, choiceIndex, { next: id }), id };
}

// ─── adventure-level edits ────────────────────────────────────

export function setStart(json: AdventureJson, sceneId: string): AdventureJson {
	if (!json.scenes[sceneId]) return json;
	return { ...json, start: sceneId };
}

// ─── tier edits ───────────────────────────────────────────────

export function updateTier(
	json: AdventureJson,
	index: number,
	partial: Partial<Tier>
): AdventureJson {
	const tiers = (json.tiers ?? []).map((t, i) => (i === index ? { ...t, ...partial } : t));
	return { ...json, tiers };
}

export function addTier(json: AdventureJson): AdventureJson {
	const current = json.tiers ?? [];
	const nextScore =
		current.length === 0 ? 0 : Math.max(...current.map((t) => t.minScore)) + 1;
	return {
		...json,
		tiers: [...current, { minScore: nextScore, label: 'Tier', color: 'primary' }]
	};
}

export function deleteTier(json: AdventureJson, index: number): AdventureJson {
	const tiers = (json.tiers ?? []).filter((_, i) => i !== index);
	return { ...json, tiers };
}

// ─── share edits ──────────────────────────────────────────────

export function updateShare(
	json: AdventureJson,
	partial: Partial<JsonShareConfig>
): AdventureJson {
	const current = json.share ?? { text: '', url: '' };
	return { ...json, share: { ...current, ...partial } };
}

export function toggleShare(json: AdventureJson, enabled: boolean): AdventureJson {
	if (enabled && !json.share) {
		return {
			...json,
			share: {
				text: 'I scored ${score}/${max} as ${tier}',
				url: 'https://example.com/?s=${score}'
			}
		};
	}
	if (!enabled && json.share) {
		// Omit drops the share key; the remaining shape matches
		// AdventureJson (share was optional anyway).
		return omit(json, 'share');
	}
	return json;
}

// ─── item edits (catalogue) ──────────────────────────────────

/**
 * Add a new item to the catalogue with an auto-generated id.
 * Returns the new json plus the new item's id so the caller can
 * immediately select / focus it. The id is generated similarly
 * to `nextSceneId` -- prefer `item-N` where N is the smallest
 * positive integer not in use.
 */
export function addItem(json: AdventureJson): { json: AdventureJson; id: string } {
	const id = nextItemId(json);
	return {
		json: {
			...json,
			items: {
				...(json.items ?? {}),
				[id]: { name: id }
			}
		},
		id
	};
}

function nextItemId(json: AdventureJson): string {
	const taken = new Set(Object.keys(json.items ?? {}));
	let n = Object.keys(json.items ?? {}).length + 1;
	while (taken.has(`item-${n}`)) n++;
	return `item-${n}`;
}

/**
 * Patch a single item in the catalogue. Missing items are
 * returned untouched (caller bug -- the UI shouldn't be able
 * to edit an item that doesn't exist).
 */
export function updateItem(
	json: AdventureJson,
	itemId: string,
	partial: Partial<ItemDef>
): AdventureJson {
	const current = json.items?.[itemId];
	if (!current) return json;
	return {
		...json,
		items: {
			...(json.items ?? {}),
			[itemId]: { ...current, ...partial }
		}
	};
}

/**
 * Patch an item's `onUse` effect. Pass `null` to remove the
 * onUse field entirely (= "flavour-only item, no use effect").
 */
export function updateItemOnUse(
	json: AdventureJson,
	itemId: string,
	patch: Partial<ItemUseEffect> | null
): AdventureJson {
	const current = json.items?.[itemId];
	if (!current) return json;
	if (patch === null) {
		const { onUse: _, ...rest } = current;
		return {
			...json,
			items: { ...(json.items ?? {}), [itemId]: rest }
		};
	}
	return {
		...json,
		items: {
			...(json.items ?? {}),
			[itemId]: { ...current, onUse: { ...(current.onUse ?? {}), ...patch } }
		}
	};
}

/**
 * Remove an item from the catalogue. ALSO scrubs every
 * dangling reference -- scene.items lists, choice
 * requires/consumes/grants arrays -- so the resulting json
 * stays internally consistent. Without this, deleting a
 * referenced item would leave choices gated by a phantom id
 * the player can never obtain.
 */
export function deleteItem(json: AdventureJson, itemId: string): AdventureJson {
	if (!json.items?.[itemId]) return json;
	const items = omitFromRecord(json.items, itemId);
	const scrubbedScenes: Record<string, Scene> = {};
	for (const [id, scene] of Object.entries(json.scenes)) {
		const scrubbedItems = scene.items?.filter((i) => i !== itemId);
		const scrubbedChoices = scene.choices.map((c) => scrubChoiceItem(c, itemId));
		const next: Scene = { ...scene, choices: scrubbedChoices };
		if (scrubbedItems && scrubbedItems.length !== scene.items?.length) {
			if (scrubbedItems.length === 0) {
				const { items: _, ...rest } = next;
				scrubbedScenes[id] = rest as Scene;
				continue;
			}
			next.items = scrubbedItems;
		}
		scrubbedScenes[id] = next;
	}
	return { ...json, items, scenes: scrubbedScenes };
}

function scrubChoiceItem(choice: Choice, itemId: string): Choice {
	const next: Choice = { ...choice };
	if (next.requires) {
		const r = next.requires.filter((i) => i !== itemId);
		if (r.length === 0) delete next.requires;
		else next.requires = r;
	}
	if (next.consumes) {
		const c = next.consumes.filter((i) => i !== itemId);
		if (c.length === 0) delete next.consumes;
		else next.consumes = c;
	}
	if (next.grants) {
		const g = next.grants.filter((i) => i !== itemId);
		if (g.length === 0) delete next.grants;
		else next.grants = g;
	}
	return next;
}

// ─── scene-item placement ────────────────────────────────────

/**
 * Replace a scene's static-item list. Passing an empty array
 * removes the field entirely so the JSON stays minimal.
 */
export function setSceneItems(
	json: AdventureJson,
	sceneId: string,
	itemIds: string[]
): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	if (itemIds.length === 0) {
		// Direct construction -- updateScene's spread can ADD
		// fields but not REMOVE them. We want the field gone so
		// the JSON stays minimal when the author clears it.
		const { items: _omitted, ...rest } = scene;
		return {
			...json,
			scenes: { ...json.scenes, [sceneId]: rest as Scene }
		};
	}
	return updateScene(json, sceneId, { items: itemIds });
}

// ─── choice-item gating (requires / consumes / grants) ───────

/**
 * Replace one of a choice's item arrays (`requires`,
 * `consumes`, or `grants`). Passing an empty array removes the
 * field. The other two arrays are left untouched.
 */
export function setChoiceItemList(
	json: AdventureJson,
	sceneId: string,
	choiceIndex: number,
	field: 'requires' | 'consumes' | 'grants',
	itemIds: string[]
): AdventureJson {
	const scene = json.scenes[sceneId];
	if (!scene) return json;
	const choice = scene.choices[choiceIndex];
	if (!choice) return json;
	const next: Choice = { ...choice };
	if (itemIds.length === 0) {
		delete next[field];
	} else {
		next[field] = itemIds;
	}
	// Same removal trick as setSceneItems -- bypass updateChoice
	// (which spreads partial) and rebuild the choice list with
	// the new object so deleted fields actually vanish.
	const choices = scene.choices.map((c, i) => (i === choiceIndex ? next : c));
	return {
		...json,
		scenes: { ...json.scenes, [sceneId]: { ...scene, choices } }
	};
}
