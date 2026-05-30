/**
 * Custom React Flow node for a scene.
 *
 * Renders the scene heading, a one-line narration preview, and
 * the list of choices with their point values. The start scene
 * gets a magenta highlight stripe so the entry point is
 * obvious in a graph.
 *
 * Clicking the node selects it (React Flow handles this for
 * us); the parent app reacts to selection by populating the
 * side panel with full details.
 */
import { memo, type ReactNode } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, MAGENTA, CYAN, TEXT, DIM } from '../lib/theme';
import type { SceneNodeData } from '../lib/graph';
import { useSceneActions } from '../lib/sceneActions';

/**
 * Wrapped in `React.memo` so React Flow's selection toggle
 * only re-renders the two nodes whose `selected` flag actually
 * flipped, rather than the whole node list. Without memo,
 * clicking any node walks the inline-style tree of every
 * SceneNode in the graph — measurable lag with 7+ nodes.
 */
function SceneNodeImpl({ data, selected }: NodeProps) {
	const d = data as SceneNodeData;
	const actions = useSceneActions();
	// Border priority: live (playtest) > selected > unreachable
	// (magenta warning) > start > default. Live wins over selected
	// because seeing where the playtest is matters more than the
	// edit cursor when both apply.
	const borderColor = d.isLive
		? CYAN
		: selected
		? AMBER
		: d.isUnreachable
		? MAGENTA
		: d.isStart
		? MAGENTA
		: PANEL_BORDER;
	// Box shadow: live gets a cyan glow + outer ring; selected
	// gets a faint amber ring; visited nodes have no shadow but
	// dim their content with opacity below.
	const boxShadow = d.isLive
		? `0 0 0 4px ${CYAN}22, 0 0 32px ${CYAN}55`
		: selected
		? `0 0 0 4px ${AMBER}22`
		: '0 2px 8px rgba(0,0,0,0.4)';
	return (
		<div
			// Tag the START node so the guided tour can find a
			// single representative scene to point at. Picking
			// the start avoids hover-on-many-nodes ambiguity and
			// matches "first thing the engine renders."
			data-tour={d.isStart ? 'scene-node' : undefined}
			style={{
				background: PANEL,
				border: `2px solid ${borderColor}`,
				borderRadius: 10,
				padding: '12px 14px',
				width: 300,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				color: TEXT,
				boxShadow,
				transition: 'border-color 120ms, box-shadow 120ms, opacity 120ms',
				position: 'relative',
				opacity: d.isVisited ? 0.62 : 1
			}}
		>
			{/* Bottom-right "play from here" badge. Hidden when
			    there's no SceneActionsProvider in the tree
			    (e.g. test fixtures). Reaches the same handler
			    the inline editor's footer button uses, so the
			    playtest can be booted at any scene without
			    opening the card. */}
			{actions && (
				<button
					onClick={(e) => {
						e.stopPropagation();
						actions.onPlayFromHere(d.sceneId);
					}}
					title="Play from this scene"
					style={{
						position: 'absolute',
						bottom: -10,
						right: 8,
						background: PANEL,
						border: `1px solid ${CYAN}`,
						borderRadius: 10,
						color: CYAN,
						fontFamily: 'inherit',
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.08em',
						padding: '2px 8px',
						lineHeight: 1,
						cursor: 'pointer',
						transition: 'background 120ms'
					}}
					onMouseEnter={(e) => (e.currentTarget.style.background = `${CYAN}22`)}
					onMouseLeave={(e) => (e.currentTarget.style.background = PANEL)}
				>
					▶ PLAY
				</button>
			)}

			{/* Top-left scene-id badge. Mirrors the right-side
			    cluster's geometry so they read as a matched
			    pair: identity on the left, status on the right.
			    Cyan to match the editor surfaces (EdgeEditor /
			    ScriptView both colour the id with CYAN). */}
			<div
				style={{
					position: 'absolute',
					top: -10,
					left: 8,
					display: 'flex',
					gap: 4,
					pointerEvents: 'none',
					maxWidth: 'calc(100% - 16px)'
				}}
			>
				<Badge color={CYAN} title={`Scene id: ${d.sceneId}`}>
					<span
						style={{
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap',
							maxWidth: 180,
							display: 'inline-block',
							verticalAlign: 'bottom'
						}}
					>
						{d.sceneId}
					</span>
				</Badge>
			</div>

			{/* Top-right validation badges. Stacked horizontally
			    so a node with multiple issues shows all of them. */}
			{(d.isUnreachable ||
				d.isDeadEnd ||
				d.hasMissingTarget ||
				d.inDegree > 0 ||
				d.itemCount > 0) && (
				<div
					style={{
						position: 'absolute',
						top: -10,
						right: 8,
						display: 'flex',
						gap: 4,
						pointerEvents: 'none'
					}}
				>
					{d.itemCount > 0 && (
						<Badge
							color={PHOSPHOR}
							title={`${d.itemCount} item(s) start in this scene`}
						>
							◆ {d.itemCount}
						</Badge>
					)}
					{d.inDegree > 0 && (
						<Badge color={DIM} title={`${d.inDegree} choice(s) point here`}>
							← {d.inDegree}
						</Badge>
					)}
					{d.isUnreachable && (
						<Badge color={MAGENTA} title="No path from start reaches this scene">
							UNREACHABLE
						</Badge>
					)}
					{d.isDeadEnd && (
						<Badge color={MAGENTA} title="No path from here reaches an ending">
							DEAD END
						</Badge>
					)}
					{d.hasMissingTarget && (
						<Badge color={MAGENTA} title="A choice points at a scene that doesn't exist">
							MISSING TARGET
						</Badge>
					)}
				</div>
			)}

			{/* Target handle position follows the flow direction:
			    Left edge when horizontal (so wires enter the card
			    from the previous layer to the left), Top when
			    vertical (legacy layout). Per-choice source
			    handles stay on the Right edge of each row in both
			    modes -- they're the drag-to-wire affordance and
			    that placement is what makes per-row addressing
			    visible. */}
			<Handle
				type="target"
				position={d.flowDirection === 'vertical' ? Position.Top : Position.Left}
				style={{ background: AMBER }}
			/>

			{/* Top-of-card status tag — live > visited > start.
			    Only one is shown at a time; live wins because the
			    playtest cursor is the most relevant signal. */}
			{d.isLive ? (
				<div
					style={{
						display: 'inline-block',
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.1em',
						color: CYAN,
						marginBottom: 4
					}}
				>
					▶ YOU ARE HERE
				</div>
			) : d.isVisited ? (
				<div
					style={{
						display: 'inline-block',
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.1em',
						color: CYAN,
						marginBottom: 4
					}}
				>
					✓ VISITED
				</div>
			) : d.isStart ? (
				<div
					style={{
						display: 'inline-block',
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.1em',
						color: MAGENTA,
						marginBottom: 4
					}}
				>
					▶ START
				</div>
			) : null}

			<div
				style={{
					color: PHOSPHOR,
					fontWeight: 700,
					fontSize: 13,
					marginBottom: 8,
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap'
				}}
				title={d.heading}
			>
				{d.heading}
			</div>

			{d.narration[0] && (
				<div
					style={{
						color: DIM,
						fontSize: 10,
						marginBottom: 10,
						lineHeight: 1.4,
						display: '-webkit-box',
						WebkitLineClamp: 2,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden'
					}}
				>
					{d.narration[0]}
				</div>
			)}

			<div
				style={{
					height: 1,
					background: PANEL_BORDER,
					margin: '0 -14px 8px'
				}}
			/>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
				{d.choices.map((c, i) => (
					<div
						key={i}
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							fontSize: 10,
							lineHeight: 1.3,
							position: 'relative',
							paddingRight: 8
						}}
					>
						<span
							style={{
								color: AMBER,
								flex: 1,
								overflow: 'hidden',
								textOverflow: 'ellipsis',
								whiteSpace: 'nowrap',
								marginRight: 6
							}}
							title={c.label}
						>
							{i + 1}) {c.label}
						</span>
						{c.points !== undefined && (
							<span
								style={{ color: PHOSPHOR, fontWeight: 700, marginRight: 12 }}
							>
								+{c.points}
							</span>
						)}
						{/* Per-choice source handle. Position.Right +
						    an absolute top:50% pins it to the row's
						    vertical centre on the right edge of the
						    node. The handle id `c-${i}` is parsed by
						    onConnect / onConnectEnd in App.tsx and
						    must match the sourceHandle set in
						    graph.ts. */}
						<Handle
							type="source"
							id={`c-${i}`}
							position={Position.Right}
							style={{
								background: AMBER,
								width: 8,
								height: 8,
								border: `2px solid ${PANEL}`,
								right: -18
							}}
						/>
					</div>
				))}
			</div>
		</div>
	);
}

export const SceneNode = memo(SceneNodeImpl);

/**
 * Pill-style indicator shown above the node. Used for in-degree,
 * unreachable, dead-end, and missing-target flags. Border colour
 * carries the semantic — magenta for problems, dim for purely
 * informational counts.
 */
function Badge({
	color,
	title,
	children
}: {
	color: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<span
			title={title}
			style={{
				background: PANEL,
				border: `1px solid ${color}`,
				color,
				fontSize: 8,
				fontWeight: 700,
				letterSpacing: '0.08em',
				padding: '2px 6px',
				borderRadius: 10,
				lineHeight: 1
			}}
		>
			{children}
		</span>
	);
}
