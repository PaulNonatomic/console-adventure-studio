/**
 * Right-hand inspector panel — shows the full details of the
 * currently selected scene (or the finish node). Falls back to
 * a stats summary when nothing is selected.
 */
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	MAGENTA,
	CYAN,
	TEXT,
	DIM
} from '../lib/theme';
import type { AdventureJson } from 'console-adventure';

interface Props {
	json: AdventureJson;
	maxScore: number;
	selectedSceneId: string | null;
}

const sectionLabel = {
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.1em',
	color: DIM,
	marginBottom: 6
} as const;

export function ScenePanel({ json, maxScore, selectedSceneId }: Props) {
	const scene = selectedSceneId ? json.scenes[selectedSceneId] : null;

	return (
		<aside
			style={{
				width: 360,
				background: PANEL,
				borderLeft: `1px solid ${PANEL_BORDER}`,
				color: TEXT,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				display: 'flex',
				flexDirection: 'column',
				overflow: 'hidden'
			}}
		>
			<div
				style={{
					padding: '14px 18px',
					borderBottom: `1px solid ${PANEL_BORDER}`,
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'baseline'
				}}
			>
				<span
					style={{
						color: PHOSPHOR,
						fontWeight: 700,
						fontSize: 13,
						letterSpacing: '0.05em'
					}}
				>
					{selectedSceneId ? '~/scene' : '~/adventure'}
				</span>
				<span style={{ color: DIM, fontSize: 10 }}>
					{scene
						? `${scene.choices.length} choice${scene.choices.length === 1 ? '' : 's'}`
						: `${Object.keys(json.scenes).length} scenes`}
				</span>
			</div>

			<div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }}>
				{scene ? (
					<SceneDetail sceneId={selectedSceneId!} scene={scene} />
				) : (
					<AdventureStats json={json} maxScore={maxScore} />
				)}
			</div>
		</aside>
	);
}

function SceneDetail({
	sceneId,
	scene
}: {
	sceneId: string;
	scene: AdventureJson['scenes'][string];
}) {
	return (
		<>
			<div style={sectionLabel}>ID</div>
			<div style={{ color: CYAN, fontSize: 12, marginBottom: 12 }}>{sceneId}</div>

			<div style={sectionLabel}>HEADING</div>
			<div style={{ color: PHOSPHOR, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>
				{scene.heading}
			</div>

			<div style={sectionLabel}>NARRATION</div>
			<div
				style={{
					color: TEXT,
					fontSize: 11,
					lineHeight: 1.6,
					marginBottom: 16,
					whiteSpace: 'pre-wrap'
				}}
			>
				{scene.narration.join('\n')}
			</div>

			<div style={sectionLabel}>CHOICES</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
				{scene.choices.map((c, i) => (
					<div
						key={i}
						style={{
							border: `1px solid ${PANEL_BORDER}`,
							borderRadius: 6,
							padding: '8px 10px'
						}}
					>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								marginBottom: 4
							}}
						>
							<span style={{ color: AMBER, fontWeight: 600, fontSize: 11 }}>
								{i + 1}) {c.label}
							</span>
							{c.points !== undefined && (
								<span style={{ color: PHOSPHOR, fontWeight: 700, fontSize: 11 }}>
									+{c.points}
								</span>
							)}
						</div>
						{c.flavour && (
							<div
								style={{
									color: DIM,
									fontSize: 10,
									lineHeight: 1.5,
									fontStyle: 'italic',
									marginBottom: 4
								}}
							>
								▶ {c.flavour}
							</div>
						)}
						<div style={{ color: CYAN, fontSize: 9 }}>
							→ {c.next === null ? <span style={{ color: MAGENTA }}>FINISH</span> : c.next}
						</div>
					</div>
				))}
			</div>
		</>
	);
}

function AdventureStats({
	json,
	maxScore
}: {
	json: AdventureJson;
	maxScore: number;
}) {
	const sceneCount = Object.keys(json.scenes).length;
	const choiceCount = Object.values(json.scenes).reduce(
		(n, s) => n + s.choices.length,
		0
	);
	const terminalChoices = Object.values(json.scenes).reduce(
		(n, s) => n + s.choices.filter((c) => c.next === null).length,
		0
	);

	return (
		<>
			<div style={{ color: DIM, fontSize: 11, marginBottom: 16, lineHeight: 1.6 }}>
				Click a scene to inspect it. Click the canvas to come back to this
				summary.
			</div>

			<StatRow label="Start scene" value={json.start} color={CYAN} />
			<StatRow label="Scenes" value={String(sceneCount)} />
			<StatRow label="Choices" value={String(choiceCount)} />
			<StatRow label="Terminal choices" value={String(terminalChoices)} />
			<StatRow label="Max score" value={String(maxScore)} color={PHOSPHOR} />

			{json.tiers && (
				<>
					<div style={{ ...sectionLabel, marginTop: 20 }}>TIERS</div>
					{[...json.tiers]
						.sort((a, b) => b.minScore - a.minScore)
						.map((t) => (
							<StatRow key={t.label} label={`${t.minScore}+`} value={t.label} />
						))}
				</>
			)}

			{json.share && (
				<>
					<div style={{ ...sectionLabel, marginTop: 20 }}>SHARE</div>
					<div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>text</div>
					<div
						style={{
							color: TEXT,
							fontSize: 10,
							lineHeight: 1.5,
							marginBottom: 8,
							wordBreak: 'break-word'
						}}
					>
						{json.share.text}
					</div>
					<div style={{ color: DIM, fontSize: 10, marginBottom: 4 }}>url</div>
					<div
						style={{
							color: CYAN,
							fontSize: 10,
							lineHeight: 1.5,
							wordBreak: 'break-all'
						}}
					>
						{json.share.url}
					</div>
				</>
			)}
		</>
	);
}

function StatRow({
	label,
	value,
	color = TEXT
}: {
	label: string;
	value: string;
	color?: string;
}) {
	return (
		<div
			style={{
				display: 'flex',
				justifyContent: 'space-between',
				marginBottom: 6,
				fontSize: 11
			}}
		>
			<span style={{ color: DIM }}>{label}</span>
			<span style={{ color, fontWeight: 600 }}>{value}</span>
		</div>
	);
}
