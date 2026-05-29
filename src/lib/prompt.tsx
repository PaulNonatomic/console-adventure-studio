/**
 * Imperative single-string prompt API, sibling to `useConfirm`
 * (`lib/confirm.tsx`). Replaces `window.prompt` so the input
 * UI matches the rest of the studio's brand surface.
 *
 *   const prompt = usePrompt();
 *   const name = await prompt({
 *     title: 'Save as',
 *     initialValue: 'Adventure 2026-05-29',
 *     confirmLabel: 'Save'
 *   });
 *   if (name) { ... }
 *
 * One pending prompt at a time. A second call while one is
 * already open resolves immediately to `null` -- safer than
 * stacking nested input dialogs.
 */
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	type ReactNode
} from 'react';
import { InputDialog, type InputDialogProps } from '../components/InputDialog';

export interface PromptOptions {
	title: string;
	message?: ReactNode;
	initialValue?: string;
	placeholder?: string;
	confirmLabel?: string;
	cancelLabel?: string;
}

type PromptFn = (opts: PromptOptions) => Promise<string | null>;

const PromptContext = createContext<PromptFn | null>(null);

interface PendingState extends PromptOptions {
	resolve: (value: string | null) => void;
}

export function PromptProvider({ children }: { children: ReactNode }) {
	const [pending, setPending] = useState<PendingState | null>(null);
	const pendingRef = useRef<PendingState | null>(null);
	pendingRef.current = pending;

	const prompt = useCallback<PromptFn>((opts) => {
		if (pendingRef.current) {
			return Promise.resolve(null);
		}
		return new Promise<string | null>((resolve) => {
			setPending({ ...opts, resolve });
		});
	}, []);

	const handleResolve = useCallback((value: string | null) => {
		const p = pendingRef.current;
		if (p) p.resolve(value);
		setPending(null);
	}, []);

	const dialogProps: InputDialogProps | null = pending
		? {
				title: pending.title,
				message: pending.message,
				initialValue: pending.initialValue,
				placeholder: pending.placeholder,
				confirmLabel: pending.confirmLabel,
				cancelLabel: pending.cancelLabel,
				onResolve: handleResolve
		  }
		: null;

	return (
		<PromptContext.Provider value={prompt}>
			{children}
			{dialogProps && <InputDialog {...dialogProps} />}
		</PromptContext.Provider>
	);
}

export function usePrompt(): PromptFn {
	const fn = useContext(PromptContext);
	if (!fn) {
		throw new Error(
			'usePrompt() must be called inside <PromptProvider>. Wrap the app root.'
		);
	}
	return fn;
}
