/**
 * The right-hand panel — a small tab system that hosts both
 * the inspector/editor and the in-studio playtest terminal.
 *
 * The panel is drag-resizable from its left edge. Width
 * persists to localStorage so the user's preferred size
 * survives a page refresh.
 *
 * Both tabs are rendered at all times (just hidden via CSS)
 * so the terminal's adventure state survives a tab switch.
 */
import { useEffect, type ReactNode } from 'react';
import { Terminal, type PlayState } from './Terminal';
import { ScenePanel } from './ScenePanel';
import { PANEL, PANEL_BORDER, PHOSPHOR, DIM, AMBER } from '../lib/theme';
import { useResizable } from '../lib/useResizable';
import type { AdventureJson } from 'console-adventure';

export type Tab = 'inspect' | 'play';

interface Props {
	json: AdventureJson;
	jsonVersion: number;
	maxScore: number;
	selectedSceneId: string | null;
	playFrom: string | null;
	playRequestId: number;
	tab: Tab;
	onTabChange: (t: Tab) => void;
	onJsonChange: (next: AdventureJson, opts?: { remount?: boolean }) => void;
	onSelectScene: (id: string | null) => void;
	onPlayStateChange: (s: PlayState) => void;
	onClearPlayFrom: () => void;
}

export function RightPanel({
	json,
	jsonVersion,
	maxScore,
	selectedSceneId,
	playFrom,
	playRequestId,
	tab,
	onTabChange,
	onJsonChange,
	onSelectScene,
	onPlayStateChange,
	onClearPlayFrom
}: Props) {
	// Auto-switch to the inspect tab whenever a scene gets
	// selected on the graph. The user's intent in clicking a
	// node is to see / edit that node — but the inspector is
	// only one of two tabs, and if the user is mid-playtest on
	// the play tab their click would otherwise do nothing
	// visible. We respect their tab choice when no scene is
	// selected; the switch only triggers on a non-null new id.
	useEffect(() => {
		if (selectedSceneId !== null && tab !== 'inspect') {
			onTabChange('inspect');
		}
		// `tab` / `onTabChange` deliberately excluded — including
		// them would loop (the change triggers the effect again).
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedSceneId]);

	const { width, dragging, onMouseDown } = useResizable({
		initial: 420,
		min: 320,
		max: 900
	});

	return (
		<aside
			data-tour="right-panel"
			style={{
				width,
				flexShrink: 0,
				background: PANEL,
				borderLeft: `1px solid ${PANEL_BORDER}`,
				color: '#eef0f5',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden',
				position: 'relative'
			}}
		>
			{/* Drag handle on the very left edge of the panel. The
			    handle straddles the border (left: -4) so the user
			    has a 6px-wide hit area to grab. */}
			<div
				onMouseDown={onMouseDown}
				style={{
					position: 'absolute',
					top: 0,
					bottom: 0,
					left: -4,
					width: 8,
					cursor: 'col-resize',
					background: dragging ? AMBER : 'transparent',
					transition: dragging ? 'none' : 'background 120ms',
					zIndex: 20
				}}
				onMouseEnter={(e) => {
					if (!dragging) e.currentTarget.style.background = `${AMBER}55`;
				}}
				onMouseLeave={(e) => {
					if (!dragging) e.currentTarget.style.background = 'transparent';
				}}
				aria-label="resize panel"
				role="separator"
			/>

			<TabBar active={tab} onChange={onTabChange} />

			<TabContent visible={tab === 'inspect'}>
				<ScenePanel
					json={json}
					maxScore={maxScore}
					selectedSceneId={selectedSceneId}
					onJsonChange={onJsonChange}
					onSelectScene={onSelectScene}
				/>
			</TabContent>

			<TabContent visible={tab === 'play'}>
				<Terminal
					json={json}
					jsonVersion={jsonVersion}
					playFrom={playFrom}
					playRequestId={playRequestId}
					onClearPlayFrom={onClearPlayFrom}
					onStateChange={onPlayStateChange}
				/>
			</TabContent>
		</aside>
	);
}

function TabBar({
	active,
	onChange
}: {
	active: Tab;
	onChange: (t: Tab) => void;
}) {
	return (
		<div
			style={{
				display: 'flex',
				borderBottom: `1px solid ${PANEL_BORDER}`,
				background: PANEL
			}}
		>
			<TabButton
				label="inspect"
				active={active === 'inspect'}
				onClick={() => onChange('inspect')}
			/>
			<TabButton
				label="play"
				dataTour="play-tab"
				active={active === 'play'}
				onClick={() => onChange('play')}
			/>
		</div>
	);
}

function TabButton({
	label,
	active,
	onClick,
	dataTour
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	dataTour?: string;
}) {
	return (
		<button
			onClick={onClick}
			data-tour={dataTour}
			style={{
				flex: 1,
				background: 'transparent',
				border: 'none',
				borderBottom: `2px solid ${active ? PHOSPHOR : 'transparent'}`,
				color: active ? PHOSPHOR : DIM,
				padding: '12px 0',
				fontSize: 11,
				fontWeight: active ? 700 : 500,
				letterSpacing: '0.1em',
				fontFamily: 'inherit',
				cursor: 'pointer',
				transition: 'color 120ms, border-color 120ms'
			}}
			onMouseEnter={(e) => {
				if (!active) e.currentTarget.style.color = AMBER;
			}}
			onMouseLeave={(e) => {
				if (!active) e.currentTarget.style.color = DIM;
			}}
		>
			{label}
		</button>
	);
}

function TabContent({
	visible,
	children
}: {
	visible: boolean;
	children: ReactNode;
}) {
	return (
		<div
			style={{
				display: visible ? 'flex' : 'none',
				flexDirection: 'column',
				flex: 1,
				overflow: 'hidden'
			}}
		>
			{children}
		</div>
	);
}
