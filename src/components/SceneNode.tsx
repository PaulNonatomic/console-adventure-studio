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
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, MAGENTA, TEXT, DIM } from '../lib/theme';
import type { SceneNodeData } from '../lib/graph';

/**
 * Wrapped in `React.memo` so React Flow's selection toggle
 * only re-renders the two nodes whose `selected` flag actually
 * flipped, rather than the whole node list. Without memo,
 * clicking any node walks the inline-style tree of every
 * SceneNode in the graph — measurable lag with 7+ nodes.
 */
function SceneNodeImpl({ data, selected }: NodeProps) {
	const d = data as SceneNodeData;
	return (
		<div
			style={{
				background: PANEL,
				border: `2px solid ${selected ? AMBER : d.isStart ? MAGENTA : PANEL_BORDER}`,
				borderRadius: 10,
				padding: '12px 14px',
				width: 300,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				color: TEXT,
				boxShadow: selected
					? `0 0 0 4px ${AMBER}22`
					: '0 2px 8px rgba(0,0,0,0.4)',
				transition: 'border-color 120ms, box-shadow 120ms'
			}}
		>
			{/* Inbound handle on top, outbound on bottom — matches the
			    layered top-down auto-layout. */}
			<Handle type="target" position={Position.Top} style={{ background: AMBER }} />

			{d.isStart && (
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
			)}

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

			<div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
				{d.choices.map((c, i) => (
					<div
						key={i}
						style={{
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'baseline',
							fontSize: 10,
							lineHeight: 1.3
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
							<span style={{ color: PHOSPHOR, fontWeight: 700 }}>
								+{c.points}
							</span>
						)}
					</div>
				))}
			</div>

			<Handle type="source" position={Position.Bottom} style={{ background: AMBER }} />
		</div>
	);
}

export const SceneNode = memo(SceneNodeImpl);
