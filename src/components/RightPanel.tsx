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
import { useState, type ReactNode } from 'react';
import { Terminal } from './Terminal';
import { ScenePanel } from './ScenePanel';
import { PANEL, PANEL_BORDER, PHOSPHOR, DIM, AMBER } from '../lib/theme';
import { useResizable } from '../lib/useResizable';
import type { AdventureJson } from 'console-adventure';

type Tab = 'inspect' | 'play';

interface Props {
	json: AdventureJson;
	maxScore: number;
	selectedSceneId: string | null;
	onJsonChange: (next: AdventureJson, opts?: { remount?: boolean }) => void;
	onSelectScene: (id: string | null) => void;
}

export function RightPanel({
	json,
	maxScore,
	selectedSceneId,
	onJsonChange,
	onSelectScene
}: Props) {
	const [tab, setTab] = useState<Tab>('inspect');
	const { width, dragging, onMouseDown } = useResizable({
		initial: 420,
		min: 320,
		max: 900
	});

	return (
		<aside
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

			<TabBar active={tab} onChange={setTab} />

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
				<Terminal json={json} />
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
			<TabButton label="play" active={active === 'play'} onClick={() => onChange('play')} />
		</div>
	);
}

function TabButton({
	label,
	active,
	onClick
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
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
