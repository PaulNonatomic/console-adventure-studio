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
	setStart,
	updateTier,
	addTier,
	deleteTier,
	updateShare,
	toggleShare
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
