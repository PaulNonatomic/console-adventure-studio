/**
 * Writing-first view (Move 04). Presents the same `AdventureJson`
 * as an editable script document — narration as real prose lines,
 * choices as a list. The graph is demoted to a small minimap in
 * the left rail; the canvas itself isn't rendered.
 *
 * Implementation notes:
 *   - Every mutation goes through `lib/edit.ts` — same helpers as
 *     the inline editor + side panel. ScriptView is a different
 *     *presentation* of the same json, not a new data path.
 *   - Narration is edited as a single textarea per scene, lines
 *     split on `\n` exactly like `SceneEditor` does. This is the
 *     "boring and robust" path the design handoff recommends
 *     over contentEditable — zero caret bugs and one source of
 *     truth.
 *   - The minimap is a hand-rolled SVG. We can't reuse React
 *     Flow's <MiniMap> because it requires the live React Flow
 *     instance which is only mounted in `graph` / `split` modes
 *     — in `write` mode there's no instance.
 *   - Scene blocks have refs so the outline / minimap can scroll
 *     a clicked scene into view AND select it.
 */
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	type CSSProperties
} from 'react';
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
	addScene
} from '../lib/edit';
import { layoutGraph } from '../lib/layout';
import { buildGraph, FINISH_NODE_ID } from '../lib/graph';
import type { FlowDirection } from '../lib/flowDirection';

interface Props {
	json: AdventureJson;
	maxScore: number;
	selectedSceneId: string | null;
	/**
	 * Match the canvas's current flow direction so the minimap
	 * thumbnail shows the same orientation the author sees on
	 * the graph view.
	 */
	flowDirection: FlowDirection;
	onJsonChange: (next: AdventureJson, opts?: { remount?: boolean }) => void;
	onSelectScene: (id: string | null) => void;
	onPlayFromHere: (sceneId: string) => void;
}

const COLUMN_MAX = 720;
const RAIL_WIDTH = 248;

const railSectionLabel: CSSProperties = {
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.12em',
	color: DIM,
	padding: '14px 14px 6px'
};

