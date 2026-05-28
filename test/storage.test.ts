/**
 * Tests for the localStorage-backed save system.
 *
 * jsdom provides a working localStorage so we can exercise the
 * real implementation. Each test clears storage in setup so
 * suites don't bleed into each other.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import {
	createSave,
	listSaves,
	loadSave,
	deleteSave,
	updateSave,
	storageAvailable
} from '../src/lib/storage';

const sample: AdventureJson = {
	start: 'a',
	scenes: {
		a: { heading: 'A', narration: [], choices: [{ label: 'x', next: null }] }
	}
};

beforeEach(() => {
	localStorage.clear();
});

describe('createSave / listSaves / loadSave', () => {
	it('round-trips a save', () => {
		const id = createSave('My Run', sample);
		expect(id).not.toBeNull();
		const loaded = loadSave(id!);
		expect(loaded?.name).toBe('My Run');
		expect(loaded?.json).toEqual(sample);
	});

	it('lists saves newest-first', async () => {
		createSave('first', sample);
		// Force a different timestamp.
		await new Promise((r) => setTimeout(r, 4));
		createSave('second', sample);
		const list = listSaves();
		expect(list[0].save.name).toBe('second');
		expect(list[1].save.name).toBe('first');
	});

	it('returns an empty list when nothing has been saved', () => {
		expect(listSaves()).toEqual([]);
	});
});

describe('deleteSave', () => {
	it('removes a save', () => {
		const id = createSave('one', sample)!;
		expect(deleteSave(id)).toBe(true);
		expect(loadSave(id)).toBeNull();
	});

	it('returns false when the id is unknown', () => {
		expect(deleteSave('does-not-exist')).toBe(false);
	});
});

describe('updateSave', () => {
	it('replaces name and json in place', () => {
		const id = createSave('one', sample)!;
		const ok = updateSave(id, { name: 'renamed' });
		expect(ok).toBe(true);
		expect(loadSave(id)?.name).toBe('renamed');
	});

	it('returns false when the id is unknown', () => {
		expect(updateSave('nope', { name: 'x' })).toBe(false);
	});
});

describe('storageAvailable', () => {
	it('returns true under jsdom (which supplies localStorage)', () => {
		expect(storageAvailable()).toBe(true);
	});
});
