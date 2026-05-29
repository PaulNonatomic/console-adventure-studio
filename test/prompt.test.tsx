/**
 * Tests for the PromptProvider / usePrompt imperative API.
 * Mirrors the confirm.test.tsx shape -- mounts the provider in
 * JSDOM, fires a prompt, and asserts the dialog mounts + the
 * promise resolves on the user's submit / cancel / Esc.
 */
import { describe, it, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { PromptProvider, usePrompt } from '../src/lib/prompt';

function setup() {
	const container = document.createElement('div');
	document.body.appendChild(container);
	const root = createRoot(container);
	return { container, root };
}

describe('usePrompt + PromptProvider', () => {
	it('renders nothing until prompt is called', () => {
		const { container, root } = setup();
		function Probe() {
			usePrompt();
			return <div>idle</div>;
		}
		act(() => {
			root.render(
				<PromptProvider>
					<Probe />
				</PromptProvider>
			);
		});
		expect(container.querySelector('[role="dialog"]')).toBeNull();
		act(() => root.unmount());
		document.body.removeChild(container);
	});

	it('resolves the trimmed input when OK is clicked', async () => {
		const { container, root } = setup();
		let promptFn: (() => Promise<string | null>) | null = null;
		function Probe() {
			const prompt = usePrompt();
			promptFn = () =>
				prompt({ title: 'Save as', initialValue: '  Adventure  ' });
			return null;
		}
		act(() => {
			root.render(
				<PromptProvider>
					<Probe />
				</PromptProvider>
			);
		});

		let promise!: Promise<string | null>;
		act(() => {
			promise = promptFn!();
		});
		await act(async () => {
			await Promise.resolve();
		});

		const dialog = container.querySelector('[role="dialog"]')!;
		const okButton = dialog.querySelectorAll('button')[1] as HTMLButtonElement;
		await act(async () => {
			okButton.click();
			await Promise.resolve();
		});

		// Value comes back trimmed.
		await expect(promise).resolves.toBe('Adventure');
		act(() => root.unmount());
		document.body.removeChild(container);
	});

	it('resolves null when Cancel is clicked', async () => {
		const { container, root } = setup();
		let promptFn: (() => Promise<string | null>) | null = null;
		function Probe() {
			const prompt = usePrompt();
			promptFn = () => prompt({ title: 'Pick a name' });
			return null;
		}
		act(() => {
			root.render(
				<PromptProvider>
					<Probe />
				</PromptProvider>
			);
		});

		let promise!: Promise<string | null>;
		act(() => {
			promise = promptFn!();
		});
		await act(async () => {
			await Promise.resolve();
		});

		const dialog = container.querySelector('[role="dialog"]')!;
		const cancelButton = dialog.querySelectorAll('button')[0] as HTMLButtonElement;
		await act(async () => {
			cancelButton.click();
			await Promise.resolve();
		});

		await expect(promise).resolves.toBe(null);
		act(() => root.unmount());
		document.body.removeChild(container);
	});

	it('a second prompt while one is open resolves null', async () => {
		const { container, root } = setup();
		let promptFn: ((title: string) => Promise<string | null>) | null = null;
		function Probe() {
			const prompt = usePrompt();
			promptFn = (title: string) => prompt({ title });
			return null;
		}
		act(() => {
			root.render(
				<PromptProvider>
					<Probe />
				</PromptProvider>
			);
		});

		let firstPromise!: Promise<string | null>;
		let secondPromise!: Promise<string | null>;
		act(() => {
			firstPromise = promptFn!('first');
		});
		await act(async () => {
			await Promise.resolve();
		});

		act(() => {
			secondPromise = promptFn!('second');
		});
		await expect(secondPromise).resolves.toBe(null);

		// First should still be on screen.
		const dialog = container.querySelector('[role="dialog"]')!;
		expect(dialog).not.toBeNull();
		const cancel = dialog.querySelectorAll('button')[0] as HTMLButtonElement;
		await act(async () => {
			cancel.click();
			await Promise.resolve();
		});
		await expect(firstPromise).resolves.toBe(null);

		act(() => root.unmount());
		document.body.removeChild(container);
	});
});
