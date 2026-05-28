/**
 * Tests for the wrapper-snippet generator shown in the ship
 * dialog. Pure string output, asserted against the spec
 * example.
 */
import { describe, it, expect } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import { buildWrapperSnippet, getAdventureFilename } from '../src/lib/wrapperSnippet';

function adventure(start: string): AdventureJson {
	return {
		start,
		scenes: {
			[start]: {
				heading: start,
				narration: [],
				choices: [{ label: 'end', points: 1, next: null }]
			}
		}
	};
}

describe('buildWrapperSnippet', () => {
	it('uses the start scene id as the variable name and filename', () => {
		const out = buildWrapperSnippet(adventure('foundry'));
		expect(out).toContain("import json from './foundry.json'");
		expect(out).toContain('const foundry = createAdventureFromJson(json,');
		expect(out).toContain('foundry.start();');
	});

	it('sanitises non-identifier characters in scene ids', () => {
		const out = buildWrapperSnippet(adventure('scene-1'));
		expect(out).toContain('const scene_1 = createAdventureFromJson');
		expect(out).toContain("import json from './scene_1.json'");
	});

	it('falls back to "adventure" when the cleaned name is empty', () => {
		const out = buildWrapperSnippet(adventure('---'));
		expect(out).toContain('const adventure = createAdventureFromJson');
	});

	it('falls back to "adventure" when the cleaned name starts with a digit', () => {
		const out = buildWrapperSnippet(adventure('1st'));
		expect(out).toContain('const adventure = createAdventureFromJson');
	});

	it('always includes the canonical import and the onComplete handler', () => {
		const out = buildWrapperSnippet(adventure('foo'));
		expect(out).toContain("import { createAdventureFromJson } from 'console-adventure'");
		expect(out).toContain('onComplete: (result) => {');
		expect(out).toContain('console.log(result.score, result.tier);');
	});
});

describe('getAdventureFilename', () => {
	it('appends .json to the derived identifier', () => {
		expect(getAdventureFilename(adventure('foundry'))).toBe('foundry.json');
		expect(getAdventureFilename(adventure('scene-1'))).toBe('scene_1.json');
	});
});
