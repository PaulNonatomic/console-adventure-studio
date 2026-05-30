/**
 * Tests for the pure-function edit helpers in src/lib/edit.ts.
 *
 * These are the studio's highest-leverage code — every edit
 * the UI makes flows through them, and they should be the
 * easiest things in the codebase to test because they're
 * pure (json, ...args) → json transforms with no React, no
 * DOM, no engine instantiation.
 */
import { describe, it, expect } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import {
	updateScene,
	addScene,
	deleteScene,
	updateChoice,
	addChoice,
	deleteChoice,
	moveChoice,
	addSceneFromChoice,
	setStart,
	updateTier,
	addTier,
	deleteTier,
	updateShare,
	toggleShare,
	addItem,
	updateItem,
	updateItemOnUse,
	deleteItem,
	setSceneItems,
	setChoiceItemList
} from '../src/lib/edit';

function baseAdventure(): AdventureJson {
	return {
		start: 'a',
		scenes: {
			a: {
				heading: 'A',
				narration: ['hi'],
				choices: [
					{ label: 'go b', points: 2, next: 'b' },
					{ label: 'stay', points: 1, next: null }
				]
			},
			b: {
				heading: 'B',
				narration: ['there'],
				choices: [{ label: 'go a', points: 3, next: 'a' }]
			}
		},
		tiers: [
			{ minScore: 0, label: 'Newbie' },
			{ minScore: 5, label: 'Pro' }
		]
	};
}

describe('updateScene', () => {
	it('replaces only the named fields, leaves the rest', () => {
		const json = baseAdventure();
		const next = updateScene(json, 'a', { heading: 'A!' });
		expect(next.scenes.a.heading).toBe('A!');
		expect(next.scenes.a.narration).toEqual(['hi']); // untouched
		expect(next.scenes.b).toEqual(json.scenes.b); // untouched
	});

	it('returns the original json on unknown scene id', () => {
		const json = baseAdventure();
		const next = updateScene(json, 'nope', { heading: 'x' });
		expect(next).toBe(json);
	});

	it('does not mutate the input', () => {
		const json = baseAdventure();
		const snapshot = JSON.parse(JSON.stringify(json));
		updateScene(json, 'a', { heading: 'A!' });
		expect(json).toEqual(snapshot);
	});
});

describe('addScene', () => {
	it('creates a new scene with the next available id', () => {
		const json = baseAdventure();
		const { json: next, id } = addScene(json);
		expect(id).toBe('scene-3');
		expect(next.scenes[id]).toBeDefined();
		expect(next.scenes[id].choices).toHaveLength(1);
	});

	it('skips over taken scene-N ids', () => {
		const json = baseAdventure();
		json.scenes['scene-3'] = json.scenes.b;
		const { id } = addScene(json);
		expect(id).toBe('scene-4');
	});
});

describe('deleteScene', () => {
	it('removes the scene', () => {
		const json = baseAdventure();
		const next = deleteScene(json, 'b');
		expect(next.scenes.b).toBeUndefined();
	});

	it('rewires `next` references that pointed to the deleted scene to null', () => {
		const json = baseAdventure();
		const next = deleteScene(json, 'b');
		expect(next.scenes.a.choices[0].next).toBeNull();
	});

	it('refuses to delete the start scene', () => {
		const json = baseAdventure();
		const next = deleteScene(json, 'a');
		expect(next).toBe(json);
	});
});

