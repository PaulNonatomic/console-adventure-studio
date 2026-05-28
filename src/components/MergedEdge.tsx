/**
 * Custom edge renderer for merged choices (`type: 'merged'` in
 * `lib/graph.ts`).
 *
 * When multiple choices from the same scene point at the same
 * target, `graph.ts` emits a single edge instead of N parallel
 * lines. The default bezier rendering would then attach to just
 * one row's handle and the merge would be invisible — looking
 * the same as a solo edge.
 *
 * This renderer instead draws:
 *   - One "spoke" curve from EACH source row handle into a
 *     midpoint hub. Visualises which rows are contributing.
 *   - A small circle at the hub so the merge is unmistakable.
 *   - A single bezier from the hub to the target, with the
 *     arrowhead at the target end. The combined label sits on
 *     this segment.
 *
 * Source handle positions are read from
 * `useInternalNode(source).internals.handleBounds.source`,
 * which gives us per-handle (x, y, width, height) relative to
 * the node's origin. Adding `positionAbsolute` puts each in
 * flow-space, which is the same coordinate system the edge
 * SVG paths are drawn in.
 */
import {
	BaseEdge,
	getBezierPath,
	useInternalNode,
	Position,
	type EdgeProps
} from '@xyflow/react';

interface MergedEdgeData extends Record<string, unknown> {
	/**
	 * Every source handle id (`c-${i}`) participating in this
	 * merged edge. The first one is also set as the edge's
	 * `sourceHandle`, but we draw spokes from ALL of them.
	 */
	sourceHandleIds: string[];
}

/** Radius of the small dot rendered at the hub. */
const HUB_RADIUS = 4;
/**
 * Fraction of the way from source to target where the hub
 * lands. 0.32 reads as "clearly closer to the source" without
 * crowding the spokes against the node edge.
 */
const HUB_T = 0.32;
/**
 * Minimum horizontal distance from the source rows to the hub
 * regardless of target distance, so the spokes always have
 * room to fan out visibly even if the target is very close.
 */
const MIN_HUB_OFFSET = 56;

export function MergedEdge(props: EdgeProps) {
	const {
		id,
		source,
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
		label,
		labelStyle,
		labelBgStyle,
		labelBgPadding,
		labelBgBorderRadius,
		style,
		markerEnd
	} = props;

	const sourceNode = useInternalNode(source);
	const data = props.data as MergedEdgeData | undefined;
	const sourceHandleIds = data?.sourceHandleIds;

	// Fallback — if for any reason we don't have multi-handle
	// data or the node hasn't laid out yet, render a vanilla
	// bezier edge so the graph still connects. Avoids a flash
	// of invisible edge on first mount.
	const fallback = () => {
		const [path, lx, ly] = getBezierPath({
			sourceX,
			sourceY,
			sourcePosition,
			targetX,
			targetY,
			targetPosition
		});
		return (
			<BaseEdge
				id={id}
				path={path}
				labelX={lx}
				labelY={ly}
				label={label}
				labelStyle={labelStyle}
				labelBgStyle={labelBgStyle}
				labelBgPadding={labelBgPadding}
				labelBgBorderRadius={labelBgBorderRadius}
				style={style}
				markerEnd={markerEnd}
			/>
		);
	};

	if (!sourceNode || !sourceHandleIds || sourceHandleIds.length < 2) {
		return fallback();
	}

	const handleBounds = sourceNode.internals.handleBounds?.source ?? [];
	const sourcePts = sourceHandleIds
		.map((hid) => {
			const h = handleBounds.find((hb) => hb.id === hid);
			if (!h) return null;
			return {
				x: sourceNode.internals.positionAbsolute.x + h.x + h.width / 2,
				y: sourceNode.internals.positionAbsolute.y + h.y + h.height / 2
			};
		})
		.filter((p): p is { x: number; y: number } => p !== null);

	if (sourcePts.length < 2) return fallback();

	// Average source position — the spokes converge toward the
	// midpoint, so basing it on the average keeps the fan
	// symmetric whether the participating rows are adjacent or
	// far apart.
	const avgSourceX = sourcePts.reduce((s, p) => s + p.x, 0) / sourcePts.length;
	const avgSourceY = sourcePts.reduce((s, p) => s + p.y, 0) / sourcePts.length;

	const dx = targetX - avgSourceX;
	const dy = targetY - avgSourceY;
	const dist = Math.hypot(dx, dy) || 1;

	// Place the hub HUB_T of the way from source toward target,
	// but never closer to the source than MIN_HUB_OFFSET.
	const t = Math.max(HUB_T, MIN_HUB_OFFSET / dist);
	const hubX = avgSourceX + dx * t;
	const hubY = avgSourceY + dy * t;

	// Spokes — one bezier per source handle, easing into the
	// hub from the right. Each spoke's control point sits at
	// (mid-x of the spoke, source-y), giving a smooth S-curve
	// rather than a hard angle.
	const spokesPath = sourcePts
		.map((p) => {
			const cx = p.x + (hubX - p.x) * 0.55;
			return `M ${p.x},${p.y} C ${cx},${p.y} ${cx},${hubY} ${hubX},${hubY}`;
		})
		.join(' ');

	// Main run from hub to target — bezier, gets the arrow + label.
	const [mainPath, labelX, labelY] = getBezierPath({
		sourceX: hubX,
		sourceY: hubY,
		sourcePosition: Position.Right,
		targetX,
		targetY,
		targetPosition
	});

	const strokeColor =
		(style as { stroke?: string } | undefined)?.stroke ?? 'currentColor';

	return (
		<>
			{/* Spokes — same stroke as the main edge, slightly
			    thinner so they read as feeders rather than
			    parallel edges in their own right. No arrowhead. */}
			<path
				d={spokesPath}
				fill="none"
				stroke={strokeColor}
				strokeWidth={
					((style as { strokeWidth?: number } | undefined)?.strokeWidth ?? 1.5) * 0.85
				}
				strokeDasharray={
					(style as { strokeDasharray?: string } | undefined)?.strokeDasharray
				}
				strokeOpacity={0.9}
			/>

			{/* Hub dot — visually anchors the merge. Filled with
			    the canvas VOID would hide it; using the stroke
			    colour gives a clean junction marker. */}
			<circle
				cx={hubX}
				cy={hubY}
				r={HUB_RADIUS}
				fill={strokeColor}
				stroke={strokeColor}
			/>

			{/* Main run hub → target, with arrow + label. */}
			<BaseEdge
				id={id}
				path={mainPath}
				labelX={labelX}
				labelY={labelY}
				label={label}
				labelStyle={labelStyle}
				labelBgStyle={labelBgStyle}
				labelBgPadding={labelBgPadding}
				labelBgBorderRadius={labelBgBorderRadius}
				style={style}
				markerEnd={markerEnd}
			/>
		</>
	);
}
