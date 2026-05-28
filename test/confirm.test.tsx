/**
 * Tests for the ConfirmProvider / useConfirm imperative API.
 * Renders the provider in a JSDOM environment, fires a confirm,
 * and asserts the dialog mounts + the promise resolves on the
 * user's click.
 */
import { describe, it, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfirmProvider, useConfirm } from '../src/lib/confirm';

describe('useConfirm + ConfirmProvider', () => {
	it('renders nothing until confirm is called', () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		function Probe() {
			useConfirm(); // just ensures the hook works inside the provider
			return <div>idle</div>;
		}

		act(() => {
			root.render(
				<ConfirmProvider>
					<Probe />
				</ConfirmProvider>
			);
		});

		// No dialog div should be present.
		expect(container.querySelector('[role="dialog"]')).toBeNull();

		act(() => {
			root.unmount();
		});
		document.body.removeChild(container);
	});

	it('resolves true when the confirm button is clicked', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		const resolved = vi.fn();
		let confirmFn: (() => Promise<boolean>) | null = null;

		function Probe() {
			const confirm = useConfirm();
			confirmFn = () =>
				confirm({
					title: 'Delete scene',
					message: 'Are you sure?',
					confirmLabel: 'Delete',
					tone: 'danger'
				});
			return null;
		}

		act(() => {
			root.render(
				<ConfirmProvider>
					<Probe />
				</ConfirmProvider>
			);
		});

		let promise!: Promise<boolean>;
		act(() => {
			promise = confirmFn!();
		});
		promise.then(resolved);

		// Wait a microtask for the setState inside confirm to flush.
		await act(async () => {
			await Promise.resolve();
		});

		const dialog = container.querySelector('[role="dialog"]');
		expect(dialog).not.toBeNull();
		const buttons = dialog!.querySelectorAll('button');
		// Two buttons — Cancel, then Confirm.
		expect(buttons.length).toBe(2);

		await act(async () => {
			(buttons[1] as HTMLButtonElement).click();
			await Promise.resolve();
		});

		const result = await promise;
		expect(result).toBe(true);
		expect(resolved).toHaveBeenCalledWith(true);
		expect(container.querySelector('[role="dialog"]')).toBeNull();

		act(() => {
			root.unmount();
		});
		document.body.removeChild(container);
	});

	it('resolves false when the cancel button is clicked', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		let confirmFn: (() => Promise<boolean>) | null = null;
		function Probe() {
			const confirm = useConfirm();
			confirmFn = () =>
				confirm({ title: 'Confirm', message: 'ok?' });
			return null;
		}

		act(() => {
			root.render(
				<ConfirmProvider>
					<Probe />
				</ConfirmProvider>
			);
		});

		let promise!: Promise<boolean>;
		act(() => {
			promise = confirmFn!();
		});
		await act(async () => {
			await Promise.resolve();
		});

		const dialog = container.querySelector('[role="dialog"]')!;
		const buttons = dialog.querySelectorAll('button');
		await act(async () => {
			(buttons[0] as HTMLButtonElement).click();
			await Promise.resolve();
		});

		const result = await promise;
		expect(result).toBe(false);

		act(() => {
			root.unmount();
		});
		document.body.removeChild(container);
	});

	it('queues sensibly: a second confirm while one is open resolves false', async () => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		const root = createRoot(container);

		let confirmFn: ((label: string) => Promise<boolean>) | null = null;
		function Probe() {
			const confirm = useConfirm();
			confirmFn = (label: string) =>
				confirm({ title: label, message: 'ok?' });
			return null;
		}

		act(() => {
			root.render(
				<ConfirmProvider>
					<Probe />
				</ConfirmProvider>
			);
		});

		let firstPromise!: Promise<boolean>;
		let secondPromise!: Promise<boolean>;
		act(() => {
			firstPromise = confirmFn!('first');
		});
		await act(async () => {
			await Promise.resolve();
		});

		// Second call while the first is still open — should
		// auto-decline rather than stacking dialogs.
		act(() => {
			secondPromise = confirmFn!('second');
		});

		await expect(secondPromise).resolves.toBe(false);

		// First is still on screen and resolves normally.
		const dialog = container.querySelector('[role="dialog"]')!;
		const buttons = dialog.querySelectorAll('button');
		await act(async () => {
			(buttons[1] as HTMLButtonElement).click();
			await Promise.resolve();
		});
		await expect(firstPromise).resolves.toBe(true);

		act(() => {
			root.unmount();
		});
		document.body.removeChild(container);
	});
});
