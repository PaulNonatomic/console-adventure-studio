/**
 * Top toolbar (Move 06 — Grouped + consolidated Open).
 *
 * Layout:
 *   ┌── identity ───────────────┐  ┌── actions ──────────────────────────────┐
 *   │ [▸] doc-name ● 6 scenes…  │  │ [＋new │ open ▾] · save · ▶play · ship ↗ ⋯ │
 *   └───────────────────────────┘  └────────────────────────────────────────┘
 *
 * Responsive collapse:
 *   - ~720px wide: stats text drops, ＋new folds into the ⋯ menu, ▶ play
 *     becomes icon-only.
 *   - ~380px wide: identity collapses to mark + truncated name; the right
 *     cluster shrinks to ship + ⋯.
 *
 * The bar holds its identity (mark + doc context) and its actions. Every
 * import path (example / upload / URL / paste) goes through one `open ▾`
 * dropdown so the top-level button count stays low.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, CYAN, DIM, TEXT, VOID } from '../lib/theme';
import {
	readFileAsJson,
	pasteJsonFromClipboard,
	fetchJsonFromUrl
} from '../lib/import';

interface Props {
	documentName: string;
	dirty: boolean;
	stats: { scenes: number; maxScore: number };
	onLoadExample: () => void;
	onLoadJson: (json: unknown) => void;
	onNewAdventure: () => void;
	onSave: () => void;
	onOpenLoadDialog: () => void;
	onOpenShipDialog: () => void;
	onPlay: () => void;
	onAutoLayout: () => void;
	onResetZoom: () => void;
	onStartTour: () => void;
	onError: (message: string) => void;
	saveAvailable: boolean;
}

const BAR_HEIGHT = 56;
const BREAKPOINT_TABLET = 880;
const BREAKPOINT_PHONE = 540;

type Size = 'desktop' | 'tablet' | 'phone';

export function Toolbar(props: Props) {
	const {
		documentName,
		dirty,
		stats,
		onLoadExample,
		onLoadJson,
		onNewAdventure,
		onSave,
		onOpenLoadDialog,
		onOpenShipDialog,
		onPlay,
		onAutoLayout,
		onResetZoom,
		onStartTour,
		onError,
		saveAvailable
	} = props;

	const fileInputRef = useRef<HTMLInputElement>(null);
	const headerRef = useRef<HTMLElement | null>(null);
	const [size, setSize] = useState<Size>('desktop');
	const [openMenu, setOpenMenu] = useState<'open' | 'more' | null>(null);

	// Track header width via ResizeObserver. Collapses degrade
	// by priority: stats drop first, then ＋ new, then Play
	// becomes icon-only, then everything but ship + ⋯.
	useLayoutEffect(() => {
		const el = headerRef.current;
		if (!el) return;
		const measure = () => {
			const w = el.getBoundingClientRect().width;
			if (w < BREAKPOINT_PHONE) setSize('phone');
			else if (w < BREAKPOINT_TABLET) setSize('tablet');
			else setSize('desktop');
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const callbacks = { onLoad: onLoadJson, onError };
	function handleUpload(file: File) {
		readFileAsJson(file, callbacks);
	}
	function handlePaste() {
		void pasteJsonFromClipboard(callbacks);
	}
	function handleFetchUrl() {
		const url = window.prompt('Fetch adventure JSON from URL:');
		if (!url) return;
		void fetchJsonFromUrl(url, callbacks);
	}
	function triggerFilePicker() {
		fileInputRef.current?.click();
	}

	// Keyboard shortcuts. Cmd/Ctrl + key. Skip while in inputs.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			if (
				tag === 'INPUT' ||
				tag === 'TEXTAREA' ||
				tag === 'SELECT' ||
				target?.isContentEditable
			) {
				return;
			}
			switch (e.key.toLowerCase()) {
				case 'n':
					e.preventDefault();
					onNewAdventure();
					break;
				case 'o':
					e.preventDefault();
					setOpenMenu('open');
					break;
				case 's':
					e.preventDefault();
					if (saveAvailable) onSave();
					break;
				case 'e':
					e.preventDefault();
					onOpenShipDialog();
					break;
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onNewAdventure, onSave, onOpenShipDialog, saveAvailable]);

	const openMenuItems: MenuItem[] = [
		{ icon: '◆', label: 'Example adventure', onClick: onLoadExample },
		{ icon: '↑', label: 'Upload file…', kbd: '⌘O', onClick: triggerFilePicker },
		{ icon: '◎', label: 'From URL…', onClick: handleFetchUrl },
		{ icon: '⌶', label: 'Paste JSON', onClick: handlePaste }
	];

	const moreMenuItems: MenuItem[] = [
		...(size !== 'desktop'
			? [{ icon: '＋', label: 'New adventure', kbd: '⌘N', onClick: onNewAdventure }]
			: []),
		{ icon: '⌘', label: 'Load saved…', onClick: onOpenLoadDialog, disabled: !saveAvailable },
		{ icon: '↗', label: 'Export / Ship…', kbd: '⌘E', onClick: onOpenShipDialog },
		'-',
		{ icon: '⤢', label: 'Auto layout', kbd: '⇧L', onClick: onAutoLayout },
		{ icon: '⊡', label: 'Reset zoom', onClick: onResetZoom },
		'-',
		{ icon: '?', label: 'Help / tour', onClick: onStartTour },
		{
			icon: 'ⓘ',
			label: `Build ${__BUILD_TAG__}`,
			kbd: __BUILD_TIME__,
			onClick: () => {
				/* informational — built time shown as the kbd hint */
			},
			disabled: true
		}
	];

	return (
		<header
			ref={headerRef}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 16,
				padding: '0 20px',
				height: BAR_HEIGHT,
				background: PANEL,
				borderBottom: `1px solid ${PANEL_BORDER}`,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				position: 'relative',
				zIndex: 30
			}}
		>
			{/* hidden input used by the upload menu item */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".json,application/json"
				style={{ display: 'none' }}
				onChange={(e) => {
					const f = e.target.files?.[0];
					if (f) handleUpload(f);
					e.target.value = '';
				}}
			/>

			{/* Identity: logo mark + document context */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
				<LogoMark />
				<DocContext
					name={documentName}
					dirty={dirty}
					stats={stats}
					showStats={size === 'desktop'}
					truncate={size === 'phone'}
				/>
			</div>

			<div style={{ flex: 1 }} />

			{/* Right cluster */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 7,
					flexShrink: 0
				}}
			>
				{size === 'desktop' && (
					<SegmentedFileGroup
						onNew={onNewAdventure}
						onOpenMenu={() => setOpenMenu('open')}
					/>
				)}
				{size === 'tablet' && (
					<NavButton onClick={() => setOpenMenu('open')} tone="amber">
						open ▾
					</NavButton>
				)}

				{size !== 'phone' && (
					<NavButton onClick={onSave} disabled={!saveAvailable} tone="amber">
						save
					</NavButton>
				)}

				{size === 'desktop' && <ToolbarDivider />}

				{size !== 'phone' && (
					<NavButton onClick={onPlay} tone="cyan">
						{size === 'tablet' ? '▶' : '▶ play'}
					</NavButton>
				)}

				<NavButton onClick={onOpenShipDialog} tone="solid" dataTour="ship-button">
					ship ↗
				</NavButton>

				<NavButton onClick={() => setOpenMenu('more')} tone="ghost">
					⋯
				</NavButton>
			</div>

			{openMenu === 'open' && (
				<Menu
					items={openMenuItems}
					anchor="open"
					onClose={() => setOpenMenu(null)}
				/>
			)}
			{openMenu === 'more' && (
				<Menu
					items={moreMenuItems}
					anchor="more"
					onClose={() => setOpenMenu(null)}
				/>
			)}
		</header>
	);
}

