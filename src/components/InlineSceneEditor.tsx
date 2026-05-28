/**
 * Floating scene editor card anchored to the selected node on
 * the graph. Replaces the cross-screen ping-pong of "click left,
 * edit far right" with edit-in-place. The right-panel
 * `SceneEditor` still exists as a wide-edit fallback (the ⤢
 * button hides this card so the side panel becomes the focus).
 *
 * Implementation notes:
 *   - Anchored via `useReactFlow().flowToScreenPosition`, the
 *     v12 API. Re-runs on every viewport transform change so the
 *     card glides with pan/zoom.
 *   - Rendered through a portal at `position: fixed` so it isn't
 *     clipped by the canvas. The pane sits on top of the canvas
 *     but below modals (z-index 50).
 *   - Flips left/right of the node based on which half of the
 *     viewport the node sits in; clamps height to the viewport.
 *   - Reuses every `lib/edit.ts` helper the right-panel
 *     `SceneEditor` does — the editor surface differs (compact
 *     rows here vs stacked blocks there) but the underlying
 *     immutable JSON updates are identical.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useReactFlow, useStore } from '@xyflow/react';
import type { AdventureJson } from 'console-adventure';
import {
	PHOSPHOR,
	AMBER,
	CYAN,
	MAGENTA,
	DIM,
	TEXT,
	PANEL,
	PANEL_BORDER,
	VOID
} from '../lib/theme';
import {
	updateScene,
	updateChoice,
	addChoice,
	deleteChoice
} from '../lib/edit';

interface Props {
	json: AdventureJson;
	sceneId: string;
	onJsonChange: (next: AdventureJson) => void;
	onClose: () => void;
	/** "⤢ open in side panel" — hides this card so the right-panel SceneEditor is the focus. */
	onExpand: () => void;
	/** "▶ play from here" — boots the playtest at this scene without mutating the document's start. */
	onPlayFromHere: () => void;
}

const CARD_WIDTH = 520;
const NODE_WIDTH = 300;
const GAP = 24;
const VIEWPORT_MARGIN = 16;
const PANEL_2 = '#1a1a24'; // slightly lighter than PANEL for header strip

