/**
 * Custom edge type for every choice → next-scene connection
 * (graph.ts emits `type: 'choice'` for all of them). Visually
 * a plain bezier — no label, no special routing — with a
 * phosphor "halo" overlay when the edge is selected.
 *
 * React Flow's default selection styling only changes the
 * stroke colour, which gets overridden by our custom `style`
 * prop. The halo approach gives a clear "this edge is picked"
 * affordance without fighting the playtest cyan / dim styling.
 *
 * Why a custom edge type at all (instead of the default)?
 * - We need an obvious visual response to `selected: true` so
 *   the user can see what they're about to delete.
 * - Centralising routing here keeps the default edge intact
 *   for any future use we might have for it.
 */
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { PHOSPHOR } from '../lib/theme';

export function ChoiceEdge(props: EdgeProps) {
	const {
		id,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		style,
		markerEnd,
		selected
	} = props;

	const [path] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition
	});

	return (
		<>
			{selected && (
				<path
					d={path}
					fill="none"
					stroke={PHOSPHOR}
					strokeWidth={8}
					strokeOpacity={0.28}
					// pointer-events:none so the halo doesn't
					// swallow clicks intended for nearby nodes.
					style={{ pointerEvents: 'none' }}
				/>
			)}
			<BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />
		</>
	);
}