/* ─── identity ──────────────────────────────────────────── */

function LogoMark() {
	return (
		<div
			title="console-adventure-studio"
			style={{
				width: 26,
				height: 26,
				borderRadius: 6,
				background: PHOSPHOR,
				color: VOID,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontSize: 13,
				fontWeight: 700,
				flexShrink: 0
			}}
		>
			▸
		</div>
	);
}

function DocContext({
	name,
	dirty,
	stats,
	showStats,
	truncate
}: {
	name: string;
	dirty: boolean;
	stats: { scenes: number; maxScore: number };
	showStats: boolean;
	truncate: boolean;
}) {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 9,
				minWidth: 0
			}}
		>
			<span
				style={{
					color: TEXT,
					fontSize: 12.5,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					maxWidth: truncate ? 140 : 280
				}}
				title={name}
			>
				{name}
			</span>
			<span
				title={dirty ? 'unsaved changes' : 'saved'}
				style={{
					width: 7,
					height: 7,
					borderRadius: 4,
					background: dirty ? AMBER : PANEL_BORDER,
					flexShrink: 0,
					transition: 'background 120ms'
				}}
			/>
			{showStats && (
				<span style={{ color: DIM, fontSize: 10.5, whiteSpace: 'nowrap' }}>
					{stats.scenes} scenes · max {stats.maxScore}
				</span>
			)}
		</div>
	);
}

/* ─── right cluster ─────────────────────────────────────── */

function SegmentedFileGroup({
	onNew,
	onOpenMenu
}: {
	onNew: () => void;
	onOpenMenu: () => void;
}) {
	return (
		<div
			style={{
				display: 'inline-flex',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 6,
				overflow: 'hidden'
			}}
		>
			<SegmentButton color={PHOSPHOR} onClick={onNew}>
				＋ new
			</SegmentButton>
			<div style={{ width: 1, background: PANEL_BORDER }} />
			<SegmentButton color={AMBER} onClick={onOpenMenu}>
				open ▾
			</SegmentButton>
		</div>
	);
}

function SegmentButton({
	color,
	onClick,
	children
}: {
	color: string;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				background: 'transparent',
				color,
				border: 'none',
				padding: '6px 11px',
				fontFamily: 'inherit',
				fontSize: 11.5,
				cursor: 'pointer',
				transition: 'background 120ms'
			}}
			onMouseEnter={(e) => (e.currentTarget.style.background = `${color}11`)}
			onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
		>
			{children}
		</button>
	);
}

