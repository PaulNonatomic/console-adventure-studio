/**
 * Floating editor for a single connection (choice) on the
 * graph. Opens when an edge is selected; positions itself
 * roughly at the edge's midpoint in screen coords so it sits on
 * the wire the author just clicked.
 *
 * The wire IS the choice -- one edge = one choice on the source
 * scene -- so editing the connection means editing that choice.
 * This panel exposes the same fields the inline editor's row
 * does, PLUS the reaction (engine: `flavour`) textarea that
 * lives nowhere else on the graph surface.
 *
 * Why a separate editor instead of expanding the inline
 * editor's row? Because reaction text can be long enough to
 * want a proper textarea, and the inline editor's compact row
 * layout is its main feature -- bloating each row with a
 * collapsible textarea would lose that.
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
	MAGENTA,
	DIM,
	TEXT,
	PANEL,
	PANEL_BORDER,
	VOID
} from '../lib/theme';
import { updateChoice } from '../lib/edit';

interface Props {
	json: AdventureJson;
	sceneId: string;
	choiceIndex: number;
	onJsonChange: (next: AdventureJson) => void;
	onClose: () => void;
}

const CARD_WIDTH = 420;
const NODE_WIDTH = 300;
const VIEWPORT_MARGIN = 16;
const PANEL_2 = '#1a1a24';

export function EdgeEditor({
	json,
	sceneId,
	choiceIndex,
	onJsonChange,
	onClose
}: Props) {
	const rf = useReactFlow();
	// Subscribe to viewport transform so the card glides with
	// pan / zoom -- same pattern as InlineSceneEditor.
	useStore((s) => s.transform);

	const scene = json.scenes[sceneId];
	const choice = scene?.choices[choiceIndex];
	const sourceNode = rf.getNode(sceneId);
	const targetId = choice?.next ?? '__finish__';
	const targetNode = rf.getNode(targetId);

	const [winSize, setWinSize] = useState(() => ({
		w: window.innerWidth,
		h: window.innerHeight
	}));
	useEffect(() => {
		const onResize = () =>
			setWinSize({ w: window.innerWidth, h: window.innerHeight });
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	// User-applied drag offset. Mirrors InlineSceneEditor's
	// behaviour: null means "auto-anchor to the edge midpoint",
	// a value means "user dragged it, leave it there until the
	// selection changes."
	const [userPos, setUserPos] = useState<{ x: number; y: number } | null>(null);
	useEffect(() => {
		setUserPos(null);
	}, [sceneId, choiceIndex]);
	const [dragging, setDragging] = useState(false);
	const dragStartRef = useRef<{
		mouseX: number;
		mouseY: number;
		cardX: number;
		cardY: number;
	} | null>(null);
	useEffect(() => {
		if (!dragging) return;
		const onMove = (e: MouseEvent) => {
			const start = dragStartRef.current;
			if (!start) return;
			const dx = e.clientX - start.mouseX;
			const dy = e.clientY - start.mouseY;
			setUserPos({
				x: Math.max(
					VIEWPORT_MARGIN,
					Math.min(
						start.cardX + dx,
						window.innerWidth - CARD_WIDTH - VIEWPORT_MARGIN
					)
				),
				y: Math.max(
					VIEWPORT_MARGIN,
					Math.min(start.cardY + dy, window.innerHeight - 48)
				)
			});
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

	if (!scene || !choice || !sourceNode) return null;

	// Default anchor = midpoint between source and target node
	// centres, in screen coords. If the target node hasn't
	// rendered yet (e.g. finish node missing), fall back to a
	// point off the source's right edge.
	const sourceMid = rf.flowToScreenPosition({
		x: sourceNode.position.x + NODE_WIDTH / 2,
		y: sourceNode.position.y + 60
	});
	const targetMid = targetNode
		? rf.flowToScreenPosition({
				x: targetNode.position.x + NODE_WIDTH / 2,
				y: targetNode.position.y + 60
		  })
		: { x: sourceMid.x + 400, y: sourceMid.y };
	const midX = (sourceMid.x + targetMid.x) / 2;
	const midY = (sourceMid.y + targetMid.y) / 2;

	let left: number;
	let top: number;
	if (userPos) {
		left = userPos.x;
		top = userPos.y;
	} else {
		// Offset slightly above the wire so the panel doesn't
		// sit on top of its own anchor.
		left = midX - CARD_WIDTH / 2;
		top = midY - 30;
	}

	const maxHeight = Math.min(540, winSize.h - 32);
	left = Math.max(
		VIEWPORT_MARGIN,
		Math.min(left, winSize.w - CARD_WIDTH - VIEWPORT_MARGIN)
	);
	top = Math.max(
		VIEWPORT_MARGIN,
		Math.min(top, winSize.h - maxHeight - VIEWPORT_MARGIN)
	);

	const cardStyle: CSSProperties = {
		position: 'fixed',
		left,
		top,
		width: CARD_WIDTH,
		maxHeight,
		background: PANEL,
		border: `1px solid ${PHOSPHOR}`,
		borderRadius: 11,
		boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 22px 60px #000000aa`,
		fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
		color: TEXT,
		display: 'flex',
		flexDirection: 'column',
		overflow: 'hidden',
		zIndex: 50
	};

	const onHeaderMouseDown = (e: React.MouseEvent) => {
		const targetEl = e.target as HTMLElement;
		if (targetEl.closest('button')) return;
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

	const sceneIds = Object.keys(json.scenes).sort();

	return createPortal(
		<div style={cardStyle} role="dialog" aria-label={`edit connection ${sceneId} → ${targetId}`}>
			{/* Header — drag handle + close. */}
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
				<div
					style={{
						display: 'flex',
						alignItems: 'baseline',
						gap: 10,
						minWidth: 0
					}}
				>
					<span
						style={{
							color: PHOSPHOR,
							fontSize: 9,
							fontWeight: 700,
							letterSpacing: '0.1em',
							flexShrink: 0
						}}
					>
						EDITING CONNECTION
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
						<span style={{ color: AMBER }}>{sceneId}</span>
						<span style={{ margin: '0 6px' }}>·</span>
						<span style={{ color: AMBER }}>{choiceIndex + 1})</span>
						<span style={{ margin: '0 4px' }}>→</span>
						<span style={{ color: targetId === '__finish__' ? MAGENTA : AMBER }}>
							{targetId === '__finish__' ? 'finish' : targetId}
						</span>
					</span>
				</div>
				<div style={{ flexShrink: 0 }}>
					{userPos && (
						<HeaderButton
							onClick={() => setUserPos(null)}
							title="Re-anchor to the connection midpoint"
						>
							↺
						</HeaderButton>
					)}
					<HeaderButton onClick={onClose} title="Close (deselect connection)">
						×
					</HeaderButton>
				</div>
			</div>

			{/* Body */}
			<div
				style={{
					flex: 1,
					overflow: 'auto',
					padding: '14px 16px',
					display: 'flex',
					flexDirection: 'column',
					gap: 14
				}}
			>
				<FieldRow>
					<FieldLabel>LABEL</FieldLabel>
					<TextInput
						value={choice.label}
						onChange={(label) =>
							onJsonChange(updateChoice(json, sceneId, choiceIndex, { label }))
						}
					/>
				</FieldRow>

				<div style={{ display: 'flex', gap: 12 }}>
					<FieldRow style={{ width: 100 }}>
						<FieldLabel>POINTS</FieldLabel>
						<NumberInput
							value={choice.points ?? 0}
							onChange={(n) =>
								onJsonChange(
									updateChoice(json, sceneId, choiceIndex, { points: n })
								)
							}
						/>
					</FieldRow>
					<FieldRow style={{ flex: 1 }}>
						<FieldLabel>NEXT SCENE</FieldLabel>
						<NextSelect
							value={choice.next}
							sceneIds={sceneIds}
							onChange={(next) =>
								onJsonChange(updateChoice(json, sceneId, choiceIndex, { next }))
							}
						/>
					</FieldRow>
				</div>

				<FieldRow>
					<FieldLabel>
						REACTION
						<span style={{ color: DIM, fontWeight: 400, marginLeft: 6 }}>
							— shown after the choice
						</span>
					</FieldLabel>
					<Textarea
						value={choice.flavour ?? ''}
						placeholder={'e.g. "A panel sighs open."'}
						onChange={(flavour) =>
							onJsonChange(
								updateChoice(json, sceneId, choiceIndex, {
									flavour: flavour || undefined
								})
							)
						}
					/>
				</FieldRow>
			</div>
		</div>,
		document.body
	);
}

