/**
 * Ship dialog — the export experience.
 *
 * Replaces the silent "download JSON" with a validated
 * two-column hand-off:
 *
 *   Left  — `$ ship ~/<name>`, "Ready to ship." heading, a
 *           validation checklist (reachability, dead-ends,
 *           missing targets, schema) and a stats grid.
 *   Right — segmented tabs:
 *             • wrapper code  — copy-pasteable snippet that
 *                               drops onto a site
 *             • adventure.json — pretty-printed wire format
 *             • share card     — preview of `share.text` filled
 *                                with a top-tier sample
 *
 * Failing validation rows name the offending scenes and offer
 * a "jump to it" link that closes the dialog and selects the
 * scene on the graph.
 */
import { useMemo, useState } from 'react';
import type { AdventureJson } from 'console-adventure';
import { computeMaxScore } from 'console-adventure';
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
import { validate, countEndings } from '../lib/validate';
import { buildWrapperSnippet } from '../lib/wrapperSnippet';
import {
	toWireFormat,
	downloadAdventure,
	copyToClipboard
} from '../lib/exportAdventure';

interface Props {
	json: AdventureJson;
	onClose: () => void;
	/**
	 * Programmatic scene selection — closes the dialog AND
	 * highlights the named scene on the graph. Driven by the
	 * "jump to it" links in failing checklist rows.
	 */
	onJumpToScene: (sceneId: string) => void;
}

type ShipTab = 'wrapper' | 'json' | 'share';

export function ShipDialog({ json, onClose, onJumpToScene }: Props) {
	const [tab, setTab] = useState<ShipTab>('wrapper');
	const [copyState, setCopyState] = useState<'idle' | 'wrapper' | 'json'>('idle');

	const validation = useMemo(() => validate(json), [json]);
	const maxScore = useMemo(() => computeMaxScore(json), [json]);
	const endings = useMemo(() => countEndings(json), [json]);
	const choiceCount = useMemo(
		() =>
			Object.values(json.scenes).reduce(
				(n, s) => n + s.choices.length,
				0
			),
		[json]
	);
	const snippet = useMemo(() => buildWrapperSnippet(json), [json]);
	const wireJson = useMemo(() => toWireFormat(json), [json]);

	async function handleCopy(kind: 'wrapper' | 'json') {
		const ok = await copyToClipboard(kind === 'wrapper' ? snippet : wireJson);
		if (!ok) return;
		setCopyState(kind);
		window.setTimeout(() => setCopyState('idle'), 1200);
	}

	const startId = json.start;

	return (
		<div
			onClick={onClose}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(10, 10, 15, 0.7)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 110,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="ship-title"
				style={{
					width: 'min(880px, 95vw)',
					maxHeight: '85vh',
					background: PANEL,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 14,
					boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
					display: 'flex',
					flexDirection: 'column',
					overflow: 'hidden'
				}}
			>
				<DialogHeader onClose={onClose} />

				<div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
					<LeftPane
						startId={startId}
						validation={validation}
						sceneCount={Object.keys(json.scenes).length}
						choiceCount={choiceCount}
						maxScore={maxScore}
						endings={endings}
						onJumpToScene={onJumpToScene}
					/>
					<RightPane
						json={json}
						tab={tab}
						onTabChange={setTab}
						snippet={snippet}
						wireJson={wireJson}
						maxScore={maxScore}
						copyState={copyState}
						onCopy={handleCopy}
					/>
				</div>

				<DialogFooter
					json={json}
					copyState={copyState}
					onCopyWrapper={() => handleCopy('wrapper')}
				/>
			</div>
		</div>
	);
}

// ─── sections ────────────────────────────────────────────────

function DialogHeader({ onClose }: { onClose: () => void }) {
	return (
		<header
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				alignItems: 'center',
				padding: '14px 20px',
				borderBottom: `1px solid ${PANEL_BORDER}`
			}}
		>
			<span
				id="ship-title"
				style={{
					color: PHOSPHOR,
					fontWeight: 700,
					fontSize: 13,
					letterSpacing: '0.05em'
				}}
			>
				ship adventure
			</span>
			<button
				onClick={onClose}
				aria-label="close"
				style={{
					background: 'transparent',
					border: 'none',
					color: DIM,
					fontSize: 18,
					cursor: 'pointer',
					lineHeight: 1
				}}
			>
				×
			</button>
		</header>
	);
}