type Tone = 'amber' | 'cyan' | 'solid' | 'ghost';

function NavButton({
	tone,
	onClick,
	disabled = false,
	children,
	dataTour
}: {
	tone: Tone;
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
	dataTour?: string;
}) {
	const color =
		tone === 'solid'
			? VOID
			: tone === 'cyan'
			? CYAN
			: tone === 'ghost'
			? DIM
			: AMBER;
	const borderColor =
		tone === 'solid'
			? PHOSPHOR
			: tone === 'cyan'
			? `${CYAN}66`
			: tone === 'ghost'
			? 'transparent'
			: PANEL_BORDER;
	const background = tone === 'solid' ? PHOSPHOR : 'transparent';
	return (
		<button
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			data-tour={dataTour}
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				gap: 6,
				background,
				color: disabled ? DIM : color,
				border: `1px solid ${borderColor}`,
				borderRadius: 6,
				padding: '6px 12px',
				fontFamily: 'inherit',
				fontSize: 11.5,
				fontWeight: tone === 'solid' ? 600 : 400,
				cursor: disabled ? 'not-allowed' : 'pointer',
				opacity: disabled ? 0.5 : 1,
				whiteSpace: 'nowrap',
				transition: 'background 120ms, color 120ms, border-color 120ms'
			}}
			onMouseEnter={(e) => {
				if (disabled || tone === 'solid') return;
				e.currentTarget.style.background = `${color}14`;
				if (tone === 'ghost') e.currentTarget.style.color = AMBER;
			}}
			onMouseLeave={(e) => {
				if (disabled || tone === 'solid') return;
				e.currentTarget.style.background = 'transparent';
				if (tone === 'ghost') e.currentTarget.style.color = DIM;
			}}
		>
			{children}
		</button>
	);
}

function ToolbarDivider() {
	return (
		<div
			style={{
				width: 1,
				height: 20,
				background: PANEL_BORDER,
				margin: '0 2px'
			}}
		/>
	);
}

/* ─── menu ──────────────────────────────────────────────── */

interface MenuItemObject {
	icon?: string;
	label: string;
	kbd?: string;
	onClick: () => void;
	disabled?: boolean;
}
type MenuItem = MenuItemObject | '-';

function Menu({
	items,
	anchor,
	onClose
}: {
	items: MenuItem[];
	anchor: 'open' | 'more';
	onClose: () => void;
}) {
	const ref = useRef<HTMLDivElement | null>(null);

	// Outside click + Esc close. Use mousedown so the click that
	// landed outside doesn't first dispatch to a button inside.
	useEffect(() => {
		const onDown = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('mousedown', onDown);
		window.addEventListener('keydown', onKey);
		return () => {
			window.removeEventListener('mousedown', onDown);
			window.removeEventListener('keydown', onKey);
		};
	}, [onClose]);

	// Anchor positions tuned to where the buttons live on the
	// right side of the bar. `right` offset places the menu's
	// right edge roughly under the button that opened it.
	const style = {
		open: { right: 200, top: BAR_HEIGHT + 4 } as const,
		more: { right: 12, top: BAR_HEIGHT + 4 } as const
	}[anchor];

	return (
		<div
			ref={ref}
			role="menu"
			style={{
				position: 'absolute',
				...style,
				background: PANEL,
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 9,
				boxShadow: '0 16px 50px #000000bb',
				padding: 5,
				width: anchor === 'open' ? 210 : 240,
				zIndex: 50
			}}
		>
			{items.map((it, i) =>
				it === '-' ? (
					<div
						key={i}
						style={{
							height: 1,
							background: PANEL_BORDER,
							margin: '5px 6px'
						}}
					/>
				) : (
					<MenuRow
						key={i}
						item={it}
						onClick={() => {
							if (it.disabled) return;
							it.onClick();
							onClose();
						}}
					/>
				)
			)}
		</div>
	);
}

function MenuRow({
	item,
	onClick
}: {
	item: MenuItemObject;
	onClick: () => void;
}) {
	const color = item.disabled ? DIM : TEXT;
	return (
		<button
			role="menuitem"
			onClick={onClick}
			disabled={item.disabled}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				padding: '7px 10px',
				borderRadius: 5,
				background: 'transparent',
				border: 'none',
				width: '100%',
				cursor: item.disabled ? 'default' : 'pointer',
				fontFamily: 'inherit',
				textAlign: 'left',
				opacity: item.disabled ? 0.6 : 1
			}}
			onMouseEnter={(e) => {
				if (!item.disabled) e.currentTarget.style.background = `${PHOSPHOR}14`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{item.icon && (
				<span style={{ width: 15, color: DIM, fontSize: 12 }}>{item.icon}</span>
			)}
			<span style={{ flex: 1, fontSize: 12, color }}>{item.label}</span>
			{item.kbd && (
				<span style={{ fontSize: 10, color: DIM, whiteSpace: 'nowrap' }}>
					{item.kbd}
				</span>
			)}
		</button>
	);
}
