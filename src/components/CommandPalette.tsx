/**
 * ⌘K command palette. The Move 06 spec called this out as "a
 * sanctioned future accelerator that can be layered on top of
 * Option 3 later" -- a single text-input surface that lets the
 * user fire any action from one chord.
 *
 * Behaviour:
 *   - Cmd/Ctrl+K opens it from anywhere (including inside text
 *     inputs). Esc closes.
 *   - Fuzzy subsequence match against each command's label so
 *     "fts" finds "Fit to screen" and "exp" finds "Export /
 *     Ship". Scoring is naive but fine for ~25 commands.
 *   - ↑ / ↓ walk the list, Enter fires the highlighted command,
 *     click also fires.
 *   - Disabled commands are filtered out entirely so the user
 *     can't pick something that wouldn't work.
 *
 * The palette is purely a UI dispatcher -- every command's
 * `onRun` is a callback owned by App; nothing here mutates
 * studio state directly.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	CYAN,
	DIM,
	TEXT,
	VOID
} from '../lib/theme';

export interface PaletteCommand {
	id: string;
	label: string;
	hint?: string;
	kbd?: string;
	icon?: string;
	disabled?: boolean;
	onRun: () => void;
}

interface Props {
	commands: PaletteCommand[];
	onClose: () => void;
}

export function CommandPalette({ commands, onClose }: Props) {
	const [query, setQuery] = useState('');
	const [highlight, setHighlight] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const listRef = useRef<HTMLDivElement | null>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current = document.activeElement as HTMLElement | null;
		queueMicrotask(() => inputRef.current?.focus());
		return () => previousFocusRef.current?.focus?.();
	}, []);

	const filtered = useMemo<PaletteCommand[]>(() => {
		const enabled = commands.filter((c) => !c.disabled);
		if (!query.trim()) return enabled;
		const q = query.toLowerCase().trim();
		return enabled.filter((c) => fuzzyMatch(q, c.label.toLowerCase()));
	}, [commands, query]);

	useEffect(() => {
		// Reset highlight whenever the filtered list shrinks past
		// it -- e.g. as the user narrows the query.
		if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
	}, [filtered.length, highlight]);

	useEffect(() => {
		// Scroll the highlighted row into view as the user
		// arrow-walks past the visible area.
		const el = listRef.current?.querySelector<HTMLElement>(
			`[data-cmd-index="${highlight}"]`
		);
		el?.scrollIntoView({ block: 'nearest' });
	}, [highlight]);

	const runHighlighted = () => {
		const cmd = filtered[highlight];
		if (!cmd) return;
		onClose();
		// Fire AFTER close so the palette unmounts and the user's
		// previously-focused element is restored before the
		// command runs (some commands open their own dialogs and
		// want focus management to land on the right thing).
		queueMicrotask(() => cmd.onRun());
	};

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Command palette"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			onKeyDown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					onClose();
				} else if (e.key === 'ArrowDown') {
					e.preventDefault();
					setHighlight((h) => Math.min(h + 1, filtered.length - 1));
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					setHighlight((h) => Math.max(h - 1, 0));
				} else if (e.key === 'Enter') {
					e.preventDefault();
					runHighlighted();
				}
			}}
			style={{
				position: 'fixed',
				inset: 0,
				background: `${VOID}cc`,
				zIndex: 110,
				display: 'flex',
				alignItems: 'flex-start',
				justifyContent: 'center',
				paddingTop: '12vh',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				style={{
					width: 'min(540px, 92vw)',
					maxHeight: '70vh',
					background: PANEL,
					border: `1px solid ${PHOSPHOR}`,
					borderRadius: 11,
					boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 22px 60px #000000cc`,
					color: TEXT,
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden'
				}}
			>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: 8,
						padding: '12px 14px',
						borderBottom: `1px solid ${PANEL_BORDER}`,
						background: VOID
					}}
				>
					<span
						style={{
							color: PHOSPHOR,
							fontSize: 11,
							fontWeight: 700,
							letterSpacing: '0.1em'
						}}
					>
						⌘K
					</span>
					<input
						ref={inputRef}
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setHighlight(0);
						}}
						placeholder="Search commands…"
						style={{
							flex: 1,
							background: 'transparent',
							border: 'none',
							color: TEXT,
							fontFamily: 'inherit',
							fontSize: 14,
							outline: 'none',
							padding: '2px 4px'
						}}
					/>
					<span
						style={{
							color: DIM,
							fontSize: 9,
							letterSpacing: '0.08em'
						}}
					>
						↑↓ navigate · ↵ run · esc close
					</span>
				</div>

				<div
					ref={listRef}
					style={{
						flex: 1,
						overflow: 'auto',
						padding: 5
					}}
				>
					{filtered.length === 0 && (
						<EmptyRow query={query} />
					)}
					{filtered.map((cmd, i) => (
						<CommandRow
							key={cmd.id}
							index={i}
							command={cmd}
							highlighted={i === highlight}
							onHover={() => setHighlight(i)}
							onClick={() => {
								setHighlight(i);
								queueMicrotask(runHighlighted);
							}}
						/>
					))}
				</div>
			</div>
		</div>
	);
}

/* ─── rows ──────────────────────────────────────────────── */

function CommandRow({
	index,
	command,
	highlighted,
	onHover,
	onClick
}: {
	index: number;
	command: PaletteCommand;
	highlighted: boolean;
	onHover: () => void;
	onClick: () => void;
}) {
	return (
		<div
			data-cmd-index={index}
			role="menuitem"
			onMouseEnter={onHover}
			onClick={onClick}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				padding: '8px 10px',
				borderRadius: 5,
				background: highlighted ? `${PHOSPHOR}14` : 'transparent',
				cursor: 'pointer'
			}}
		>
			{command.icon && (
				<span style={{ width: 16, color: DIM, fontSize: 12, flexShrink: 0 }}>
					{command.icon}
				</span>
			)}
			<span
				style={{
					flex: 1,
					fontSize: 12,
					color: highlighted ? PHOSPHOR : TEXT,
					fontWeight: highlighted ? 700 : 400
				}}
			>
				{command.label}
			</span>
			{command.hint && (
				<span style={{ fontSize: 10, color: CYAN, whiteSpace: 'nowrap' }}>
					{command.hint}
				</span>
			)}
			{command.kbd && (
				<span
					style={{
						fontSize: 10,
						color: DIM,
						whiteSpace: 'nowrap',
						background: VOID,
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 3,
						padding: '1px 6px'
					}}
				>
					{command.kbd}
				</span>
			)}
		</div>
	);
}

function EmptyRow({ query }: { query: string }) {
	return (
		<div
			style={{
				padding: 18,
				textAlign: 'center',
				color: DIM,
				fontSize: 11,
				lineHeight: 1.5
			}}
		>
			{query.trim() ? (
				<>
					No commands match <span style={{ color: AMBER }}>{query.trim()}</span>.
					<br />
					Try a shorter query or check the ⋯ menu for what's available.
				</>
			) : (
				<>No commands available right now.</>
			)}
		</div>
	);
}

/* ─── fuzzy match ───────────────────────────────────────── */

/**
 * Subsequence match -- each char in `q` must appear in `target`
 * in order, but not necessarily contiguously. So "exp" matches
 * "Export / Ship…" and "rzm" matches "Reset zoom". Cheap, no
 * scoring -- the input list ordering is preserved.
 */
function fuzzyMatch(q: string, target: string): boolean {
	let i = 0;
	for (const ch of q) {
		const next = target.indexOf(ch, i);
		if (next < 0) return false;
		i = next + 1;
	}
	return true;
}

