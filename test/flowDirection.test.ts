/**
 * Tests for the flowDirection lib + the layout / graph
 * builder's response to it. The persistence contract mirrors
 * viewMode's — corrupt or unreadable storage must NOT break the
 * canvas, just fall back to the default ('horizontal').
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AdventureJson } from 'console-adventure';
import {
	loadFlowDirection,
	saveFlowDirection
} from '../src/lib/flowDirection';
import { buildGraph } from '../src/lib/graph';
import { layoutGraph } from '../src/lib/layout';

function adventure(json: Pick<AdventureJson, 'scenes' | 'start'>): AdventureJson {
	return { ...json } as AdventureJson;
}

describe('flowDirection persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to "horizontal" when nothing is stored', () => {
		expect(loadFlowDirection()).toBe('horizontal');
	});

	it('round-trips a stored value', () => {
		saveFlowDirection('vertical');
		expect(loadFlowDirection()).toBe('vertical');
		saveFlowDirection('horizontal');
		expect(loadFlowDirection()).toBe('horizontal');
	});

	it('falls back to "horizontal" on corrupt value', () => {
		localStorage.setItem('cas:flowDirection', 'sideways');
		expect(loadFlowDirection()).toBe('horizontal');
	});

	it('falls back to "horizontal" if localStorage throws on read', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(loadFlowDirection()).toBe('horizontal');
		spy.mockRestore();
	});

	it('silently no-ops if localStorage throws on write', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(() => saveFlowDirection('vertical')).not.toThrow();
		spy.mockRestore();
	});
});

describe('buildGraph stamps flowDirection on node data', () => {
	const sample: AdventureJson = adventure({
		start: 'a',
		scenes: {
			a: {
				heading: 'A',
				narration: [''],
				choices: [{ label: 'go b', next: 'b' }]
			},
			b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
		}
	});

	it('stamps horizontal onto every node when horizontal is requested', () => {
		const { nodes } = buildGraph(sample, 0, undefined, 'horizontal');
		for (const n of nodes) {
			expect((n.data as { flowDirection: string }).flowDirection).toBe(
				'horizontal'
			);
		}
	});

	it('stamps vertical onto every node when vertical is requested', () => {
		const { nodes } = buildGraph(sample, 0, undefined, 'vertical');
		for (const n of nodes) {
			expect((n.data as { flowDirection: string }).flowDirection).toBe(
				'vertical'
			);
		}
	});

	it('defaults to horizontal when no direction is supplied', () => {
		const { nodes } = buildGraph(sample, 0);
		expect((nodes[0].data as { flowDirection: string }).flowDirection).toBe(
			'horizontal'
		);
	});
});

describe('layoutGraph respects direction', () => {
	const sample: AdventureJson = adventure({
		start: 'a',
		scenes: {
			a: {
				heading: 'A',
				narration: [''],
				choices: [{ label: 'go b', next: 'b' }]
			},
			b: { heading: 'B', narration: [''], choices: [{ label: 'end', next: null }] }
		}
	});

	it('horizontal: child node sits to the right of the parent (greater x), aligned in y', () => {
		const { nodes, edges } = buildGraph(sample, 0, undefined, 'horizontal');
		const positioned = layoutGraph(nodes, edges, 'a', 'horizontal');
		const a = positioned.find((n) => n.id === 'a')!;
		const b = positioned.find((n) => n.id === 'b')!;
		expect(b.position.x).toBeGreaterThan(a.position.x);
	});

	it('vertical: child node sits below the parent (greater y)', () => {
		const { nodes, edges } = buildGraph(sample, 0, undefined, 'vertical');
		const positioned = layoutGraph(nodes, edges, 'a', 'vertical');
		const a = positioned.find((n) => n.id === 'a')!;
		const b = positioned.find((n) => n.id === 'b')!;
		expect(b.position.y).toBeGreaterThan(a.position.y);
	});
});
