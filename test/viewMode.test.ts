/**
 * Tests for the viewMode localStorage helpers.
 *
 * Why test such a small file? Because the persistence
 * defaults are a soft compatibility guarantee: existing
 * users must land in `graph` after upgrading, even if
 * something corrupts their stored value. The tests pin that
 * contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadViewMode, saveViewMode } from '../src/lib/viewMode';

describe('viewMode persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to "graph" when nothing is stored', () => {
		expect(loadViewMode()).toBe('graph');
	});

	it('round-trips a stored value', () => {
		saveViewMode('write');
		expect(loadViewMode()).toBe('write');
		saveViewMode('split');
		expect(loadViewMode()).toBe('split');
		saveViewMode('graph');
		expect(loadViewMode()).toBe('graph');
	});

	it('falls back to "graph" if the stored value is unrecognised', () => {
		localStorage.setItem('cas:viewMode', 'definitely-not-a-mode');
		expect(loadViewMode()).toBe('graph');
	});

	it('falls back to "graph" if localStorage throws on read', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(loadViewMode()).toBe('graph');
		spy.mockRestore();
	});

	it('silently no-ops if localStorage throws on write', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(() => saveViewMode('write')).not.toThrow();
		spy.mockRestore();
	});
});