export function ScriptView({
	json,
	maxScore,
	selectedSceneId,
	flowDirection,
	onJsonChange,
	onSelectScene,
	onPlayFromHere
}: Props) {
	const sceneIds = useMemo(() => Object.keys(json.scenes).sort(), [json.scenes]);
	// Refs keyed by scene id so outline/minimap clicks can scroll
	// the matching scene block into view. WeakMap won't work
	// because keys are strings; we just rebuild on each render
	// and let GC handle stale entries.
	const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

	const scrollToScene = useCallback(
		(sceneId: string) => {
			const el = blockRefs.current[sceneId];
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
			onSelectScene(sceneId);
		},
		[onSelectScene]
	);

	// When the parent flips `selectedSceneId` (e.g. clicking a
	// node in split-mode's graph half), make sure the
	// corresponding script block scrolls into view here too.
	useEffect(() => {
		if (selectedSceneId && blockRefs.current[selectedSceneId]) {
			blockRefs.current[selectedSceneId]?.scrollIntoView({
				behavior: 'smooth',
				block: 'start'
			});
		}
	}, [selectedSceneId]);

	const totalChoices = useMemo(
		() => Object.values(json.scenes).reduce((n, s) => n + s.choices.length, 0),
		[json.scenes]
	);

	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				minHeight: 0,
				background: VOID,
				color: TEXT,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			{/* Inline keyframes for the selected-scene blinking
			    cursor. Idempotent — browsers dedupe identical
			    style nodes, and we only render one per mount of
			    this view. */}
			<style>{`@keyframes cas-cursor-blink { 0%, 50% { opacity: 1 } 51%, 100% { opacity: 0 } }`}</style>
			{/* Left rail — outline list + minimap. */}
			<aside
				style={{
					width: RAIL_WIDTH,
					flexShrink: 0,
					background: PANEL,
					borderRight: `1px solid ${PANEL_BORDER}`,
					overflow: 'auto',
					fontSize: 11
				}}
			>
				<div style={railSectionLabel}>OUTLINE</div>
				<div style={{ paddingBottom: 6 }}>
					{sceneIds.map((id) => (
						<OutlineRow
							key={id}
							sceneId={id}
							heading={json.scenes[id].heading}
							isStart={json.start === id}
							isEnd={json.scenes[id].choices.every((c) => c.next === null)}
							isSelected={selectedSceneId === id}
							onClick={() => scrollToScene(id)}
						/>
					))}
					<button
						onClick={() => {
							const { json: nextJson, id } = addScene(json);
							onJsonChange(nextJson, { remount: true });
							// Defer the scroll so the new block has mounted.
							queueMicrotask(() => scrollToScene(id));
						}}
						style={{
							background: 'transparent',
							border: 'none',
							color: AMBER,
							padding: '6px 14px',
							fontFamily: 'inherit',
							fontSize: 11,
							cursor: 'pointer',
							width: '100%',
							textAlign: 'left'
						}}
						onMouseEnter={(e) => (e.currentTarget.style.color = PHOSPHOR)}
						onMouseLeave={(e) => (e.currentTarget.style.color = AMBER)}
					>
						+ add scene
					</button>
				</div>

				<div style={railSectionLabel}>MAP</div>
				<MiniMap
					json={json}
					flowDirection={flowDirection}
					selectedSceneId={selectedSceneId}
					onSelectScene={scrollToScene}
				/>
			</aside>

			{/* Centred script column. The wrapper is a vertical
			    scroll container; the inner column is centred via
			    margin auto + max-width so prose stays readable
			    regardless of total viewport width. */}
			<div style={{ flex: 1, overflow: 'auto', padding: '32px 24px 64px' }}>
				<div style={{ margin: '0 auto', maxWidth: COLUMN_MAX }}>
					<DocumentHeader
						scenes={sceneIds.length}
						choices={totalChoices}
						maxScore={maxScore}
						startId={json.start}
					/>

					{sceneIds.map((id) => (
						<div
							key={id}
							ref={(el) => {
								blockRefs.current[id] = el;
							}}
							style={{
								scrollMarginTop: 24
							}}
						>
							<SceneBlock
								json={json}
								sceneId={id}
								sceneIds={sceneIds}
								isSelected={selectedSceneId === id}
								onJsonChange={onJsonChange}
								onSelect={() => onSelectScene(id)}
								onPlayFromHere={() => onPlayFromHere(id)}
							/>
						</div>
					))}

					{sceneIds.length === 0 && (
						<div style={{ color: DIM, fontSize: 12, padding: '40px 0' }}>
							No scenes yet. Add one from the outline rail on the left.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

/* ─── outline rail ─────────────────────────────────────── */

function OutlineRow({
	sceneId,
	heading,
	isStart,
	isEnd,
	isSelected,
	onClick
}: {
	sceneId: string;
	heading: string;
	isStart: boolean;
	isEnd: boolean;
	isSelected: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				gap: 6,
				width: '100%',
				background: isSelected ? `${PHOSPHOR}14` : 'transparent',
				borderLeft: `3px solid ${isSelected ? PHOSPHOR : 'transparent'}`,
				border: 'none',
				borderLeftWidth: 3,
				borderLeftStyle: 'solid',
				borderLeftColor: isSelected ? PHOSPHOR : 'transparent',
				color: isSelected ? PHOSPHOR : TEXT,
				padding: '5px 14px 5px 11px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: 'pointer',
				textAlign: 'left',
				transition: 'background 120ms, color 120ms'
			}}
			onMouseEnter={(e) => {
				if (!isSelected) e.currentTarget.style.background = `${AMBER}11`;
			}}
			onMouseLeave={(e) => {
				if (!isSelected) e.currentTarget.style.background = 'transparent';
			}}
			title={`scene id: ${sceneId}`}
		>
			<span
				style={{
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					whiteSpace: 'nowrap',
					flex: 1
				}}
			>
				{heading || sceneId}
			</span>
			{isStart && (
				<span
					style={{
						color: MAGENTA,
						fontSize: 8,
						fontWeight: 700,
						letterSpacing: '0.1em'
					}}
				>
					start
				</span>
			)}
			{!isStart && isEnd && (
				<span style={{ color: DIM, fontSize: 8, fontWeight: 700, letterSpacing: '0.1em' }}>
					end
				</span>
			)}
		</button>
	);
}

/* ─── minimap ──────────────────────────────────────────── */

/**
 * Hand-rolled SVG minimap. Re-uses `buildGraph` + `layoutGraph`
 * to get the same positions as the main React Flow canvas, then
 * normalises them into a fixed SVG viewport. Each node is a
 * small rounded rect; edges are straight lines (no curves — the
 * minimap is for navigation, not aesthetics). Clicking a node
 * scrolls + selects it.
 */
function MiniMap({
	json,
	flowDirection,
	selectedSceneId,
	onSelectScene
}: {
	json: AdventureJson;
	flowDirection: FlowDirection;
	selectedSceneId: string | null;
	onSelectScene: (id: string) => void;
}) {
	const layout = useMemo(() => {
		const built = buildGraph(json, 0, undefined, flowDirection);
		const positioned = layoutGraph(built.nodes, built.edges, json.start, flowDirection);
		return { nodes: positioned, edges: built.edges };
	}, [json, flowDirection]);

	// Compute bounds so we can normalise into a 200x200 viewport.
	const bounds = useMemo(() => {
		if (layout.nodes.length === 0)
			return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
		let minX = Infinity,
			minY = Infinity,
			maxX = -Infinity,
			maxY = -Infinity;
		for (const n of layout.nodes) {
			minX = Math.min(minX, n.position.x);
			minY = Math.min(minY, n.position.y);
			maxX = Math.max(maxX, n.position.x + 300); // scene-node width
			maxY = Math.max(maxY, n.position.y + 120); // approx height
		}
		return { minX, minY, maxX, maxY };
	}, [layout.nodes]);

	const W = 220;
	const H = 180;
	const PAD = 10;
	const dx = bounds.maxX - bounds.minX || 1;
	const dy = bounds.maxY - bounds.minY || 1;
	const scale = Math.min((W - 2 * PAD) / dx, (H - 2 * PAD) / dy);
	const offsetX = PAD - bounds.minX * scale;
	const offsetY = PAD - bounds.minY * scale;

	const project = (x: number, y: number) => ({
		x: x * scale + offsetX,
		y: y * scale + offsetY
	});

	const NODE_W = 300 * scale;
	const NODE_H = 80 * scale;

	const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));

	return (
		<div
			style={{
				margin: '0 14px 14px',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 6,
				background: VOID,
				padding: 8
			}}
		>
			<svg
				viewBox={`0 0 ${W} ${H}`}
				style={{ display: 'block', width: '100%', height: 'auto' }}
				role="img"
				aria-label="Adventure map thumbnail"
			>
				{/* Edges first so nodes layer on top. */}
				{layout.edges.map((e) => {
					const source = nodeById.get(e.source);
					const target = nodeById.get(e.target);
					if (!source || !target) return null;
					const s = project(source.position.x + 150, source.position.y + 40);
					const t = project(target.position.x + 150, target.position.y + 40);
					return (
						<line
							key={e.id}
							x1={s.x}
							y1={s.y}
							x2={t.x}
							y2={t.y}
							stroke={PANEL_BORDER}
							strokeWidth={0.8}
						/>
					);
				})}
				{layout.nodes.map((n) => {
					const isFinish = n.id === FINISH_NODE_ID;
					const isStart = n.id === json.start;
					const isSel = selectedSceneId === n.id;
					const fill = isSel
						? PHOSPHOR
						: isStart
						? MAGENTA
						: isFinish
						? `${MAGENTA}aa`
						: AMBER;
					const p = project(n.position.x, n.position.y);
					return (
						<rect
							key={n.id}
							x={p.x}
							y={p.y}
							width={Math.max(NODE_W, 6)}
							height={Math.max(NODE_H, 4)}
							rx={2}
							fill={fill}
							opacity={isSel ? 1 : 0.85}
							style={{ cursor: isFinish ? 'default' : 'pointer' }}
							onClick={() => {
								if (!isFinish) onSelectScene(n.id);
							}}
						>
							<title>{isFinish ? 'finish' : n.id}</title>
						</rect>
					);
				})}
			</svg>
			<div
				style={{
					color: DIM,
					fontSize: 9,
					marginTop: 4,
					textAlign: 'center'
				}}
			>
				tap a node to jump
			</div>
		</div>
	);
}

