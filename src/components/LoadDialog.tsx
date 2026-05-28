/**
 * Modal dialog that lists every save in localStorage. Each row
 * loads on click; a small delete button removes it. Backdrop
 * click and the Esc key close the dialog without loading.
 *
 * The list re-reads `listSaves()` every time the dialog opens
 * (and after each delete) so changes made in another tab show
 * up without a page refresh.
 */
import { useCallback, useEffect, useState } from 'react';
import { listSaves, deleteSave, type SaveEntry } from '../lib/storage';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	MAGENTA,
	TEXT,
	DIM,
	VOID
} from '../lib/theme';
import { Button } from './Inputs';
import type { AdventureJson } from 'console-adventure';

interface Props {
	onClose: () => void;
	onLoad: (json: AdventureJson, name: string) => void;
}

export function LoadDialog({ onClose, onLoad }: Props) {
	const [entries, setEntries] = useState<SaveEntry[]>(() => listSaves());

	const refresh = useCallback(() => setEntries(listSaves()), []);

	// Escape closes the dialog.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<div
			onClick={onClose}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(10, 10, 15, 0.7)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 100,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					background: PANEL,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 8,
					width: 'min(560px, 90vw)',
					maxHeight: '80vh',
					display: 'flex',
					flexDirection: 'column',
					boxShadow: '0 16px 48px rgba(0,0,0,0.55)'
				}}
			>
				<header
					style={{
						padding: '14px 18px',
						borderBottom: `1px solid ${PANEL_BORDER}`,
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'baseline'
					}}
				>
					<div>
						<div
							style={{
								color: PHOSPHOR,
								fontWeight: 700,
								fontSize: 14,
								letterSpacing: '0.05em'
							}}
						>
							saved adventures
						</div>
						<div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>
							stored in your browser · {entries.length}{' '}
							{entries.length === 1 ? 'save' : 'saves'}
						</div>
					</div>
					<button
						onClick={onClose}
						style={{
							background: 'transparent',
							border: 'none',
							color: DIM,
							fontSize: 18,
							cursor: 'pointer',
							lineHeight: 1
						}}
						aria-label="close"
					>
						×
					</button>
				</header>

				<div
					style={{
						flex: 1,
						overflow: 'auto',
						padding: entries.length === 0 ? '24px 18px' : '8px 0'
					}}
				>
					{entries.length === 0 ? (
						<div style={{ color: DIM, fontSize: 11, lineHeight: 1.6 }}>
							No saves yet. Click <span style={{ color: PHOSPHOR }}>save</span>{' '}
							in the toolbar to store the current adventure here. Saves live
							in your browser's localStorage and survive a page refresh.
						</div>
					) : (
						entries.map((entry) => (
							<SaveRow
								key={entry.id}
								entry={entry}
								onLoad={() => {
									onLoad(entry.save.json, entry.save.name);
									onClose();
								}}
								onDelete={() => {
									if (window.confirm(`Delete save "${entry.save.name}"?`)) {
										deleteSave(entry.id);
										refresh();
									}
								}}
							/>
						))
					)}
				</div>

				<footer
					style={{
						padding: '12px 18px',
						borderTop: `1px solid ${PANEL_BORDER}`,
						display: 'flex',
						justifyContent: 'flex-end'
					}}
				>
					<Button label="close" color="dim" onClick={onClose} />
				</footer>
			</div>
		</div>
	);
}

function SaveRow({
	entry,
	onLoad,
	onDelete
}: {
	entry: SaveEntry;
	onLoad: () => void;
	onDelete: () => void;
}) {
	const sceneCount = Object.keys(entry.save.json.scenes ?? {}).length;
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 12,
				padding: '10px 18px',
				borderBottom: `1px solid ${PANEL_BORDER}`,
				cursor: 'pointer'
			}}
			onClick={onLoad}
			onMouseEnter={(e) => (e.currentTarget.style.background = VOID)}
			onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
		>
			<div style={{ flex: 1, minWidth: 0 }}>
				<div
					style={{
						color: TEXT,
						fontSize: 12,
						fontWeight: 600,
						overflow: 'hidden',
						textOverflow: 'ellipsis',
						whiteSpace: 'nowrap'
					}}
				>
					{entry.save.name}
				</div>
				<div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>
					<span style={{ color: AMBER }}>{sceneCount} scene{sceneCount === 1 ? '' : 's'}</span>
					{' · '}
					<span>start: {entry.save.json.start}</span>
					{' · '}
					<span>{formatTimestamp(entry.save.savedAt)}</span>
				</div>
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					onDelete();
				}}
				style={{
					background: 'transparent',
					border: 'none',
					color: DIM,
					fontSize: 11,
					cursor: 'pointer',
					padding: '4px 8px',
					borderRadius: 4,
					transition: 'color 120ms, background 120ms'
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.color = MAGENTA;
					e.currentTarget.style.background = `${MAGENTA}11`;
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.color = DIM;
					e.currentTarget.style.background = 'transparent';
				}}
				aria-label={`delete ${entry.save.name}`}
			>
				delete
			</button>
		</div>
	);
}

/**
 * Format an ISO timestamp as a relative-ish "5 minutes ago" /
 * "yesterday" / "Mar 12" string. Short enough to fit in the
 * one-line metadata row, precise enough to disambiguate
 * multiple saves on the same day.
 */
function formatTimestamp(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.round(diffMs / 60_000);
	const diffHr = Math.round(diffMs / 3_600_000);
	const diffDay = Math.round(diffMs / 86_400_000);

	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay < 7) return `${diffDay}d ago`;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