export function InlineSceneEditor({
	json,
	sceneId,
	onJsonChange,
	onClose,
	onExpand,
	onPlayFromHere
}: Props) {
	const rf = useReactFlow();
	// Subscribe to the React Flow viewport transform so this
	// component re-renders on every pan / zoom. `transform` is
	// `[x, y, zoom]` — we don't use the value directly (we go
	// through `flowToScreenPosition`), we just need the
	// subscription to drive the re-render.
	useStore((s) => s.transform);

	const scene = json.scenes[sceneId];
	const node = rf.getNode(sceneId);

	// Window dims for clamping. Updated on resize so the card
	// re-flips if the user resizes the window with it open.
	const [winSize, setWinSize] = useState(() => ({
		w: window.innerWidth,
		h: window.innerHeight
	}));
	useEffect(() => {
		const onResize = () => setWinSize({ w: window.innerWidth, h: window.innerHeight });
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	if (!scene || !node) return null;

	// Top-left of the node in screen coords. v12's
	// flowToScreenPosition takes flow-space xy and returns
	// screen-space xy accounting for pan + zoom.
	const nodeTopLeft = rf.flowToScreenPosition({
		x: node.position.x,
		y: node.position.y
	});
	const nodeTopRight = rf.flowToScreenPosition({
		x: node.position.x + NODE_WIDTH,
		y: node.position.y
	});

	// Flip the card to the node's left when the node sits past
	// the viewport mid-line, so the card never falls off-screen.
	const flipLeft = nodeTopRight.x + GAP + CARD_WIDTH > winSize.w - VIEWPORT_MARGIN;

	let left = flipLeft ? nodeTopLeft.x - GAP - CARD_WIDTH : nodeTopRight.x + GAP;
	let top = nodeTopLeft.y;

	// Clamp horizontally so the card stays on-screen if the node
	// gets dragged near the edge.
	left = Math.max(VIEWPORT_MARGIN, Math.min(left, winSize.w - CARD_WIDTH - VIEWPORT_MARGIN));

	const maxHeight = Math.min(620, winSize.h - 32);
	// Clamp vertically: top + height can't exceed window height.
	top = Math.max(VIEWPORT_MARGIN, Math.min(top, winSize.h - maxHeight - VIEWPORT_MARGIN));

	const cardStyle: CSSProperties = {
		position: 'fixed',
		left,
		top,
		width: CARD_WIDTH,
		maxHeight,
		background: PANEL,
		border: `1px solid ${AMBER}`,
		borderRadius: 11,
		boxShadow: `0 0 0 1px ${AMBER}22, 0 22px 60px #000000aa`,
		fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
		color: TEXT,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden',
		zIndex: 50
	};

	const sceneIds = Object.keys(json.scenes).sort();
	const isStart = json.start === sceneId;

	return createPortal(
		<div style={cardStyle} role="dialog" aria-label={`edit scene ${sceneId}`}>
			{/* Header strip — EDITING label, path + heading, id, expand, close. */}
			<div
				style={{
					background: PANEL_2,
					borderBottom: `1px solid ${PANEL_BORDER}`,
					padding: '10px 14px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12
				}}
			>
				<div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
					<span
						style={{
							color: isStart ? MAGENTA : AMBER,
							fontSize: 9,
							fontWeight: 700,
							letterSpacing: '0.1em',
							flexShrink: 0
						}}
					>
						EDITING
					</span>
					<span
						style={{
							fontSize: 11,
							color: DIM,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						}}
					>
						<span style={{ color: PHOSPHOR }}>~/foundry</span>
						<span style={{ margin: '0 6px' }}>·</span>
						<span style={{ color: TEXT }}>{scene.heading}</span>
					</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
					<span style={{ color: DIM, fontSize: 10 }}>
						id <span style={{ color: CYAN }}>{sceneId}</span>
					</span>
					<HeaderButton onClick={onExpand} title="Open in side panel">⤢</HeaderButton>
					<HeaderButton onClick={onClose} title="Close (deselect)">×</HeaderButton>
				</div>
			</div>

			{/* Body — scrolls if the choice list is long. */}
			<div style={{ flex: 1, overflow: 'auto', padding: '12px 14px' }}>
				<FieldLabel>NARRATION</FieldLabel>
				<textarea
					value={scene.narration.join('\n')}
					rows={3}
					onChange={(e) =>
						onJsonChange(
							updateScene(json, sceneId, { narration: e.target.value.split('\n') })
						)
					}
					style={{
						width: '100%',
						background: VOID,
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 4,
						color: TEXT,
						padding: '6px 8px',
						fontFamily: 'inherit',
						fontSize: 11,
						lineHeight: 1.5,
						outline: 'none',
						resize: 'vertical',
						transition: 'border-color 120ms'
					}}
					onFocus={(e) => (e.target.style.borderColor = AMBER)}
					onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
				/>

				<div
					style={{
						display: 'flex',
						alignItems: 'baseline',
						justifyContent: 'space-between',
						marginTop: 14,
						marginBottom: 6
					}}
				>
					<FieldLabel>CHOICES</FieldLabel>
					<span style={{ color: DIM, fontSize: 9 }}>
						drag ⠿ to reorder · grab → to wire
					</span>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{scene.choices.map((c, i) => (
						<ChoiceRow
							key={i}
							json={json}
							sceneId={sceneId}
							choiceIndex={i}
							label={c.label}
							points={c.points ?? 0}
							next={c.next}
							sceneIds={sceneIds}
							onJsonChange={onJsonChange}
							onDelete={() => onJsonChange(deleteChoice(json, sceneId, i))}
						/>
					))}
				</div>
			</div>

			{/* Footer — + choice (ghost) and ▶ play from here (cyan stub). */}
			<div
				style={{
					borderTop: `1px solid ${PANEL_BORDER}`,
					padding: '8px 14px',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: 8
				}}
			>
				<FooterButton
					color={AMBER}
					onClick={() => onJsonChange(addChoice(json, sceneId))}
				>
					+ choice
				</FooterButton>
				<FooterButton color={CYAN} onClick={onPlayFromHere}>
					▶ play from here
				</FooterButton>
			</div>
		</div>,
		document.body
	);
}

/* ─── sub-components ────────────────────────────────────── */

function FieldLabel({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				fontSize: 9,
				fontWeight: 700,
				letterSpacing: '0.1em',
				color: DIM,
				marginBottom: 4
			}}
		>
			{children}
		</div>
	);
}

