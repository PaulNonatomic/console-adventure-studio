/**
 * Small fade-out toast that signals the studio just restored an
 * unsaved draft from localStorage on this page load. Auto-
 * dismisses after a few seconds so it doesn't linger; can also
 * be dismissed manually via ×.
 *
 * Positioned top-centre so it doesn't fight the toolbar, sub-
 * bar, or any of the canvas-corner chips for real estate.
 */
import { useEffect, useState } from 'react';
import { PANEL, PANEL_BORDER, PHOSPHOR, DIM, TEXT } from '../lib/theme';

interface Props {
	savedAt: string;
	onDismiss: () => void;
}

const AUTO_DISMISS_MS = 6000;

export function DraftBanner({ savedAt, onDismiss }: Props) {
	const [fading, setFading] = useState(false);

	useEffect(() => {
		const t = setTimeout(() => setFading(true), AUTO_DISMISS_MS - 400);
		const t2 = setTimeout(onDismiss, AUTO_DISMISS_MS);
		return () => {
			clearTimeout(t);
			clearTimeout(t2);
		};
	}, [onDismiss]);

	// "3 minutes ago" style relative timestamp -- short, no
	// dependency on a date library. Falls back to "just now" if
	// the savedAt was empty or unparseable.
	const relative = (() => {
		if (!savedAt) return 'just now';
		const t = new Date(savedAt).getTime();
		if (Number.isNaN(t)) return 'just now';
		const dSec = Math.max(0, Math.round((Date.now() - t) / 1000));
		if (dSec < 60) return 'just now';
		const dMin = Math.round(dSec / 60);
		if (dMin < 60) return `${dMin}m ago`;
		const dHr = Math.round(dMin / 60);
		if (dHr < 24) return `${dHr}h ago`;
		return new Date(savedAt).toLocaleString();
	})();

	return (
		<div
			role="status"
			style={{
				position: 'fixed',
				top: 18,
				left: '50%',
				transform: 'translateX(-50%)',
				background: PANEL,
				border: `1px solid ${PHOSPHOR}`,
				borderRadius: 7,
				boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 12px 30px #000000aa`,
				padding: '7px 14px',
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				zIndex: 200,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: 11,
				color: TEXT,
				opacity: fading ? 0 : 1,
				transition: 'opacity 380ms ease'
			}}
		>
			<span style={{ color: PHOSPHOR, fontWeight: 700 }}>● Draft restored</span>
			<span style={{ color: DIM }}>{relative}</span>
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
					lineHeight: 1
				}}
			>
				×
			</button>
		</div>
	);
}