interface LeftPaneProps {
	startId: string;
	validation: ReturnType<typeof validate>;
	sceneCount: number;
	choiceCount: number;
	maxScore: number;
	endings: number;
	onJumpToScene: (sceneId: string) => void;
}

function LeftPane({
	startId,
	validation,
	sceneCount,
	choiceCount,
	maxScore,
	endings,
	onJumpToScene
}: LeftPaneProps) {
	return (
		<div
			style={{
				flex: '0 0 320px',
				background: VOID,
				borderRight: `1px solid ${PANEL_BORDER}`,
				padding: '18px 20px',
				display: 'flex',
				flexDirection: 'column',
				gap: 16,
				overflow: 'auto'
			}}
		>
			<div style={{ color: DIM, fontSize: 11 }}>
				<span style={{ color: PHOSPHOR }}>$</span> ship ~/{startId}
			</div>

			<div
				style={{
					color: TEXT,
					fontSize: 26,
					fontWeight: 700,
					letterSpacing: '-0.01em'
				}}
			>
				{validation.ok ? 'Ready to ship.' : 'Almost there.'}
			</div>

			<div style={{ color: DIM, fontSize: 11, lineHeight: 1.5 }}>
				{validation.ok
					? 'Every check passes — the adventure is sound and drops straight onto your site.'
					: 'A few checks failed. Fix them on the graph, then come back.'}
			</div>

			<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
				<CheckRow
					ok={validation.unreachable.length === 0}
					label={
						validation.unreachable.length === 0
							? `All ${sceneCount} scenes reachable from start`
							: `${validation.unreachable.length} scene${validation.unreachable.length === 1 ? '' : 's'} unreachable`
					}
					details={validation.unreachable}
					onJumpToScene={onJumpToScene}
				/>
				<CheckRow
					ok={validation.deadEnds.length === 0}
					label={
						validation.deadEnds.length === 0
							? 'Every path reaches an ending'
							: `${validation.deadEnds.length} scene${validation.deadEnds.length === 1 ? '' : 's'} dead-end`
					}
					details={validation.deadEnds}
					onJumpToScene={onJumpToScene}
				/>
				<CheckRow
					ok={validation.missingTargets.length === 0}
					label={
						validation.missingTargets.length === 0
							? 'No choices point at missing scenes'
							: `${validation.missingTargets.length} choice${validation.missingTargets.length === 1 ? '' : 's'} point at missing scenes`
					}
					details={validation.missingTargets.map((m) => m.scene)}
					onJumpToScene={onJumpToScene}
				/>
				<CheckRow
					ok={validation.ok}
					label="Matches adventure.schema.json"
					details={[]}
					onJumpToScene={onJumpToScene}
				/>
			</div>

			<div
				style={{
					color: DIM,
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.16em',
					marginTop: 6
				}}
			>
				AT A GLANCE
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '1fr 1fr',
					gap: 16
				}}
			>
				<StatBlock value={sceneCount} label="SCENES" colour={PHOSPHOR} />
				<StatBlock value={choiceCount} label="CHOICES" colour={AMBER} />
				<StatBlock value={maxScore} label="MAX SCORE" colour={CYAN} />
				<StatBlock value={endings} label="ENDINGS" colour={MAGENTA} />
			</div>
		</div>
	);
}

