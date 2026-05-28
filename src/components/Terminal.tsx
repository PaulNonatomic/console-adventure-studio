/**
 * In-studio playtest terminal.
 *
 * Boots a real `Adventure` from `console-adventure` with the
 * loaded JSON, plugs in a custom `Logger` that captures each
 * `console.log("%c…", style)` call into React state instead of
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { createAdventureFromJson, type Adventure, type Logger } from 'console-adventure';
import type { AdventureJson } from 'console-adventure';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	MAGENTA,
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

interface Props {
	json: AdventureJson;
}

export function Terminal({ json }: Props) {
	const [lines, setLines] = useState<LogLine[]>([]);
	const [tick, setTick] = useState(0); // forces re-read of adventure state after each action
	const adventureRef = useRef<Adventure | null>(null);
	const linesEndRef = useRef<HTMLDivElement | null>(null);

	// Stable logger that pushes into state. Using a setter ref so
	// the logger reference itself never needs to change — the
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
	// previous instance is dropped (no cleanup needed — it's
	// just state held in a closure).
	useEffect(() => {
		try {
			adventureRef.current = createAdventureFromJson(json, { logger });
			setLines([]);
			setTick((t) => t + 1);
		} catch (err) {
			adventureRef.current = null;
			setLines([
				{
					message: `%c   ⚠ Could not load adventure: ${(err as Error).message}`,
					styles: [`color: ${MAGENTA};`]
				}
			]);
		}
	}, [json, logger]);

	// Auto-scroll to the bottom whenever new lines land.
	useEffect(() => {
		linesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
	}, [lines]);

	function play() {
		setLines([]);
		adventureRef.current?.start();
		setTick((t) => t + 1);
	}

	function choose(n: number) {
		adventureRef.current?.choose(n);
		setTick((t) => t + 1);
	}

	function share() {
		adventureRef.current?.share();
		setTick((t) => t + 1);
	}

	// Compute current state purely from the adventure ref + tick
	// — the engine is the source of truth.
	const state = useMemo(() => {
		void tick; // dependency only
		return adventureRef.current?.getState() ?? null;
	}, [tick]);

	const currentSceneId = state?.sceneId ?? null;
	const finished = state?.finished ?? false;
	const inProgress = state !== null && !finished;
	const currentScene = currentSceneId ? json.scenes[currentSceneId] : null;
	const hasShare = !!json.share;

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
			{/* Output area */}
			<div
				style={{
					flex: 1,
					overflow: 'auto',
					padding: '14px 6px 14px 14px',
					fontSize: 11,
					lineHeight: 1.5,
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
 * lands at column 0 — visually broken. So we strip the leading
 * whitespace from the message and re-apply it as
 * `padding-left` (in `ch` units, exact for monospace) so the
 * first line and every wrap continuation share the same x.
 */
function TerminalLine({ line }: { line: LogLine }) {
	const segments = line.message.split('%c');

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
	const rendered: Array<JSX.Element | null> = segments.map((seg, i) => {
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
 * into a React `style` prop object. Kept minimal — we only
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
		// kebab-case → camelCase so React accepts it.
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
	return s.length <= n ? s : s.slice(0, n - 1) + '…';
}
