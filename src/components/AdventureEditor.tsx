/**
 * Editable adventure-level panel. Shown in the inspector when
 * no scene is selected. Lets the author change the start
 * scene, edit the tier table, toggle and edit the share
 * config, and trigger structural actions (add scene, export
 * the whole JSON).
 */
import type { AdventureJson } from 'console-adventure';
import {
	PHOSPHOR,
	DIM,
	TEXT,
	PANEL_BORDER,
	THEME_COLOR_SLOTS,
	colorForTierSlot
} from '../lib/theme';
import { Input, NumberInput, Textarea, Select, Button } from './Inputs';
import { downloadAdventure, copyAdventureToClipboard } from '../lib/exportAdventure';
import {
	setStart,
	addScene,
	addTier,
	deleteTier,
	updateTier,
	toggleShare,
	updateShare
} from '../lib/edit';

interface Props {
	json: AdventureJson;
	maxScore: number;
	onJsonChange: (next: AdventureJson, opts?: { remount?: boolean }) => void;
	onSelectScene: (id: string | null) => void;
}

const sectionLabel = {
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.1em',
	color: DIM,
	marginBottom: 6,
	marginTop: 18
} as const;

// Derived from console-shell's `ThemeColor` slot list. Adding a
// new slot in the upstream type automatically lights it up as
// an option here without any change to this file.
const SLOT_HINTS: Record<string, string> = {
	primary: 'lime',
	accent: 'amber',
	danger: 'magenta',
	info: 'cyan',
	text: 'off-white',
	dim: 'grey'
};
const tierColorOptions = THEME_COLOR_SLOTS.map((slot) => ({
	value: slot,
	label: `${slot} (${SLOT_HINTS[slot] ?? colorForTierSlot(slot)})`
}));

const intentOptions: Array<{ value: string; label: string }> = [
	{ value: 'x', label: 'X (twitter)' },
	{ value: 'bluesky', label: 'Bluesky' },
	{ value: 'mastodon', label: 'Mastodon (mastodon.social)' }
];

export function AdventureEditor({ json, maxScore, onJsonChange, onSelectScene }: Props) {
	const sceneIds = Object.keys(json.scenes).sort();

	return (
		<>
			<div style={{ color: DIM, fontSize: 11, marginBottom: 12, lineHeight: 1.6 }}>
				Click a scene in the graph to edit it. Add new scenes here, set the
				start, configure tiers and the share intent, or export the whole JSON.
			</div>

			<div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
				<Button
					label="+ add scene"
					color="primary"
					onClick={() => {
						const { json: nextJson, id } = addScene(json);
						onJsonChange(nextJson);
						onSelectScene(id);
					}}
				/>
			</div>

			<div style={sectionLabel}>START</div>
			<Select
				value={json.start}
				options={sceneIds.map((id) => ({ value: id, label: id }))}
				onChange={(id) =>
					onJsonChange(setStart(json, id as string), { remount: true })
				}
			/>

			<div style={sectionLabel}>STATS</div>
			<StatRow label="scenes" value={String(sceneIds.length)} />
			<StatRow
				label="choices"
				value={String(
					Object.values(json.scenes).reduce((n, s) => n + s.choices.length, 0)
				)}
			/>
			<StatRow label="max score" value={String(maxScore)} color={PHOSPHOR} />

			<div style={sectionLabel}>TIERS</div>
			{(!json.tiers || json.tiers.length === 0) && (
				<div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>
					No tiers yet — without a tier table the finish screen just
					shows the raw score.
				</div>
			)}
			{json.tiers?.map((t, i) => (
				<div
					key={i}
					style={{
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 4,
						padding: '8px 10px',
						marginBottom: 8,
						display: 'flex',
						flexDirection: 'column',
						gap: 6
					}}
				>
					<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
						<NumberInput
							label="MIN"
							value={t.minScore}
							onChange={(minScore) => onJsonChange(updateTier(json, i, { minScore }))}
						/>
						<div style={{ flex: 1 }}>
							<Input
								label="LABEL"
								value={t.label}
								onChange={(label) => onJsonChange(updateTier(json, i, { label }))}
							/>
						</div>
					</div>
					<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
						<div style={{ flex: 1 }}>
							<Select
								label="COLOUR"
								value={t.color ?? 'primary'}
								options={tierColorOptions}
								onChange={(color) => onJsonChange(updateTier(json, i, { color }))}
							/>
						</div>
						<Button
							label="delete"
							color="danger"
							small
							onClick={() => onJsonChange(deleteTier(json, i))}
						/>
					</div>
				</div>
			))}
			<Button
				label="+ add tier"
				color="accent"
				small
				onClick={() => onJsonChange(addTier(json))}
			/>

			<div style={sectionLabel}>SHARE</div>
			<div style={{ marginBottom: 8 }}>
				<Button
					label={json.share ? 'remove share intent' : '+ enable share intent'}
					color={json.share ? 'dim' : 'accent'}
					small
					onClick={() => onJsonChange(toggleShare(json, !json.share))}
				/>
			</div>
			{json.share && (
				<>
					<Textarea
						label="TEXT (${score} ${max} ${tier})"
						value={json.share.text}
						rows={3}
						onChange={(text) => onJsonChange(updateShare(json, { text }))}
					/>
					<Input
						label="URL (${score} ${tier})"
						value={json.share.url}
						onChange={(url) => onJsonChange(updateShare(json, { url }))}
					/>
					<Select
						label="INTENT"
						value={json.share.intent ?? 'x'}
						options={intentOptions}
						onChange={(intent) =>
							onJsonChange(updateShare(json, { intent: intent as 'x' | 'bluesky' | 'mastodon' }))
						}
					/>
				</>
			)}

			<div
				style={{
					marginTop: 28,
					paddingTop: 14,
					borderTop: `1px solid ${PANEL_BORDER}`,
					display: 'flex',
					gap: 8
				}}
			>
				<Button label="export json" color="primary" onClick={() => exportJson(json)} />
				<Button
					label="copy to clipboard"
					color="accent"
					onClick={() => copyJson(json)}
				/>
			</div>

			<div style={{ marginTop: 8, color: DIM, fontSize: 9, lineHeight: 1.5 }}>
				DFS max-score is live ({maxScore} pts). All edits update the graph,
				the playtest, and this panel in real time.
			</div>
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

// Wire-format serialisation + browser download + clipboard
// copy live in `lib/exportAdventure.ts` — single source of
// truth so the same `$schema` URL is used by both this panel
// and the ship dialog. The two functions below stay as
// no-args wrappers for the existing button onClick handlers.
function exportJson(json: AdventureJson) {
	downloadAdventure(json);
}

function copyJson(json: AdventureJson) {
	void copyAdventureToClipboard(json);
}
