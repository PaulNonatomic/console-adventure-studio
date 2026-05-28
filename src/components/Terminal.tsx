/**
 * In-studio playtest terminal.
 *
 * Boots a real `Adventure` from `console-adventure` with the
 * loaded JSON, plugs in a custom `Logger` that captures each
 * `console.log("%câ€¦", style)` call into React state instead of
 * the browser console, and renders the captured lines with the
 * brand styling preserved.
 *
 * The user drives the game from a choice-button row beneath
 * the output: pressing a button calls `adventure.choose(n)`,
 * the engine emits its lines through the captured logger, the
 * output re-renders. Restart and share controls appear at the
 * appropriate moments.
 *
 * Why not just open the real dev console? Because the editor's
 * users won't necessarily know to open one, and a self-contained
 * playtest lives next to the graph so iterating on a scene + re-
 * running it is one click away.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
	createAdventureFromJson,
	computeMaxScore,
	type Adventure,
	type Logger
} from 'console-adventure';
import type { AdventureJson } from 'console-adventure';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	MAGENTA,
	CYAN,
	TEXT,
	DIM,
	VOID
} from '../lib/theme';

interface LogLine {
	/** Raw `console.log` first arg, may contain `%c` markers. */
	message: string;
	/** Style strings paired with each `%c` segment, in order. */
	styles: string[];
}

/**
 * Live state surfaced to App so the graph can mirror the
 * playtest: which scene is being played right now, which scenes
 * have been visited (so they can dim), and which choices were
 * taken (so those edges can render cyan). Emitted on every
 * start / choose / restart.
 */
export interface PlayState {
	sceneId: string | null;
	finished: boolean;
	score: number;
	/** Scenes visited so far, in order, including the current one. */
	visited: string[];
	/**
	 * Edges taken along the current run, as `${sourceSceneId}-${choiceIndex}`
	 * pairs. App turns these into a Set and matches against edge ids to
	 * style the taken path cyan.
	 */
	takenEdges: string[];
}

interface Props {
	json: AdventureJson;
	/**
	 * Bumped when the document changes in a way that invalidates
	 * an in-flight run (scene added/deleted, `next` rewired, start
	 * changed). The rebuild effect keys on this rather than `json`
	 * so cosmetic keystrokes (heading / narration text) don't
	 * thrash the playtest. See Move 03 reset-policy decision in
	 * the design handoff.
	 */
	jsonVersion: number;
	/**
	 * Optional scene id to start the playtest from instead of
	 * `json.start`. Used by "▶ play from here" controls in the
	 * inline editor. Setting this to null restores the document's
	 * real start scene.
	 */
	playFrom?: string | null;
	/**
	 * Counter that bumps on every "play from here" click so a
	 * re-click on the same scene still rebuilds the playtest
	 * (otherwise React's equality check on `playFrom` skips the
	 * effect re-fire).
	 */
	playRequestId?: number;
	/**
	 * Optional callback wired by App so the Terminal's banner
	 * can offer a one-click way to drop the playFrom override
	 * and return to the document's real start.
	 */
	onClearPlayFrom?: () => void;
	/** Live state callback — called on every start / choose. */
	onStateChange?: (s: PlayState) => void;
}

