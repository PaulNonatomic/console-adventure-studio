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
import {
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode
} from 'react';
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
	deleteChoice,
	deleteScene,
	moveChoice
} from '../lib/edit';
import { useConfirm } from '../lib/confirm';

interface Props {
	json: AdventureJson;
	sceneId: string;
	onJsonChange: (next: AdventureJson) => void;
	onClose: () => void;
	/** "⤢ open in side panel" — hides this card so the right-panel SceneEditor is the focus. */
	onExpand: () => void;
	/** "▶ play from here" — boots the playtest at this scene without mutating the document's start. */
	onPlayFromHere: () => void;
	/**
	 * Called after the user confirms a scene deletion. The
	 * parent is expected to also clear `selectedScene` so this
	 * card unmounts. We don't do it here because the parent owns
	 * selection state.
	 */
	onSceneDeleted: () => void;
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
	onPlayFromHere,
	onSceneDeleted
}: Props) {
	const rf = useReactFlow();
	const confirm = useConfirm();
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

	// User-applied screen-space position. While null, the card
	// auto-anchors to the selected node (the default behaviour
	// from Move 02a). Once the user grabs the header and drags,
	// userPos sticks until the selection changes — they parked
	// it somewhere on purpose, the auto-positioner shouldn't
	// yank it back on the next pan/zoom.
	const [userPos, setUserPos] = useState<{ x: number; y: number } | null>(null);

	// Drop the user's manual position whenever the selection
	// flips to a different scene. The new scene's editor should
	// auto-anchor to its node, not inherit the previous card's
	// custom location.
	useEffect(() => {
		setUserPos(null);
	}, [sceneId]);

	// Drag state. `dragging` toggles the global mousemove /
	// mouseup listeners via the effect below. `dragStartRef`
	// captures the offsets at mousedown so the move handler can
	// translate cursor delta into card delta without re-reading
	// stale state on every move event.
	const [dragging, setDragging] = useState(false);
	const dragStartRef = useRef<{
		mouseX: number;
		mouseY: number;
		cardX: number;
		cardY: number;
	} | null>(null);

	// Choice-reorder drag state. `from` = index of the row the
	// author grabbed by its grip; `overIndex` = index of the row
	// the cursor is currently hovering. Set on grip mousedown,
	// updated on mousemove against each row's bounding rect,
	// committed via moveChoice() on mouseup.
	const [reorder, setReorder] = useState<
		{ from: number; overIndex: number } | null
	>(null);
	const choiceRowsRef = useRef<Map<number, HTMLDivElement | null>>(new Map());
	useEffect(() => {
		if (!reorder) return;
		const onMove = (e: MouseEvent) => {
			// Walk the rendered rows, find the one whose vertical
			// midpoint the cursor is closest to. Using midpoints
			// means small cursor twitches don't flicker the drop
			// target back and forth between adjacent rows.
			let best = reorder.from;
			let bestDist = Infinity;
			for (const [idx, el] of choiceRowsRef.current) {
				if (!el) continue;
				const rect = el.getBoundingClientRect();
				const mid = rect.top + rect.height / 2;
				const dist = Math.abs(e.clientY - mid);
				if (dist < bestDist) {
					bestDist = dist;
					best = idx;
				}
			}
			setReorder((curr) =>
				curr && curr.overIndex !== best ? { ...curr, overIndex: best } : curr
			);
		};
		const onUp = () => {
			setReorder((curr) => {
				if (curr && curr.from !== curr.overIndex) {
					onJsonChange(moveChoice(json, sceneId, curr.from, curr.overIndex));
				}
				return null;
			});
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	}, [reorder, json, sceneId, onJsonChange]);

	// Window-level mousemove / mouseup while dragging. Bound
	// only while `dragging` is true so the listeners don't
	// linger when the card isn't being moved. We clamp to the
	// viewport on every move so the user can't drag the card
	// fully off-screen.
	useEffect(() => {
		if (!dragging) return;
		const onMove = (e: MouseEvent) => {
			const start = dragStartRef.current;
			if (!start) return;
			const dx = e.clientX - start.mouseX;
			const dy = e.clientY - start.mouseY;
			const next = {
				x: Math.max(
					VIEWPORT_MARGIN,
					Math.min(
						start.cardX + dx,
						window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
					)
				),
				// Keep at least the header strip on-screen so the
				// user can always close / re-grab the card.
				y: Math.max(
					VIEWPORT_MARGIN,
					Math.min(start.cardY + dy, window.innerHeight - 48)
				)
			};
			setUserPos(next);
		};
		const onUp = () => {
			setDragging(false);
			dragStartRef.current = null;
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
		return () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		};
	}, [dragging]);

	if (!scene || !node) return null;

	const maxHeight = Math.min(620, winSize.h - 32);

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

	let left: number;
	let top: number;
	if (userPos) {
		// User dragged it somewhere — honour their pick. Clamp
		// against the window so they can't drag the entire card
		// off-screen and lose access to the close button.
		left = userPos.x;
		top = userPos.y;
	} else {
		left = flipLeft ? nodeTopLeft.x - GAP - CARD_WIDTH : nodeTopRight.x + GAP;
		top = nodeTopLeft.y;
	}

	// Clamp horizontally so the card stays on-screen if the node
	// gets dragged near the edge, OR if the user dragged the
	// card itself near the edge.
	left = Math.max(VIEWPORT_MARGIN, Math.min(left, winSize.w - CARD_WIDTH - VIEWPORT_MARGIN));
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

	const onHeaderMouseDown = (e: React.MouseEvent) => {
		// Buttons inside the header have their own handlers and
		// should not start a drag. We check the event target's
		// closest `button` ancestor; if there is one, bail.
		const targetEl = e.target as HTMLElement;
		if (targetEl.closest('button')) return;
		// Only left mouse button.
		if (e.button !== 0) return;
		e.preventDefault();
		dragStartRef.current = {
			mouseX: e.clientX,
			mouseY: e.clientY,
			cardX: left,
			cardY: top
		};
		setDragging(true);
	};

	return createPortal(
		<div style={cardStyle} role="dialog" aria-label={`edit scene ${sceneId}`}>
			{/* Header strip — also the drag handle. EDITING label,
			    path + heading, id, re-anchor (only when moved),
			    expand, close. */}
			<div
				onMouseDown={onHeaderMouseDown}
				style={{
					background: PANEL_2,
					borderBottom: `1px solid ${PANEL_BORDER}`,
					padding: '10px 14px',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'space-between',
					gap: 12,
					cursor: dragging ? 'grabbing' : 'grab',
					userSelect: 'none'
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
						<span style={{ color: PHOSPHOR }}>~/adventure</span>
						<span style={{ margin: '0 6px' }}>·</span>
						<span style={{ color: TEXT }}>{scene.heading}</span>
					</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
					<span style={{ color: DIM, fontSize: 10 }}>
						id <span style={{ color: CYAN }}>{sceneId}</span>
					</span>
					{userPos && (
						<HeaderButton
							onClick={() => setUserPos(null)}
							title="Re-anchor to the selected node"
						>
							↺
						</HeaderButton>
					)}
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
						drag ⠿ to reorder · drag the right-edge handle on the node to wire
					</span>
				</div>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{scene.choices.map((c, i) => (
						<ChoiceRow
							key={i}
							rowRef={(el) => {
								if (el) choiceRowsRef.current.set(i, el);
								else choiceRowsRef.current.delete(i);
							}}
							isDragging={reorder?.from === i}
							isDropTarget={
								reorder !== null &&
								reorder.from !== i &&
								reorder.overIndex === i
							}
							dropAbove={
								reorder !== null &&
								reorder.overIndex === i &&
								reorder.from > i
							}
							onGripMouseDown={(e) => {
								e.preventDefault();
								setReorder({ from: i, overIndex: i });
							}}
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

			{/* Footer — + choice, delete scene, ▶ play from here.
			    Delete is gated: the start scene can't be deleted
			    while it's still the start (the engine would have
			    nowhere to begin). The button stays visible but
			    dimmed so the constraint is discoverable. */}
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
				<div style={{ display: 'flex', gap: 8 }}>
					<FooterButton
						color={AMBER}
						onClick={() => onJsonChange(addChoice(json, sceneId))}
					>
						+ choice
					</FooterButton>
					<FooterButton
						color={MAGENTA}
						disabled={isStart}
						onClick={async () => {
							if (isStart) return;
							const ok = await confirm({
								title: 'Delete scene',
								message: (
									<>
										Delete scene <strong>{sceneId}</strong>? Any choices pointing
										here will be rewired to <strong>finish</strong> (null).
									</>
								),
								confirmLabel: 'Delete',
								tone: 'danger'
							});
							if (ok) {
								onJsonChange(deleteScene(json, sceneId));
								onSceneDeleted();
							}
						}}
					>
						{isStart ? '🗑 delete (set start first)' : '🗑 delete scene'}
					</FooterButton>
				</div>
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
			title={disabled ? 'Disabled in this context' : undefined}
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
 * Reordering: mousedown on the grip column (`⠿`) starts a drag
 * tracked by the parent. The parent re-emits each row with
 * `isDragging` / `isDropTarget` set so the grabbed row dims and
 * the row under the cursor shows an insertion indicator.
 *
 * Wiring: the actual drag-to-wire affordance is the per-row
 * <Handle> on the SceneNode (right edge of each row on the
 * graph, see SceneNode.tsx). Earlier versions of this card
 * carried a `→` wire button here too; it was removed because
 * having two drag sources for the same edge -- one on the
 * card, one on the node directly beside it -- was redundant
 * and made the row noisier than it needed to be.
 */
function ChoiceRow({
	rowRef,
	isDragging,
	isDropTarget,
	dropAbove,
	onGripMouseDown,
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
	rowRef: (el: HTMLDivElement | null) => void;
	isDragging: boolean;
	isDropTarget: boolean;
	/** True when the cursor is over a row above the grabbed one. */
	dropAbove: boolean;
	onGripMouseDown: (e: React.MouseEvent) => void;
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
			ref={rowRef}
			style={{
				position: 'relative',
				display: 'flex',
				alignItems: 'center',
				gap: 8,
				padding: '6px 8px',
				border: `1px solid ${
					isDropTarget ? AMBER : isDragging ? AMBER : PANEL_BORDER
				}`,
				borderRadius: 6,
				background: VOID,
				opacity: isDragging ? 0.55 : 1,
				boxShadow: isDragging ? `0 4px 12px ${AMBER}33` : 'none',
				transition: 'opacity 80ms, box-shadow 80ms, border-color 80ms'
			}}
		>
			{/* Insertion line: shows where the dragged row would
			    land if released right now. Above this row when
			    the cursor is over a row whose index is less than
			    the source's; below otherwise. */}
			{isDropTarget && (
				<div
					style={{
						position: 'absolute',
						left: 6,
						right: 6,
						top: dropAbove ? -3 : 'auto',
						bottom: dropAbove ? 'auto' : -3,
						height: 2,
						background: PHOSPHOR,
						borderRadius: 1,
						pointerEvents: 'none'
					}}
				/>
			)}
			<span
				onMouseDown={onGripMouseDown}
				style={{
					color: DIM,
					cursor: isDragging ? 'grabbing' : 'grab',
					fontSize: 11,
					userSelect: 'none',
					padding: '0 2px'
				}}
				title="drag to reorder"
			>
				⠿
			</span>
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
			{/* Points field — wrapped in a small labelled pill so
			    its meaning is obvious without taking up extra
			    vertical real estate. The "+" prefix matches the
			    "+pts" convention used everywhere else (graph
			    edge labels, ScriptView, etc.). */}
			<span
				title="points awarded for this choice"
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 2,
					background: VOID,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 4,
					padding: '0 4px',
					color: PHOSPHOR,
					fontSize: 10,
					lineHeight: 1
				}}
			>
				<span style={{ color: DIM, fontSize: 9 }}>pts</span>
				<span style={{ color: DIM }}>+</span>
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
						width: 28,
						background: 'transparent',
						border: 'none',
						color: PHOSPHOR,
						fontFamily: 'inherit',
						fontSize: 10,
						padding: '2px 0',
						outline: 'none',
						textAlign: 'center'
					}}
				/>
			</span>
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