function CheckRow({
	ok,
	label,
	details,
	onJumpToScene
}: {
	ok: boolean;
	label: string;
	details: string[];
	onJumpToScene: (sceneId: string) => void;
}) {
	return (
		<div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
			<span
				aria-hidden
				style={{
					width: 16,
					height: 16,
					borderRadius: '50%',
					background: ok ? PHOSPHOR : AMBER,
					color: VOID,
					fontSize: 10,
					fontWeight: 700,
					display: 'inline-flex',
					alignItems: 'center',
					justifyContent: 'center',
					flexShrink: 0,
					marginTop: 1
				}}
			>
				{ok ? '✓' : '!'}
			</span>
			<div style={{ flex: 1, color: ok ? TEXT : AMBER, fontSize: 11 }}>
				<div>{label}</div>
				{!ok && details.length > 0 && (
					<div style={{ marginTop: 4, color: DIM, fontSize: 10, lineHeight: 1.5 }}>
						{details.slice(0, 3).map((sceneId, i) => (
							<span key={`${sceneId}-${i}`}>
								<button
									onClick={() => onJumpToScene(sceneId)}
									style={{
										background: 'transparent',
										border: 'none',
										padding: 0,
										color: CYAN,
										fontSize: 10,
										cursor: 'pointer',
										fontFamily: 'inherit',
										textDecoration: 'underline'
									}}
								>
									{sceneId}
								</button>
								{i < Math.min(details.length, 3) - 1 ? ', ' : ''}
							</span>
						))}
						{details.length > 3 && ` +${details.length - 3} more`}
					</div>
				)}
			</div>
		</div>
	);
}

function StatBlock({
	value,
	label,
	colour
}: {
	value: number;
	label: string;
	colour: string;
}) {
	return (
		<div>
			<div style={{ color: colour, fontSize: 28, fontWeight: 700, lineHeight: 1 }}>
				{value}
			</div>
			<div
				style={{
					color: DIM,
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.16em',
					marginTop: 4
				}}
			>
				{label}
			</div>
		</div>
	);
}

interface RightPaneProps {
	json: AdventureJson;
	tab: ShipTab;
	onTabChange: (t: ShipTab) => void;
	snippet: string;
	wireJson: string;
	maxScore: number;
	copyState: 'idle' | 'wrapper' | 'json';
	onCopy: (kind: 'wrapper' | 'json') => void;
}

function RightPane({
	json,
	tab,
	onTabChange,
	snippet,
	wireJson,
	maxScore,
	copyState,
	onCopy
}: RightPaneProps) {
	return (
		<div
			style={{
				flex: 1,
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden'
			}}
		>
			<div
				style={{
					display: 'flex',
					gap: 6,
					padding: '12px 20px 0',
					borderBottom: `1px solid ${PANEL_BORDER}`
				}}
			>
				<SegmentPill label="adventure.json" active={tab === 'json'} onClick={() => onTabChange('json')} />
				<SegmentPill label="wrapper code" active={tab === 'wrapper'} onClick={() => onTabChange('wrapper')} />
				<SegmentPill label="share card" active={tab === 'share'} onClick={() => onTabChange('share')} />
			</div>

			<div style={{ flex: 1, overflow: 'auto', padding: '18px 20px' }}>
				{tab === 'wrapper' && (
					<WrapperTab
						snippet={snippet}
						copied={copyState === 'wrapper'}
						onCopy={() => onCopy('wrapper')}
					/>
				)}
				{tab === 'json' && (
					<JsonTab
						wireJson={wireJson}
						copied={copyState === 'json'}
						onCopy={() => onCopy('json')}
					/>
				)}
				{tab === 'share' && <ShareTab json={json} maxScore={maxScore} />}
			</div>
		</div>
	);
}

function SegmentPill({
	label,
	active,
	onClick
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				background: active ? `${PHOSPHOR}18` : 'transparent',
				border: `1px solid ${active ? PHOSPHOR : PANEL_BORDER}`,
				color: active ? PHOSPHOR : DIM,
				fontFamily: 'inherit',
				fontSize: 11,
				fontWeight: active ? 700 : 500,
				padding: '6px 12px',
				borderRadius: 6,
				borderBottomLeftRadius: 0,
				borderBottomRightRadius: 0,
				cursor: 'pointer',
				transition: 'color 120ms, background 120ms'
			}}
		>
			{label}
		</button>
	);
}