/* ─── document header ──────────────────────────────────── */

function DocumentHeader({
	scenes,
	choices,
	maxScore,
	startId
}: {
	scenes: number;
	choices: number;
	maxScore: number;
	startId: string;
}) {
	return (
		<div style={{ marginBottom: 36 }}>
			<div
				style={{
					color: PHOSPHOR,
					fontSize: 22,
					fontWeight: 700,
					letterSpacing: '-0.01em',
					marginBottom: 6
				}}
			>
				~/adventure
			</div>
			<div style={{ color: DIM, fontSize: 12, lineHeight: 1.6 }}>
				{scenes} scenes · {choices} choices · max {maxScore} pts · start
				<span style={{ color: PHOSPHOR, marginLeft: 6 }}>{startId}</span>
			</div>
			<div
				style={{
					height: 1,
					background: PANEL_BORDER,
					marginTop: 18
				}}
			/>
		</div>
	);
}

/* ─── scene block ──────────────────────────────────────── */

function SceneBlock({
	json,
	sceneId,
	sceneIds,
	isSelected,
	onJsonChange,
	onSelect,
	onPlayFromHere
}: {
	json: AdventureJson;
	sceneId: string;
	sceneIds: string[];
	isSelected: boolean;
	onJsonChange: (next: AdventureJson) => void;
	onSelect: () => void;
	onPlayFromHere: () => void;
}) {
	const scene = json.scenes[sceneId];
	if (!scene) return null;
	const isStart = json.start === sceneId;

	return (
		<div
			onClick={onSelect}
			style={{
				borderLeft: `2px solid ${isSelected ? PHOSPHOR : 'transparent'}`,
				paddingLeft: 14,
				marginLeft: -16,
				marginBottom: 32,
				transition: 'border-color 120ms'
			}}
		>
			{/* Heading line: path + heading text + id + play-from-here */}
			<div
				style={{
					display: 'flex',
					alignItems: 'baseline',
					gap: 10,
					marginBottom: 10,
					flexWrap: 'wrap'
				}}
			>
				<span style={{ color: PHOSPHOR, fontSize: 12 }}>~/adventure</span>
				<span style={{ color: DIM, fontSize: 12 }}>·</span>
				<EditableHeading
					value={scene.heading}
					onChange={(heading) =>
						onJsonChange(updateScene(json, sceneId, { heading }))
					}
				/>
				<span
					style={{
						color: isStart ? MAGENTA : DIM,
						fontSize: 10,
						marginLeft: 4
					}}
				>
					id: <span style={{ color: isStart ? MAGENTA : TEXT }}>{sceneId}</span>
					{isStart && (
						<span
							style={{
								color: MAGENTA,
								fontWeight: 700,
								letterSpacing: '0.1em',
								marginLeft: 8,
								fontSize: 9
							}}
						>
							· START
						</span>
					)}
				</span>
				<button
					onClick={(e) => {
						e.stopPropagation();
						onPlayFromHere();
					}}
					style={{
						marginLeft: 'auto',
						background: 'transparent',
						border: 'none',
						color: CYAN,
						fontFamily: 'inherit',
						fontSize: 11,
						cursor: 'pointer',
						padding: '2px 4px'
					}}
					title="Boot the playtest at this scene"
				>
					▶ play from here
				</button>
			</div>

			{/* Narration — auto-sizing textarea styled as prose.
			    Lines split on \n become the narration array. The
			    selected scene gets a blinking lime cursor just
			    after the textarea so the active edit slot is
			    obvious at a glance even when the textarea isn't
			    focused. Pure CSS — keyframes injected once at
			    the top of the view. */}
			<NarrationEditor
				value={scene.narration.join('\n')}
				onChange={(text) =>
					onJsonChange(updateScene(json, sceneId, { narration: text.split('\n') }))
				}
			/>
			{isSelected && (
				<span
					aria-hidden="true"
					style={{
						display: 'inline-block',
						color: PHOSPHOR,
						fontSize: 14,
						lineHeight: 1,
						marginLeft: 2,
						transform: 'translateY(2px)',
						animation: 'cas-cursor-blink 1s steps(1, end) infinite'
					}}
				>
					▌
				</span>
			)}

			{/* Choices */}
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					gap: 4,
					marginTop: 14
				}}
			>
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
				<button
					onClick={(e) => {
						e.stopPropagation();
						onJsonChange(addChoice(json, sceneId));
					}}
					style={{
						alignSelf: 'flex-start',
						background: 'transparent',
						border: 'none',
						color: DIM,
						fontFamily: 'inherit',
						fontSize: 11,
						cursor: 'pointer',
						padding: '4px 8px 4px 36px'
					}}
					onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
					onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
				>
					+ add choice
				</button>
			</div>
		</div>
	);
}