describe('updateChoice / addChoice / deleteChoice', () => {
	it('updateChoice mutates only the indexed choice', () => {
		const json = baseAdventure();
		const next = updateChoice(json, 'a', 0, { points: 10 });
		expect(next.scenes.a.choices[0].points).toBe(10);
		expect(next.scenes.a.choices[1].points).toBe(1); // untouched
	});

	it('addChoice appends a placeholder choice', () => {
		const json = baseAdventure();
		const next = addChoice(json, 'a');
		expect(next.scenes.a.choices).toHaveLength(3);
		expect(next.scenes.a.choices[2].next).toBeNull();
	});

	it('deleteChoice removes the indexed choice', () => {
		const json = baseAdventure();
		const next = deleteChoice(json, 'a', 0);
		expect(next.scenes.a.choices).toHaveLength(1);
		expect(next.scenes.a.choices[0].label).toBe('stay');
	});

	it('deleteChoice refuses to remove the last remaining choice', () => {
		const json = baseAdventure();
		// scene b has 1 choice — delete should be a no-op.
		const next = deleteChoice(json, 'b', 0);
		expect(next).toBe(json);
	});
});

describe('setStart', () => {
	it('changes the start scene', () => {
		const json = baseAdventure();
		const next = setStart(json, 'b');
		expect(next.start).toBe('b');
	});

	it('refuses to set start to an unknown scene', () => {
		const json = baseAdventure();
		const next = setStart(json, 'nope');
		expect(next).toBe(json);
	});
});

describe('tier helpers', () => {
	it('updateTier mutates only the indexed entry', () => {
		const json = baseAdventure();
		const next = updateTier(json, 1, { label: 'Ace' });
		expect(next.tiers?.[1].label).toBe('Ace');
		expect(next.tiers?.[0].label).toBe('Newbie');
	});

	it('addTier appends with minScore one higher than current max', () => {
		const json = baseAdventure();
		const next = addTier(json);
		expect(next.tiers).toHaveLength(3);
		expect(next.tiers?.[2].minScore).toBe(6);
	});

	it('deleteTier removes the indexed entry', () => {
		const json = baseAdventure();
		const next = deleteTier(json, 0);
		expect(next.tiers).toHaveLength(1);
		expect(next.tiers?.[0].label).toBe('Pro');
	});
});

describe('share helpers', () => {
	it('toggleShare(true) enables with sensible defaults', () => {
		const json = baseAdventure();
		const next = toggleShare(json, true);
		expect(next.share).toBeDefined();
		expect(next.share?.text).toContain('${score}');
	});

	it('toggleShare(false) removes the share field cleanly', () => {
		const json = baseAdventure();
		const withShare = toggleShare(json, true);
		const back = toggleShare(withShare, false);
		expect(back.share).toBeUndefined();
		// The rest of the json should be intact.
		expect(back.scenes).toEqual(json.scenes);
	});

	it('updateShare merges partial into the existing share config', () => {
		const json = baseAdventure();
		const withShare = toggleShare(json, true);
		const next = updateShare(withShare, { intent: 'bluesky' });
		expect(next.share?.intent).toBe('bluesky');
		expect(next.share?.text).toBe(withShare.share?.text); // untouched
	});
});

describe('moveChoice', () => {
	it('reorders a choice forward', () => {
		const json = baseAdventure();
		const next = moveChoice(json, 'a', 0, 1);
		expect(next.scenes.a.choices.map((c) => c.label)).toEqual(['stay', 'go b']);
	});

	it('reorders a choice backward', () => {
		const json = baseAdventure();
		const next = moveChoice(json, 'a', 1, 0);
		expect(next.scenes.a.choices.map((c) => c.label)).toEqual(['stay', 'go b']);
	});

	it('no-ops on out-of-range indices', () => {
		const json = baseAdventure();
		expect(moveChoice(json, 'a', 0, 5)).toBe(json);
		expect(moveChoice(json, 'a', -1, 0)).toBe(json);
	});

	it('no-ops on same-position move', () => {
		const json = baseAdventure();
		expect(moveChoice(json, 'a', 0, 0)).toBe(json);
	});

	it('no-ops on missing scene', () => {
		const json = baseAdventure();
		expect(moveChoice(json, 'missing', 0, 1)).toBe(json);
	});
});

