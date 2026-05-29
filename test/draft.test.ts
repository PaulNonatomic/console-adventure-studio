/**
 * Tests for the autosave/draft slot helpers in lib/storage.
 * Validates round-trip, shape-validation on read (so the studio
 * doesn't crash if a future version writes a different schema),
 * and graceful handling of storage failures.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import { saveDraft, loadDraft, clearDraft } from '../src/lib/storage';

function adventure(): AdventureJson {
	return {
		start: 'a',
		scenes: {
			a: { heading: 'A', narration: ['x'], choices: [{ label: 'go', next: null }] }
		}
	};
}

describe('draft autosave', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('returns null when nothing is stored', () => {
		expect(loadDraft()).toBeNull();
	});

	it('round-trips an adventure through saveDraft / loadDraft', () => {
		const j = adventure();
		saveDraft(j);
		const result = loadDraft();
		expect(result?.json.start).toBe('a');
		expect(result?.savedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it('clearDraft removes the entry', () => {
		saveDraft(adventure());
		expect(loadDraft()).not.toBeNull();
		clearDraft();
		expect(loadDraft()).toBeNull();
	});

	it('returns null when the stored payload is the wrong shape', () => {
		localStorage.setItem('cas:draft', JSON.stringify({ junk: 1 }));
		expect(loadDraft()).toBeNull();
	});

	it('returns null when the json is missing start or scenes', () => {
		localStorage.setItem(
			'cas:draft',
			JSON.stringify({ json: { start: 'a' }, savedAt: 'x' })
		);
		expect(loadDraft()).toBeNull();
	});

	it('returns null when the stored payload is invalid JSON', () => {
		localStorage.setItem('cas:draft', 'not json');
		expect(loadDraft()).toBeNull();
	});

	it('saveDraft swallows localStorage write errors silently', () => {
		const spy = vi
			.spyOn(Storage.prototype, 'setItem')
			.mockImplementation(() => {
				throw new Error('quota');
			});
		expect(() => saveDraft(adventure())).not.toThrow();
		spy.mockRestore();
	});

	it('loadDraft swallows localStorage read errors silently', () => {
		const spy = vi
			.spyOn(Storage.prototype, 'getItem')
			.mockImplementation(() => {
				throw new Error('blocked');
			});
		expect(loadDraft()).toBeNull();
		spy.mockRestore();
	});
});
