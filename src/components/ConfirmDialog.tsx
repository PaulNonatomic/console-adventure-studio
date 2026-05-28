/**
 * Brand-styled confirmation modal. Visually consistent with the
 * other studio surfaces (PANEL on VOID, monospace, AMBER /
 * MAGENTA accents) so confirmations don't look like browser
 * chrome dropped into the middle of the app.
 *
 * Driven imperatively via `useConfirm()` (see `lib/confirm.tsx`)
 * so call sites can `await confirm({ ... })` instead of
 * juggling local "is the dialog open?" state.
 *
 * UX:
 *   - Backdrop click + Esc cancel (resolve false).
 *   - Initial focus lands on the cancel button by default --
 *     safer for destructive actions, the author has to tab once
 *     to confirm. (window.confirm follows the same convention.)
 *   - Active element captured on open and restored on close so
 *     editing focus returns to the input the user was in.
 */
import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	MAGENTA,
	DIM,
	TEXT,
	VOID
} from '../lib/theme';

export type ConfirmTone = 'primary' | 'danger';

export interface ConfirmDialogProps {
	title: string;
	message: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: ConfirmTone;
	onResolve: (ok: boolean) => void;
}

export function ConfirmDialog({
	title,
	message,
	confirmLabel = 'Confirm',
	cancelLabel = 'Cancel',
	tone = 'primary',
	onResolve
}: ConfirmDialogProps) {
	const cancelBtnRef = useRef<HTMLButtonElement | null>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current = document.activeElement as HTMLElement | null;
		// Cancel as the default focus — Enter on a destructive
		// dialog shouldn't blow away work, the author has to
		// deliberately Tab to confirm.
		cancelBtnRef.current?.focus();
		return () => {
			previousFocusRef.current?.focus?.();
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onResolve(false);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onResolve]);

	const confirmColor = tone === 'danger' ? MAGENTA : PHOSPHOR;

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="confirm-dialog-title"
			onClick={(e) => {
				// Backdrop click cancels. Stop propagation on the
				// card so clicks inside don't bubble up and dismiss.
				if (e.target === e.currentTarget) onResolve(false);
			}}
			style={{
				position: 'fixed',
				inset: 0,
				background: `${VOID}cc`,
				zIndex: 100,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				style={{
					width: 'min(480px, 92vw)',
					background: PANEL,
					border: `1px solid ${confirmColor}`,
					borderRadius: 10,
					boxShadow: `0 0 0 1px ${confirmColor}22, 0 22px 60px #000000cc`,
					color: TEXT,
					padding: '20px 22px 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: 14
				}}
			>
				<div
					id="confirm-dialog-title"
					style={{
						color: confirmColor,
						fontWeight: 700,
						fontSize: 13,
						letterSpacing: '0.06em',
						textTransform: 'uppercase'
					}}
				>
					{title}
				</div>
				<div
					style={{
						color: TEXT,
						fontSize: 12,
						lineHeight: 1.6
					}}
				>
					{message}
				</div>
				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						gap: 8,
						marginTop: 4
					}}
				>
					<ModalButton
						ref={cancelBtnRef}
						color={DIM}
						borderColor={PANEL_BORDER}
						onClick={() => onResolve(false)}
					>
						{cancelLabel}
					</ModalButton>
					<ModalButton
						color={confirmColor}
						borderColor={confirmColor}
						onClick={() => onResolve(true)}
					>
						{confirmLabel}
					</ModalButton>
				</div>
			</div>
		</div>
	);
}

/* ─── modal action button ───────────────────────────────── */

interface ModalButtonProps {
	color: string;
	borderColor: string;
	onClick: () => void;
	children: ReactNode;
}

const ModalButton = forwardRef<HTMLButtonElement, ModalButtonProps>(function ModalButton(
	{ color, borderColor, onClick, children },
	ref
) {
	return (
		<button
			ref={ref}
			onClick={onClick}
			style={{
				background: 'transparent',
				color,
				border: `1px solid ${borderColor}`,
				borderRadius: 5,
				padding: '6px 14px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: 'pointer',
				transition: 'background 120ms, color 120ms'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.background = `${color}11`;
				e.currentTarget.style.color = AMBER;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = 'transparent';
				e.currentTarget.style.color = color;
			}}
		>
			{children}
		</button>
	);
});
