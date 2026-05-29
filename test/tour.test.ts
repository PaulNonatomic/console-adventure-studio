/**
 * Tests for the guided tour's localStorage helpers
 * (`cas:tourSeen`). The persistence contract is small but worth
 * pinning: corrupt or unreadable storage must NOT break the
 * app, the unseen default must hold, and the menu's
 * `clearTourSeen()` path must work end-to-end so re-launching
 * the tour from the ⋯ menu always works.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasSeenTour, markTourSeen, clearTourSeen } from '../src/components/Tour';

describe('tour persistence', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('defaults to unseen', () => {
		expect(hasSeenTour()).toBe(false);
	});

	it('round-trips through localStorage', () => {
		markTourSeen();
		expect(hasSeenTour()).toBe(true);
		clearTourSeen();
		expect(hasSeenTour()).toBe(false);
	});

	it('treats arbitrary stored values as unseen', () => {
		localStorage.setItem('cas:tourSeen', 'yes');
		expect(hasSeenTour()).toBe(false);
	});

	it('survives a localStorage read that throws', () => {
		const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked');
		});
		expect(hasSeenTour()).toBe(false);
		spy.mockRestore();
	});

	it('survives a localStorage write that throws', () => {
		const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('quota');
		});
		expect(() => markTourSeen()).not.toThrow();
		spy.mockRestore();
	});

	it('survives a localStorage removeItem that throws', () => {
		const spy = vi
			.spyOn(Storage.prototype, 'removeItem')
			.mockImplementation(() => {
				throw new Error('blocked');
			});
		expect(() => clearTourSeen()).not.toThrow();
		spy.mockRestore();
	});
});
