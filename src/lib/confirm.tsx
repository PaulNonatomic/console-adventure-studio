/**
 * Imperative confirmation API. Call sites can do:
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete scene', message: '...', tone: 'danger' })) {
 *     // user said yes
 *   }
 *
 * instead of juggling local "is the dialog open?" state. Wrap
 * the app once in `<ConfirmProvider>` and any descendant can
 * call `useConfirm()`.
 *
 * One pending dialog at a time. A second call while a confirm
 * is open resolves immediately to false -- safest behaviour for
 * destructive actions (you'd rather lose a confirmation than
 * accidentally chain two deletes).
 */
import {
	createContext,
	useCallback,
	useContext,
	useRef,
	useState,
	type ReactNode
} from 'react';
import {
	ConfirmDialog,
	type ConfirmTone,
	type ConfirmDialogProps
} from '../components/ConfirmDialog';

export interface ConfirmOptions {
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: ConfirmTone;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
	resolve: (ok: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
	const [pending, setPending] = useState<PendingState | null>(null);
	const pendingRef = useRef<PendingState | null>(null);
	pendingRef.current = pending;

	const confirm = useCallback<ConfirmFn>((opts) => {
		if (pendingRef.current) {
			// Another confirm is already on-screen — auto-decline
			// the new request rather than stacking dialogs.
			return Promise.resolve(false);
		}
		return new Promise<boolean>((resolve) => {
			setPending({ ...opts, resolve });
		});
	}, []);

	const handleResolve = useCallback((ok: boolean) => {
		const p = pendingRef.current;
		if (p) {
			p.resolve(ok);
		}
		setPending(null);
	}, []);

	const dialogProps: ConfirmDialogProps | null = pending
		? {
				title: pending.title,
				message: pending.message,
				confirmLabel: pending.confirmLabel,
				cancelLabel: pending.cancelLabel,
				tone: pending.tone,
				onResolve: handleResolve
		  }
		: null;

	return (
		<ConfirmContext.Provider value={confirm}>
			{children}
			{dialogProps && <ConfirmDialog {...dialogProps} />}
		</ConfirmContext.Provider>
	);
}

export function useConfirm(): ConfirmFn {
	const fn = useContext(ConfirmContext);
	if (!fn) {
		throw new Error(
			'useConfirm() must be called inside <ConfirmProvider>. Wrap the app root.'
		);
	}
	return fn;
}
