/**
 * Brand-styled single-string-input modal. Visual sibling to
 * `ConfirmDialog`; same PANEL-on-VOID surface, same hover /
 * focus behaviour, same Esc-cancels + restore-prior-focus
 * mechanics. Used by the imperative `usePrompt()` API
 * (`lib/prompt.tsx`) to replace the lingering `window.prompt`
 * calls in the save and "from URL" flows.
 *
 * The dialog auto-selects the initial value's text when it
 * opens so the user can type-to-replace without first clicking.
 * Enter submits, Esc cancels.
 */
import {
	forwardRef,
	useEffect,
	useRef,
	useState,
	type ReactNode
} from 'react';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	DIM,
	TEXT,
	VOID
} from '../lib/theme';

export interface InputDialogProps {
	title: string;
	message?: ReactNode;
	initialValue?: string;
	placeholder?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/**
	 * Called when the user clicks Confirm, presses Enter, OR
	 * cancels (backdrop / Esc / Cancel). `null` = cancel,
	 * `string` = submitted value (already trimmed on the way
	 * out so callers don't have to).
	 */
	onResolve: (value: string | null) => void;
}

export function InputDialog({
	title,
	message,
	initialValue = '',
	placeholder,
	confirmLabel = 'OK',
	cancelLabel = 'Cancel',
	onResolve
}: InputDialogProps) {
	const [value, setValue] = useState(initialValue);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current = document.activeElement as HTMLElement | null;
		// Focus the input AND select its contents so the user
		// can type-to-replace -- matches the native window.prompt
		// convention this dialog supersedes.
		queueMicrotask(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
		return () => {
			previousFocusRef.current?.focus?.();
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onResolve(null);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onResolve]);

	const submit = () => {
		const trimmed = value.trim();
		if (!trimmed) {
			onResolve(null);
			return;
		}
		onResolve(trimmed);
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="input-dialog-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onResolve(null);
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
					border: `1px solid ${PHOSPHOR}`,
					borderRadius: 10,
					boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 22px 60px #000000cc`,
					color: TEXT,
					padding: '20px 22px 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: 12
				}}
			>
				<div
					id="input-dialog-title"
					style={{
						color: PHOSPHOR,
						fontWeight: 700,
						fontSize: 13,
						letterSpacing: '0.06em',
						textTransform: 'uppercase'
					}}
				>
					{title}
				</div>
				{message && (
					<div
						style={{
							color: TEXT,
							fontSize: 12,
							lineHeight: 1.55
						}}
					>
						{message}
					</div>
				)}
				<input
					ref={inputRef}
					type="text"
					value={value}
					placeholder={placeholder}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							submit();
						}
					}}
					style={{
						width: '100%',
						background: VOID,
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 5,
						color: TEXT,
						padding: '8px 10px',
						fontFamily: 'inherit',
						fontSize: 12,
						lineHeight: 1.4,
						outline: 'none',
						transition: 'border-color 120ms'
					}}
					onFocus={(e) => (e.target.style.borderColor = AMBER)}
					onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
				/>
				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						gap: 8,
						marginTop: 4
					}}
				>
					<ModalButton
						color={DIM}
						borderColor={PANEL_BORDER}
						onClick={() => onResolve(null)}
					>
						{cancelLabel}
					</ModalButton>
					<ModalButton
						color={PHOSPHOR}
						borderColor={PHOSPHOR}
						onClick={submit}
						disabled={value.trim().length === 0}
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
	disabled?: boolean;
	children: ReactNode;
}

const ModalButton = forwardRef<HTMLButtonElement, ModalButtonProps>(function ModalButton(
	{ color, borderColor, onClick, disabled = false, children },
	ref
) {
	return (
		<button
			ref={ref}
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			style={{
				background: 'transparent',
				color: disabled ? DIM : color,
				border: `1px solid ${disabled ? PANEL_BORDER : borderColor}`,
				borderRadius: 5,
				padding: '6px 14px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: disabled ? 'not-allowed' : 'pointer',
				opacity: disabled ? 0.55 : 1,
				transition: 'background 120ms, color 120ms'
			}}
			onMouseEnter={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = `${color}11`;
				e.currentTarget.style.color = AMBER;
			}}
			onMouseLeave={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = 'transparent';
				e.currentTarget.style.color = color;
			}}
		>
			{children}
		</button>
	);
});