/* ─── editable heading ─────────────────────────────────── */

function EditableHeading({
	value,
	onChange
}: {
	value: string;
	onChange: (next: string) => void;
}) {
	return (
		<input
			type="text"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onClick={(e) => e.stopPropagation()}
			style={{
				background: 'transparent',
				border: 'none',
				borderBottom: `1px dashed transparent`,
				color: TEXT,
				fontFamily: 'inherit',
				fontSize: 13,
				fontWeight: 600,
				padding: '2px 4px',
				outline: 'none',
				minWidth: 120,
				flex: '0 1 auto',
				transition: 'border-color 120ms'
			}}
			onFocus={(e) => (e.target.style.borderBottomColor = AMBER)}
			onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
		/>
	);
}

/* ─── narration editor ─────────────────────────────────── */

/**
 * Auto-sizing textarea styled as prose. Grows to fit content
 * via scrollHeight on every input — the spec's recommended
 * fallback over contentEditable (no caret bugs, behaves like
 * `SceneEditor`'s convention). Reads as a paragraph of body
 * text rather than a form field, with a soft amber underline
 * appearing only when focused.
 */
function NarrationEditor({
	value,
	onChange
}: {
	value: string;
	onChange: (next: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement | null>(null);

	const autoSize = useCallback(() => {
		const el = ref.current;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${el.scrollHeight}px`;
	}, []);

	useEffect(() => {
		autoSize();
	}, [value, autoSize]);

	return (
		<textarea
			ref={ref}
			value={value}
			onClick={(e) => e.stopPropagation()}
			onChange={(e) => {
				onChange(e.target.value);
				autoSize();
			}}
			rows={1}
			style={{
				width: '100%',
				background: 'transparent',
				border: 'none',
				color: TEXT,
				fontFamily: 'inherit',
				fontSize: 13,
				lineHeight: 1.7,
				padding: '2px 0',
				outline: 'none',
				resize: 'none',
				overflow: 'hidden',
				transition: 'background 120ms'
			}}
			onFocus={(e) => (e.target.style.background = `${AMBER}08`)}
			onBlur={(e) => (e.target.style.background = 'transparent')}
		/>
	);
}

/* ─── choice row ───────────────────────────────────────── */

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
			onClick={(e) => e.stopPropagation()}
			style={{
				display: 'flex',
				alignItems: 'center',
				gap: 10,
				padding: '4px 8px',
				fontSize: 12
			}}
		>
			<span style={{ color: AMBER, fontWeight: 700, minWidth: 24 }}>
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
					fontSize: 12,
					padding: '4px 6px',
					outline: 'none',
					borderRadius: 4,
					transition: 'background 120ms'
				}}
				onFocus={(e) => (e.target.style.background = `${AMBER}11`)}
				onBlur={(e) => (e.target.style.background = 'transparent')}
			/>
			<PointsPill
				value={points}
				onChange={(p) =>
					onJsonChange(updateChoice(json, sceneId, choiceIndex, { points: p }))
				}
			/>
			<span style={{ color: DIM, fontSize: 12 }}>→</span>
			<NextChip
				value={next}
				sceneIds={sceneIds}
				onChange={(n) =>
					onJsonChange(updateChoice(json, sceneId, choiceIndex, { next: n }))
				}
			/>
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
					padding: '0 4px'
				}}
				onMouseEnter={(e) => (e.currentTarget.style.color = MAGENTA)}
				onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
			>
				×
			</button>
		</div>
	);
}

function PointsPill({
	value,
	onChange
}: {
	value: number;
	onChange: (n: number) => void;
}) {
	return (
		<span
			style={{
				display: 'inline-flex',
				alignItems: 'center',
				border: `1px solid ${PHOSPHOR}55`,
				borderRadius: 10,
				padding: '0 4px',
				color: PHOSPHOR,
				fontSize: 11
			}}
		>
			+
			<input
				type="number"
				value={value}
				onChange={(e) => onChange(Number(e.target.value) || 0)}
				style={{
					width: 28,
					background: 'transparent',
					border: 'none',
					color: PHOSPHOR,
					fontFamily: 'inherit',
					fontSize: 11,
					padding: '1px 2px',
					outline: 'none',
					textAlign: 'center'
				}}
				title="points"
			/>
		</span>
	);
}

/**
 * NEXT scene chip. Renders as a coloured pill (amber for a real
 * scene, magenta for `finish`/null). Click to open a native
 * select to pick another target — matches the mock's
 * "small scene picker reusing SceneEditor's options builder".
 */
function NextChip({
	value,
	sceneIds,
	onChange
}: {
	value: string | null;
	sceneIds: string[];
	onChange: (next: string | null) => void;
}) {
	const isFinish = value === null;
	return (
		<span style={{ position: 'relative' }}>
			<select
				value={value ?? '__null__'}
				onChange={(e) => {
					const v = e.target.value === '__null__' ? null : e.target.value;
					onChange(v);
				}}
				style={{
					background: isFinish ? `${MAGENTA}22` : `${AMBER}22`,
					border: `1px solid ${isFinish ? MAGENTA : AMBER}`,
					borderRadius: 10,
					color: isFinish ? MAGENTA : AMBER,
					fontFamily: 'inherit',
					fontSize: 11,
					padding: '2px 8px',
					outline: 'none',
					cursor: 'pointer',
					maxWidth: 140
				}}
			>
				<option value="__null__">finish</option>
				{sceneIds.map((id) => (
					<option key={id} value={id}>
						{id}
					</option>
				))}
			</select>
		</span>
	);
}

