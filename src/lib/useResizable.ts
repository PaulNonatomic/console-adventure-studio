/**
 * Drag-to-resize hook for a panel that's anchored to the right
 * edge of the window.
 *
 * The caller renders a thin handle on the panel's *left* edge
 * and forwards `handleProps` to it. While the user drags,
 * mouse-x is translated into a clamped panel width.
 *
 * The hook also exposes the persisted width via localStorage
 * so the user's preferred panel size survives a refresh.
 */
import { useEffect, useState, useCallback } from 'react';

const STORAGE_KEY = 'console-adventure-studio:right-panel-width';

function clamp(v: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, v));
}

function readPersisted(fallback: number): number {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return fallback;
		const n = Number(raw);
		return Number.isFinite(n) && n > 0 ? n : fallback;
	} catch {
		return fallback;
	}
}

function persist(width: number): void {
	try {
		localStorage.setItem(STORAGE_KEY, String(width));
	} catch {
		// quota / blocked storage — non-fatal
	}
}

interface Options {
	initial: number;
	min: number;
	max: number;
}

export function useResizable(opts: Options) {
	const [width, setWidth] = useState<number>(() => readPersisted(opts.initial));
	const [dragging, setDragging] = useState(false);

	useEffect(() => {
		if (!dragging) return;

		const onMove = (e: MouseEvent) => {
			// Panel is anchored to the right edge — its width is
			// the distance from mouse to the window's right side.
			const next = clamp(window.innerWidth - e.clientX, opts.min, opts.max);
			setWidth(next);
		};
		const onUp = () => {
			setDragging(false);
		};

		document.addEventListener('mousemove', onMove);
		document.addEventListener('mouseup', onUp);
		// Suppress text selection while dragging.
		const prevSelect = document.body.style.userSelect;
		const prevCursor = document.body.style.cursor;
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'col-resize';
		return () => {
			document.removeEventListener('mousemove', onMove);
			document.removeEventListener('mouseup', onUp);
			document.body.style.userSelect = prevSelect;
			document.body.style.cursor = prevCursor;
		};
	}, [dragging, opts.min, opts.max]);

	// Persist width after the user stops dragging (not on every
	// move — we'd thrash localStorage at 60Hz).
	useEffect(() => {
		if (!dragging) persist(width);
	}, [dragging, width]);

	const onMouseDown = useCallback(() => setDragging(true), []);

	return { width, dragging, onMouseDown };
}