describe('addSceneFromChoice', () => {
	it('creates a new scene AND rewires the named choice to it', () => {
		const json = baseAdventure();
		const { json: next, id } = addSceneFromChoice(json, 'a', 0);
		expect(id).toBeDefined();
		expect(next.scenes[id]).toBeDefined();
		expect(next.scenes.a.choices[0].next).toBe(id);
		// Untouched choices stay intact.
		expect(next.scenes.a.choices[1].next).toBe(null);
		expect(next.scenes.b.choices[0].next).toBe('a');
	});

	it('returns a usable id pointing at a non-empty stub scene', () => {
		const json = baseAdventure();
		const { json: next, id } = addSceneFromChoice(json, 'a', 1);
		expect(next.scenes[id].choices.length).toBeGreaterThan(0);
		expect(next.scenes.a.choices[1].next).toBe(id);
	});
});

describe('item catalogue helpers', () => {
	function baseWithItems(): AdventureJson {
		return {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					items: ['key', 'rope'],
					choices: [
						{ label: 'use key', requires: ['key'], consumes: ['key'], next: 'b' },
						{ label: 'free', next: 'b' }
					]
				},
				b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
			},
			items: {
				key: { name: 'brass key' },
				rope: { name: 'rope' }
			}
		};
	}

	it('addItem mints an id-N key and pre-fills name = id', () => {
		const json = baseWithItems();
		const { json: next, id } = addItem(json);
		expect(id).toMatch(/^item-\d+$/);
		expect(next.items?.[id].name).toBe(id);
	});

	it('updateItem patches name / description', () => {
		const json = baseWithItems();
		const next = updateItem(json, 'key', {
			name: 'rusted key',
			description: 'cold to the touch'
		});
		expect(next.items?.key.name).toBe('rusted key');
		expect(next.items?.key.description).toBe('cold to the touch');
	});

	it('updateItemOnUse adds an onUse effect when none existed', () => {
		const json = baseWithItems();
		const next = updateItemOnUse(json, 'rope', { text: 'You uncoil it.' });
		expect(next.items?.rope.onUse?.text).toBe('You uncoil it.');
	});

	it('updateItemOnUse(null) strips the onUse field entirely', () => {
		const json = baseWithItems();
		const withUse = updateItemOnUse(json, 'rope', { text: 'x' });
		const stripped = updateItemOnUse(withUse, 'rope', null);
		expect(stripped.items?.rope.onUse).toBeUndefined();
	});

	it('deleteItem scrubs the catalogue AND every referencing field', () => {
		const json = baseWithItems();
		const next = deleteItem(json, 'key');
		expect(next.items?.key).toBeUndefined();
		// Scene's items list lost the key, rope stays
		expect(next.scenes.a.items).toEqual(['rope']);
		// Choice's requires + consumes lost the key — both
		// arrays were single-item and should have collapsed.
		expect(next.scenes.a.choices[0].requires).toBeUndefined();
		expect(next.scenes.a.choices[0].consumes).toBeUndefined();
	});

	it('deleteItem drops the scene items field entirely when last item removed', () => {
		const json: AdventureJson = {
			start: 'a',
			scenes: {
				a: {
					heading: 'A',
					narration: [''],
					items: ['only'],
					choices: [{ label: 'go', next: null }]
				}
			},
			items: { only: { name: 'only' } }
		};
		const next = deleteItem(json, 'only');
		expect(next.scenes.a.items).toBeUndefined();
	});

	it('setSceneItems replaces the list and omits the field when empty', () => {
		const json = baseWithItems();
		const next = setSceneItems(json, 'a', []);
		expect(next.scenes.a.items).toBeUndefined();
	});

	it('setChoiceItemList sets the named field and drops it on empty array', () => {
		const json = baseWithItems();
		const a = setChoiceItemList(json, 'a', 1, 'requires', ['rope']);
		expect(a.scenes.a.choices[1].requires).toEqual(['rope']);
		const b = setChoiceItemList(a, 'a', 1, 'requires', []);
		expect(b.scenes.a.choices[1].requires).toBeUndefined();
	});
});