function WrapperTab({
	snippet,
	copied,
	onCopy
}: {
	snippet: string;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<>
			<div
				style={{
					color: DIM,
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.16em',
					marginBottom: 8
				}}
			>
				DROP THIS ONTO YOUR SITE
			</div>
			<div
				style={{
					position: 'relative',
					background: VOID,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 8,
					padding: '14px 16px'
				}}
			>
				<pre
					style={{
						margin: 0,
						color: TEXT,
						fontSize: 11,
						lineHeight: 1.6,
						whiteSpace: 'pre-wrap',
						wordBreak: 'break-word',
						fontFamily: 'inherit'
					}}
				>
					<SyntaxTinted code={snippet} />
				</pre>
				<button
					onClick={onCopy}
					style={{
						position: 'absolute',
						top: 10,
						right: 10,
						background: 'transparent',
						border: `1px solid ${copied ? PHOSPHOR : PANEL_BORDER}`,
						color: copied ? PHOSPHOR : AMBER,
						fontFamily: 'inherit',
						fontSize: 10,
						padding: '3px 9px',
						borderRadius: 4,
						cursor: 'pointer'
					}}
				>
					{copied ? 'copied' : 'copy'}
				</button>
			</div>
		</>
	);
}

/**
 * Quick-and-dirty syntax tinting for the wrapper snippet.
 * Tokenises a handful of recognised JS forms — purely cosmetic.
 * The renderer keeps the original whitespace intact.
 */
function SyntaxTinted({ code }: { code: string }) {
	const KEYWORDS = new Set(['import', 'from', 'const', 'export']);
	const out: React.ReactNode[] = [];
	let buf = '';
	let i = 0;
	let key = 0;

	const flush = () => {
		if (buf) {
			out.push(<span key={key++}>{buf}</span>);
			buf = '';
		}
	};

	while (i < code.length) {
		// Line comment
		if (code[i] === '/' && code[i + 1] === '/') {
			flush();
			const end = code.indexOf('\n', i);
			const segment = end === -1 ? code.slice(i) : code.slice(i, end);
			out.push(
				<span key={key++} style={{ color: DIM, fontStyle: 'italic' }}>
					{segment}
				</span>
			);
			i = end === -1 ? code.length : end;
			continue;
		}

		// String literal (single quote)
		if (code[i] === "'") {
			flush();
			let j = i + 1;
			while (j < code.length && code[j] !== "'") j++;
			out.push(
				<span key={key++} style={{ color: AMBER }}>
					{code.slice(i, j + 1)}
				</span>
			);
			i = j + 1;
			continue;
		}

		// Identifier / keyword
		if (/[A-Za-z_$]/.test(code[i])) {
			let j = i;
			while (j < code.length && /[A-Za-z0-9_$]/.test(code[j])) j++;
			const word = code.slice(i, j);
			flush();
			if (KEYWORDS.has(word)) {
				out.push(
					<span key={key++} style={{ color: MAGENTA }}>
						{word}
					</span>
				);
			} else if (code[j] === '(') {
				out.push(
					<span key={key++} style={{ color: CYAN }}>
						{word}
					</span>
				);
			} else {
				out.push(<span key={key++}>{word}</span>);
			}
			i = j;
			continue;
		}

		buf += code[i++];
	}
	flush();
	return <>{out}</>;
}

function JsonTab({
	wireJson,
	copied,
	onCopy
}: {
	wireJson: string;
	copied: boolean;
	onCopy: () => void;
}) {
	return (
		<>
			<div
				style={{
					color: DIM,
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.16em',
					marginBottom: 8
				}}
			>
				ADVENTURE.JSON
			</div>
			<div
				style={{
					position: 'relative',
					background: VOID,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 8,
					padding: '14px 16px',
					maxHeight: 360,
					overflow: 'auto'
				}}
			>
				<pre
					style={{
						margin: 0,
						color: TEXT,
						fontSize: 11,
						lineHeight: 1.6,
						whiteSpace: 'pre',
						fontFamily: 'inherit'
					}}
				>
					{wireJson}
				</pre>
				<button
					onClick={onCopy}
					style={{
						position: 'absolute',
						top: 10,
						right: 10,
						background: 'transparent',
						border: `1px solid ${copied ? PHOSPHOR : PANEL_BORDER}`,
						color: copied ? PHOSPHOR : AMBER,
						fontFamily: 'inherit',
						fontSize: 10,
						padding: '3px 9px',
						borderRadius: 4,
						cursor: 'pointer'
					}}
				>
					{copied ? 'copied' : 'copy'}
				</button>
			</div>
		</>
	);
}