export function Terminal({
	json,
	jsonVersion,
	playFrom,
	playRequestId,
	onClearPlayFrom,
	onStateChange
}: Props) {
	const [lines, setLines] = useState<LogLine[]>([]);
	const [tick, setTick] = useState(0); // forces re-read of adventure state after each action
	const adventureRef = useRef<Adventure | null>(null);
	const linesEndRef = useRef<HTMLDivElement | null>(null);

	// Visited path tracked locally — the engine doesn't surface
	// it. We append on each successful `choose`, reset on `play`,
	// and feed it through onStateChange so the graph can dim
	// already-visited nodes and cyan the edges taken.
	const visitedRef = useRef<string[]>([]);
	const takenEdgesRef = useRef<string[]>([]);

	// Latest json kept in a ref so the choose handler can look up
	// the pre-`choose` scene id (to record the taken edge) without
	// the handler itself depending on `json` and getting reborn
	// every cosmetic keystroke.
	const jsonRef = useRef(json);
	useEffect(() => {
		jsonRef.current = json;
	}, [json]);

	const onStateChangeRef = useRef(onStateChange);
	useEffect(() => {
		onStateChangeRef.current = onStateChange;
	}, [onStateChange]);

	// Stable logger that pushes into state. Using a setter ref so
	// the logger reference itself never needs to change â€” the
	// adventure binds to it once at construction.
	const linesSetterRef = useRef(setLines);
	useEffect(() => {
		linesSetterRef.current = setLines;
	}, []);

	const logger = useMemo<Logger>(
		() => ({
			log: (message: string, ...styles: string[]) => {
				linesSetterRef.current((prev) => [...prev, { message, styles }]);
			}
		}),
		[]
	);

	// Build a fresh adventure whenever the JSON changes. The
	// previous instance is dropped (no cleanup needed â€” it's
	// just state held in a closure).
	useEffect(() => {
		try {
			const sourceJson = playFrom
				? { ...jsonRef.current, start: playFrom }
				: jsonRef.current;
			adventureRef.current = createAdventureFromJson(sourceJson, { logger });
			setLines([]);
			visitedRef.current = [];
			takenEdgesRef.current = [];
			setTick((t) => t + 1);
			onStateChangeRef.current?.({
				sceneId: null,
				finished: false,
				score: 0,
				visited: [],
				takenEdges: []
			});
		} catch (err) {
			adventureRef.current = null;
			setLines([
				{
					message: `%c   âš  Could not load adventure: ${(err as Error).message}`,
					styles: [`color: ${MAGENTA};`]
				}
			]);
		}
		// `logger` is stable (useMemo[]); excluded from deps to keep
		// the rebuild gated purely on structural / playFrom signals.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [jsonVersion, playFrom, playRequestId]);

	// Auto-scroll to the bottom whenever new lines land.
	useEffect(() => {
		linesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
	}, [lines]);

	function emitState() {
		const s = adventureRef.current?.getState() ?? null;
		onStateChangeRef.current?.({
			sceneId: s?.sceneId ?? null,
			finished: s?.finished ?? false,
			score: s?.score ?? 0,
			visited: visitedRef.current.slice(),
			takenEdges: takenEdgesRef.current.slice()
		});
	}

	function play() {
		setLines([]);
		visitedRef.current = [];
		takenEdgesRef.current = [];
		adventureRef.current?.start();
		const after = adventureRef.current?.getState();
		if (after?.sceneId) visitedRef.current = [after.sceneId];
		setTick((t) => t + 1);
		emitState();
	}

	function choose(n: number) {
		// Capture the *current* scene before the engine advances —
		// that's the edge's source. The choice index (1-based in the
		// API) maps to the graph edge id source-i-target via i-1.
		const before = adventureRef.current?.getState();
		if (before?.sceneId) {
			takenEdgesRef.current = [...takenEdgesRef.current, `${before.sceneId}-${n - 1}`];
		}
		adventureRef.current?.choose(n);
		const after = adventureRef.current?.getState();
		if (after?.sceneId && after.sceneId !== visitedRef.current[visitedRef.current.length - 1]) {
			visitedRef.current = [...visitedRef.current, after.sceneId];
		}
		setTick((t) => t + 1);
		emitState();
	}

	function share() {
		adventureRef.current?.share();
		setTick((t) => t + 1);
	}

	// Compute current state purely from the adventure ref + tick
	// â€” the engine is the source of truth.
	const state = useMemo(() => {
		void tick; // dependency only
		return adventureRef.current?.getState() ?? null;
	}, [tick]);

	const currentSceneId = state?.sceneId ?? null;
	const finished = state?.finished ?? false;
	const score = state?.score ?? 0;
	const inProgress = state !== null && !finished;
	const currentScene = currentSceneId ? json.scenes[currentSceneId] : null;
	const hasShare = !!json.share;
	const maxScore = useMemo(() => computeMaxScore(json), [json]);
	const visited = visitedRef.current;

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				height: '100%',
				background: VOID,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			{/* Sync banner — visible whenever a playtest is in
			    progress, signals that the graph mirrors the run
			    and shows the live score. */}
			{state !== null && (
				<div
					style={{
						background: PANEL,
						borderBottom: `1px solid ${PANEL_BORDER}`,
						padding: '8px 14px',
						display: 'flex',
						justifyContent: 'space-between',
						alignItems: 'center',
						fontSize: 10
					}}
				>
					<span style={{ color: CYAN, display: 'flex', alignItems: 'center', gap: 8 }}>
						● {playFrom ? `playing from ${playFrom}` : 'following the live scene on the graph'}
						{playFrom && onClearPlayFrom && (
							<button
								onClick={onClearPlayFrom}
								title="Return to the document's start scene on next play"
								style={{
									background: 'transparent',
									border: `1px solid ${PANEL_BORDER}`,
									borderRadius: 3,
									color: DIM,
									fontFamily: 'inherit',
									fontSize: 9,
									padding: '1px 5px',
									cursor: 'pointer'
								}}
								onMouseEnter={(e) => (e.currentTarget.style.color = AMBER)}
								onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
							>
								↺ from start
							</button>
						)}
					</span>
					<span style={{ color: DIM }}>
						score <span style={{ color: PHOSPHOR }}>{score}</span>
						<span style={{ margin: '0 4px', color: PANEL_BORDER }}>/</span>
						<span style={{ color: DIM }}>{maxScore}</span>
					</span>
				</div>
			)}

			{/* Output area.
			    `line-height: 1.35` matches the real dev console
			    more closely than the 1.5 we used to have — the
			    browser console is tighter than typical body-text
			    rendering and the playtest should feel like the
			    real thing, not a more spacious body-text
			    version of it. */}
			<div
				style={{
					flex: 1,
					overflow: 'auto',
					padding: '14px 6px 14px 14px',
					fontSize: 11,
					lineHeight: 1.35,
					color: TEXT
				}}
			>
				{lines.length === 0 && (
					<div
						style={{
							color: DIM,
							fontSize: 11,
							lineHeight: 1.6
						}}
					>
						Playtest the adventure here without leaving the studio.
						<br />
						<br />
						<span style={{ color: PHOSPHOR }}>{'>'} </span>
						<span style={{ color: AMBER }}>Press </span>
						<span
							style={{
								color: PHOSPHOR,
								background: PANEL,
								padding: '1px 6px',
								borderRadius: 3,
								border: `1px solid ${PANEL_BORDER}`
							}}
						>
							play()
						</span>
						<span style={{ color: AMBER }}> to start.</span>
					</div>
				)}
				{lines.map((line, i) => (
					<TerminalLine key={i} line={line} />
				))}
				<div ref={linesEndRef} />
			</div>

			{/* PATH TAKEN — breadcrumb of visited scenes. Only
			    shown when there's a path to show (after first
			    start). Lets the user see the route they walked
			    and (eventually) jump back. */}
			{visited.length > 0 && (
				<div
					style={{
						borderTop: `1px solid ${PANEL_BORDER}`,
						padding: '8px 14px',
						background: PANEL
					}}
				>
					<div
						style={{
							fontSize: 9,
							fontWeight: 700,
							letterSpacing: '0.1em',
							color: DIM,
							marginBottom: 4
						}}
					>
						PATH TAKEN
					</div>
					<div
						style={{
							display: 'flex',
							flexWrap: 'wrap',
							gap: '4px 10px',
							fontSize: 10
						}}
					>
						{visited.map((sid, i) => {
							const isCurrent = i === visited.length - 1 && !finished;
							return (
								<span
									key={`${sid}-${i}`}
									style={{
										color: isCurrent ? CYAN : DIM,
										fontWeight: isCurrent ? 700 : 400
									}}
								>
									<span style={{ marginRight: 4 }}>{isCurrent ? '●' : '✓'}</span>
									{sid}
								</span>
							);
						})}
					</div>
				</div>
			)}

			{/* Control row */}
			<div
				style={{
					borderTop: `1px solid ${PANEL_BORDER}`,
					padding: '10px 12px',
					background: PANEL,
					display: 'flex',
					flexWrap: 'wrap',
					gap: 6
				}}
			>
				<TermButton
					label={state === null ? 'play()' : finished ? 'play again' : 'restart'}
					color="primary"
					onClick={play}
				/>
				{inProgress &&
					currentScene?.choices.map((c, i) => (
						<TermButton
							key={i}
							label={`${i + 1}) ${truncate(c.label, 22)}`}
							color="accent"
							onClick={() => choose(i + 1)}
						/>
					))}
				{finished && hasShare && (
					<TermButton label="share()" color="danger" onClick={share} />
				)}
			</div>
		</div>
	);
}

/**
 * Render a single captured log line, splitting on `%c` and
 * applying the matched style to each segment. The first
 * segment is unstyled (matches the browser's console
 * behaviour: anything before the first `%c` uses the default
 * style).
 *
 * Hanging indent: console-adventure prefixes every line with
 * a literal `   ` (or `     ` for choices) for indentation. In
 * a narrow viewport that string wraps and the continuation
 * lands at column 0 â€” visually broken. So we strip the leading
 * whitespace from the message and re-apply it as
 * `padding-left` (in `ch` units, exact for monospace) so the
 * first line and every wrap continuation share the same x.
 */
function TerminalLine({ line }: { line: LogLine }) {
	const segments = line.message.split('%c');

	// Empty `console.log('')` calls â€” the engine emits these
	// intentionally between sections (heading â†’ narration â†’
	// choices â†’ prompt) for paragraph breaks. An empty <div>
	// collapses to zero height, so render a non-breaking space
	// so the browser gives the line a full line-height of
	// vertical room. Without this, the paragraph breaks
	// vanish and the output reads as one wall of text.
	if (line.message === '') {
		return <div>{' '}</div>;
	}

	// Find the leading whitespace of the first non-empty segment.
	let leadChars = 0;
	const firstContent = segments.find((s) => s.length > 0);
	if (firstContent) {
		const m = firstContent.match(/^(\s*)/);
		if (m) leadChars = m[1].length;
	}

	// Render segments, but trim the leading whitespace from the
	// first non-empty one (we're going to apply it as padding
	// instead).
	let stripped = false;
	const rendered: ReactNode[] = segments.map((seg, i) => {
		let s = seg;
		if (!stripped && s.length > 0) {
			s = s.replace(/^\s+/, '');
			stripped = true;
		}
		if (s.length === 0) return null;
		const style = i === 0 ? undefined : line.styles[i - 1];
		return (
			<span key={i} style={style ? cssStringToObject(style) : undefined}>
				{s}
			</span>
		);
	});

	return (
		<div
			style={{
				// `ch` = the width of a "0" glyph; for monospace it's
				// exactly one character cell, so paddingLeft tracks
				// the original leading-space width pixel-perfectly.
				paddingLeft: `${leadChars}ch`,
				whiteSpace: 'pre-wrap',
				wordBreak: 'break-word'
			}}
		>
			{rendered}
		</div>
	);
}

/**
 * Turn a `console.log` CSS string (`"color: red; font-weight: bold;"`)
 * into a React `style` prop object. Kept minimal â€” we only
 * need to handle the props that the engine actually emits
 * (color, background, font-family, font-size, font-weight,
 * letter-spacing, line-height), not arbitrary CSS.
 */
function cssStringToObject(css: string | undefined): React.CSSProperties {
	if (!css) return {};
	const out: Record<string, string> = {};
	for (const decl of css.split(';')) {
		const [rawKey, ...rest] = decl.split(':');
		if (!rawKey || rest.length === 0) continue;
		const key = rawKey.trim();
		const value = rest.join(':').trim();
		if (!key || !value) continue;
		// kebab-case â†’ camelCase so React accepts it.
		const camel = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
		out[camel] = value;
	}
	return out as React.CSSProperties;
}

function TermButton({
	label,
	onClick,
	color
}: {
	label: string;
	onClick: () => void;
	color: 'primary' | 'accent' | 'danger';
}) {
	const fg = color === 'primary' ? PHOSPHOR : color === 'accent' ? AMBER : MAGENTA;
	return (
		<button
			onClick={onClick}
			style={{
				background: 'transparent',
				border: `1px solid ${PANEL_BORDER}`,
				color: fg,
				padding: '5px 10px',
				borderRadius: 5,
				fontFamily: 'inherit',
				fontSize: 10,
				cursor: 'pointer',
				transition: 'border-color 120ms, background 120ms'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = fg;
				e.currentTarget.style.background = `${fg}11`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = PANEL_BORDER;
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{label}
		</button>
	);
}

function truncate(s: string, n: number): string {
	return s.length <= n ? s : s.slice(0, n - 1) + 'â€¦';
}