function HeaderButton({
	onClick,
	title,
	children
}: {
	onClick: () => void;
	title: string;
	children: ReactNode;
}) {
	return (
		<button
			onClick={onClick}
			title={title}
			style={{
				background: 'transparent',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 4,
				color: DIM,
				width: 22,
				height: 22,
				display: 'inline-flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: 'inherit',
				fontSize: 12,
				cursor: 'pointer',
				lineHeight: 1,
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
			{children}
		</button>
	);
}

function FooterButton({
	color,
	onClick,
	children,
	disabled
}: {
	color: string;
	onClick: () => void;
	children: ReactNode;
	disabled?: boolean;
}) {
	return (
		<button
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			title={disabled ? 'Coming in Move 03' : undefined}
			style={{
				background: 'transparent',
				border: `1px solid ${disabled ? PANEL_BORDER : color}`,
				borderRadius: 4,
				color: disabled ? DIM : color,
				padding: '5px 10px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: disabled ? 'not-allowed' : 'pointer',
				opacity: disabled ? 0.55 : 1,
				transition: 'background 120ms, color 120ms'
			}}
			onMouseEnter={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = `${color}11`;
			}}
			onMouseLeave={(e) => {
				if (disabled) return;
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{children}
		</button>
	);
}

/**
 * One compact row per choice — grip / index / label input /
 * points input / next-scene chip / delete. Replaces the
 * stacked-block layout from the right-panel SceneEditor so a
 * scene with 4–5 choices fits without scrolling.
 *
 * The grip column (`⠿`) is a visual affordance only in this
 * pass — reorder via pointer drag arrives in 2a-followup once
 * the wire handle (2b) is locked down. The → at the end is the
 * future wire-handle spot (also 2b).
 */
function ChoiceRow({
	json,
	sceneId,
	choiceIndex,
	label,
	points,
	next,
	sceneIds,
	onJsonChange,
	onDelete
}: {
	json: AdventureJson;
	sceneId: string;
	choiceIndex: number;
	label: string;
	points: number;
	next: string | null;
	sceneIds: string[];
	onJsonChange: (next: AdventureJson) => void;
	onDelete: () => void;
}) {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 8,
				padding: '6px 8px',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 6,
				background: VOID
			}}
		>
			<span style={{ color: DIM, cursor: 'grab', fontSize: 11 }} title="reorder (coming soon)">⠿</span>
			<span style={{ color: AMBER, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
				{choiceIndex + 1})
			</span>
			<input
				type="text"
				value={label}
				onChange={(e) =>
					onJsonChange(updateChoice(json, sceneId, choiceIndex, { label: e.target.value }))
				}
				style={{
					flex: 1,
					minWidth: 0,
					background: 'transparent',
					border: 'none',
					color: TEXT,
					fontFamily: 'inherit',
					fontSize: 11,
					outline: 'none',
					padding: '2px 4px'
				}}
				onFocus={(e) => (e.target.style.background = `${AMBER}11`)}
				onBlur={(e) => (e.target.style.background = 'transparent')}
			/>
			<input
				type="number"
				value={points}
				onChange={(e) =>
					onJsonChange(
						updateChoice(json, sceneId, choiceIndex, {
							points: Number(e.target.value) || 0
						})
					)
				}
				style={{
					width: 44,
					background: VOID,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 4,
					color: PHOSPHOR,
					fontFamily: 'inherit',
					fontSize: 10,
					padding: '2px 4px',
					outline: 'none',
					textAlign: 'center'
				}}
				title="points"
			/>
			<select
				value={next ?? '__null__'}
				onChange={(e) => {
					const v = e.target.value === '__null__' ? null : e.target.value;
					onJsonChange(updateChoice(json, sceneId, choiceIndex, { next: v }));
				}}
				style={{
					maxWidth: 110,
					background: VOID,
					border: `1px solid ${next === null ? MAGENTA : AMBER}`,
					borderRadius: 4,
					color: next === null ? MAGENTA : AMBER,
					fontFamily: 'inherit',
					fontSize: 10,
					padding: '2px 6px',
					outline: 'none'
				}}
				title="NEXT scene"
			>
				<option value="__null__">finish</option>
				{sceneIds.map((id) => (
					<option key={id} value={id}>
						{id}
					</option>
				))}
			</select>
			<button
				onClick={() => {
					/* placeholder wire-handle, becomes draggable in 2b */
				}}
				title="wire to scene (coming in 2b)"
				style={{
					background: 'transparent',
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: '50%',
					width: 22,
					height: 22,
					color: AMBER,
					fontFamily: 'inherit',
					fontSize: 11,
					cursor: 'not-allowed',
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					lineHeight: 1,
					opacity: 0.55
				}}
			>
				→
			</button>
			<button
				onClick={onDelete}
				title="delete choice"
				style={{
					background: 'transparent',
					border: 'none',
					color: DIM,
					cursor: 'pointer',
					fontFamily: 'inherit',
					fontSize: 12,
					padding: '0 2px'
				}}
				onMouseEnter={(e) => (e.currentTarget.style.color = MAGENTA)}
				onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
			>
				×
			</button>
		</div>
	);
}

