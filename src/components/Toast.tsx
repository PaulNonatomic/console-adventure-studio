/**
 * Floating top-right toast notification. Replaces the old
 * dismissable error banner that lived as a full-width strip
 * beneath the toolbar -- that strip pushed canvas content down
 * on every error and felt heavy for transient messages.
 *
 * Single-message at a time (caller owns the message state).
 * Auto-dismisses after `dismissAfterMs`; the × button + Esc
 * also dismiss. Tone drives the border colour:
 *   - "error":   MAGENTA
 *   - "info":    PHOSPHOR
 *
 * Renders nothing when `message` is null.
 */
import { useEffect, useState } from 'react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, MAGENTA, DIM, TEXT } from '../lib/theme';

export type ToastTone = 'error' | 'info';

interface Props {
	message: string | null;
	tone?: ToastTone;
	dismissAfterMs?: number;
	onDismiss: () => void;
}

const DEFAULT_DISMISS_MS = 5500;

export function Toast({
	message,
	tone = 'error',
	dismissAfterMs = DEFAULT_DISMISS_MS,
	onDismiss
}: Props) {
	const [fading, setFading] = useState(false);

	useEffect(() => {
		if (!message) return;
		setFading(false);
		const fadeT = setTimeout(() => setFading(true), dismissAfterMs - 400);
		const killT = setTimeout(onDismiss, dismissAfterMs);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onDismiss();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			clearTimeout(fadeT);
			clearTimeout(killT);
			window.removeEventListener('keydown', onKey);
		};
	}, [message, dismissAfterMs, onDismiss]);

	if (!message) return null;

	const accent = tone === 'error' ? MAGENTA : PHOSPHOR;

	return (
		<div
			role="status"
			aria-live="polite"
			style={{
				position: 'fixed',
				top: 18,
				right: 18,
				maxWidth: 360,
				background: PANEL,
				border: `1px solid ${accent}`,
				borderRadius: 7,
				boxShadow: `0 0 0 1px ${accent}22, 0 12px 30px #000000aa`,
				padding: '9px 14px',
				display: 'flex',
				alignItems: 'flex-start',
				gap: 10,
				zIndex: 250,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: 11,
				lineHeight: 1.4,
				color: TEXT,
				opacity: fading ? 0 : 1,
				transition: 'opacity 380ms ease'
			}}
		>
			<span style={{ color: accent, fontWeight: 700, flexShrink: 0 }}>
				{tone === 'error' ? '⚠' : '●'}
			</span>
			<span style={{ flex: 1 }}>{message}</span>
			<button
				onClick={onDismiss}
				title="Dismiss"
				style={{
					background: 'transparent',
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 4,
					color: DIM,
					width: 20,
					height: 20,
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					fontFamily: 'inherit',
					fontSize: 11,
					cursor: 'pointer',
					lineHeight: 1,
					flexShrink: 0,
					transition: 'color 120ms, border-color 120ms'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.color = AMBER;
					e.currentTarget.style.borderColor = AMBER;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.color = DIM;
					e.currentTarget.style.borderColor = PANEL_BORDER;
				}}
			>
				×
			</button>
		</div>
	);
}