/* ─── primitives ────────────────────────────────────────── */

function FieldRow({
	children,
	style
}: {
	children: ReactNode;
	style?: CSSProperties;
}) {
	return (
		<div
			style={{ display: 'flex', flexDirection: 'column', gap: 5, ...(style ?? {}) }}
		>
			{children}
		</div>
	);
}

function FieldLabel({ children }: { children: ReactNode }) {
	return (
		<div
			style={{
				fontSize: 9,
				fontWeight: 700,
				letterSpacing: '0.1em',
				color: DIM
			}}
		>
			{children}
		</div>
	);
}

const inputBase: CSSProperties = {
	width: '100%',
	background: VOID,
	border: `1px solid ${PANEL_BORDER}`,
	borderRadius: 4,
	color: TEXT,
	padding: '6px 8px',
	fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
	fontSize: 11,
	lineHeight: 1.4,
	outline: 'none',
	transition: 'border-color 120ms'
};

function TextInput({
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
			style={inputBase}
			onFocus={(e) => (e.target.style.borderColor = AMBER)}
			onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
		/>
	);
}

function NumberInput({
	value,
	onChange
}: {
	value: number;
	onChange: (n: number) => void;
}) {
	return (
		<input
			type="number"
			value={value}
			onChange={(e) => onChange(Number(e.target.value) || 0)}
			style={{ ...inputBase, color: PHOSPHOR, textAlign: 'center' }}
			onFocus={(e) => (e.target.style.borderColor = AMBER)}
			onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
		/>
	);
}

function NextSelect({
	value,
	sceneIds,
	onChange
}: {
	value: string | null;
	sceneIds: string[];
	onChange: (v: string | null) => void;
}) {
	return (
		<select
			value={value ?? '__null__'}
			onChange={(e) =>
				onChange(e.target.value === '__null__' ? null : e.target.value)
			}
			style={{
				...inputBase,
				color: value === null ? MAGENTA : AMBER,
				borderColor: value === null ? MAGENTA : AMBER
			}}
		>
			<option value="__null__">finish (terminal)</option>
			{sceneIds.map((id) => (
				<option key={id} value={id}>
					{id}
				</option>
			))}
		</select>
	);
}

function Textarea({
	value,
	onChange,
	placeholder
}: {
	value: string;
	onChange: (v: string) => void;
	placeholder?: string;
}) {
	return (
		<textarea
			value={value}
			placeholder={placeholder}
			rows={3}
			onChange={(e) => onChange(e.target.value)}
			style={{
				...inputBase,
				resize: 'vertical',
				minHeight: 60,
				lineHeight: 1.55
			}}
			onFocus={(e) => (e.target.style.borderColor = AMBER)}
			onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
		/>
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
				marginLeft: 6,
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