function ShareTab({
	json,
	maxScore
}: {
	json: AdventureJson;
	maxScore: number;
}) {
	if (!json.share) {
		return (
			<div style={{ color: DIM, fontSize: 12, lineHeight: 1.6 }}>
				No share intent configured. Enable share in the{' '}
				<span style={{ color: AMBER }}>Inspect</span> panel to preview the card
				here.
			</div>
		);
	}
	// Top-tier sample: max score + highest-minScore tier label.
	const topTier =
		(json.tiers ?? []).slice().sort((a, b) => b.minScore - a.minScore)[0]
			?.label ?? 'Player';
	const text = json.share.text
		.replace(/\$\{score\}/g, String(maxScore))
		.replace(/\$\{max\}/g, String(maxScore))
		.replace(/\$\{tier\}/g, topTier);
	const url = json.share.url
		.replace(/\$\{score\}/g, String(maxScore))
		.replace(/\$\{tier\}/g, encodeURIComponent(topTier));

	const intent = json.share.intent ?? 'x';
	const platforms: Array<{ id: string; label: string; active: boolean }> = [
		{ id: 'x', label: 'X', active: intent === 'x' || intent === 'twitter' },
		{ id: 'bluesky', label: 'Bluesky', active: intent === 'bluesky' },
		{
			id: 'mastodon',
			label: 'Mastodon',
			active: intent === 'mastodon' || intent.startsWith('mastodon:')
		}
	];

	return (
		<>
			<div
				style={{
					color: DIM,
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.16em',
					marginBottom: 8
				}}
			>
				SHARE CARD PREVIEW
			</div>
			<div
				style={{
					display: 'grid',
					gridTemplateColumns: '1fr auto',
					gap: 12
				}}
			>
				<div
					style={{
						background: VOID,
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 8,
						padding: '14px 16px'
					}}
				>
					<div
						style={{
							color: MAGENTA,
							fontSize: 10,
							fontWeight: 700,
							letterSpacing: '0.16em',
							marginBottom: 6
						}}
					>
						▶ THE FOUNDRY
					</div>
					<div
						style={{
							color: TEXT,
							fontSize: 13,
							lineHeight: 1.5,
							marginBottom: 10
						}}
					>
						{text}
					</div>
					<div
						style={{
							color: DIM,
							fontSize: 11,
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						}}
					>
						{url}
					</div>
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
					{platforms.map((p) => (
						<div
							key={p.id}
							style={{
								padding: '6px 14px',
								border: `1px solid ${p.active ? AMBER : PANEL_BORDER}`,
								color: p.active ? AMBER : DIM,
								background: p.active ? `${AMBER}11` : 'transparent',
								borderRadius: 5,
								fontSize: 11,
								textAlign: 'center'
							}}
						>
							{p.label}
						</div>
					))}
				</div>
			</div>
		</>
	);
}

function DialogFooter({
	json,
	copyState,
	onCopyWrapper
}: {
	json: AdventureJson;
	copyState: 'idle' | 'wrapper' | 'json';
	onCopyWrapper: () => void;
}) {
	return (
		<footer
			style={{
				display: 'flex',
				gap: 12,
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '14px 20px',
				borderTop: `1px solid ${PANEL_BORDER}`
			}}
		>
			<div style={{ display: 'flex', gap: 8 }}>
				<button
					onClick={() => downloadAdventure(json)}
					style={{
						background: PHOSPHOR,
						border: `1px solid ${PHOSPHOR}`,
						color: VOID,
						fontFamily: 'inherit',
						fontSize: 11,
						fontWeight: 700,
						padding: '7px 14px',
						borderRadius: 5,
						cursor: 'pointer'
					}}
				>
					↓ download adventure.json
				</button>
				<button
					onClick={onCopyWrapper}
					style={{
						background: 'transparent',
						border: `1px solid ${copyState === 'wrapper' ? PHOSPHOR : AMBER}`,
						color: copyState === 'wrapper' ? PHOSPHOR : AMBER,
						fontFamily: 'inherit',
						fontSize: 11,
						padding: '7px 14px',
						borderRadius: 5,
						cursor: 'pointer'
					}}
				>
					{copyState === 'wrapper' ? 'copied' : 'copy wrapper code'}
				</button>
			</div>
			<span style={{ color: DIM, fontSize: 10 }}>$schema prefilled</span>
		</footer>
	);
}
