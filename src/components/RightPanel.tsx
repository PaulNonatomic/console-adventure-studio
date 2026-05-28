/**
 * The right-hand panel — a small tab system that hosts both
 * the inspector (read-only scene details) and the in-studio
 * playtest terminal.
 *
 * Both tabs are rendered at all times (just hidden via CSS)
 * so the terminal's adventure state survives a tab switch —
 * you can read a scene's full content, switch back to Play
 * mid-game, and the game is still where you left it.
 */
import { useState, type ReactNode } from 'react';
import { Terminal } from './Terminal';
import { ScenePanel } from './ScenePanel';
import { PANEL, PANEL_BORDER, PHOSPHOR, DIM, AMBER } from '../lib/theme';
import type { AdventureJson } from 'console-adventure';

type Tab = 'inspect' | 'play';

interface Props {
	json: AdventureJson;
	maxScore: number;
	selectedSceneId: string | null;
}

export function RightPanel({ json, maxScore, selectedSceneId }: Props) {
	const [tab, setTab] = useState<Tab>('inspect');

	return (
		<aside
			style={{
				width: 380,
				background: PANEL,
				borderLeft: `1px solid ${PANEL_BORDER}`,
				color: '#eef0f5',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden'
			}}
		>
			<TabBar active={tab} onChange={setTab} />

			<TabContent visible={tab === 'inspect'}>
				<ScenePanel
					json={json}
					maxScore={maxScore}
					selectedSceneId={selectedSceneId}
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
			<TabButton label="inspect" active={active === 'inspect'} onClick={() => onChange('inspect')} />
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
	// Keep both tabs mounted; toggle visibility so terminal state
	// (current game progress, captured log lines) persists across
	// tab switches.
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
