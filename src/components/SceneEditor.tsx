/**
 * Editable scene panel. Replaces the read-only SceneDetail —
 * every field is an input, and Add Choice / Delete Choice /
 * Delete Scene buttons mutate the adventure via the helpers
 * in lib/edit.ts.
 *
 * The narration array is rendered as a single textarea; lines
 * separated by `\n` become array entries on save. That keeps
 * the editor simple at the cost of not letting an author
 * intentionally include literal newlines inside a single
 * narration line — fine for the choice-based-narrative domain
 * we're targeting.
 */
import type { AdventureJson } from 'console-adventure';
import { PHOSPHOR, AMBER, MAGENTA, CYAN, DIM, PANEL_BORDER } from '../lib/theme';
import { Input, NumberInput, Textarea, Select, Button } from './Inputs';
import {
	updateScene,
	updateChoice,
	addChoice,
	deleteChoice,
	deleteScene
} from '../lib/edit';
import { useConfirm } from '../lib/confirm';

interface Props {
	json: AdventureJson;
	sceneId: string;
	onJsonChange: (next: AdventureJson) => void;
	onSelectScene: (id: string | null) => void;
}

const sectionLabel = {
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.1em',
	color: DIM,
	marginBottom: 6,
	marginTop: 14
} as const;

export function SceneEditor({ json, sceneId, onJsonChange, onSelectScene }: Props) {
	const confirm = useConfirm();
	const scene = json.scenes[sceneId];
	if (!scene) return null;

	const isStart = json.start === sceneId;
	const canDelete = !isStart;
	const sceneOptions: Array<{ value: string | null; label: string }> = [
		{ value: null, label: '(finish — null)' },
		...Object.keys(json.scenes)
			.sort()
			.map((id) => ({ value: id as string | null, label: id }))
	];

	return (
		<>
			<div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
				<span style={{ color: CYAN, fontSize: 10 }}>
					id <span style={{ color: PHOSPHOR }}>{sceneId}</span>
					{isStart && (
						<span
							style={{
								color: MAGENTA,
								marginLeft: 8,
								fontWeight: 700,
								letterSpacing: '0.1em',
								fontSize: 9
							}}
						>
							· START
						</span>
					)}
				</span>
			</div>

			<Input
				label="HEADING"
				value={scene.heading}
				onChange={(heading) => onJsonChange(updateScene(json, sceneId, { heading }))}
			/>

			<Textarea
				label="NARRATION (one line per array entry)"
				value={scene.narration.join('\n')}
				rows={4}
				onChange={(text) =>
					onJsonChange(updateScene(json, sceneId, { narration: text.split('\n') }))
				}
			/>

			<div style={sectionLabel}>CHOICES</div>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
				{scene.choices.map((c, i) => (
					<div
						key={i}
						style={{
							border: `1px solid ${PANEL_BORDER}`,
							borderRadius: 6,
							padding: '10px 12px',
							display: 'flex',
							flexDirection: 'column',
							gap: 8
						}}
					>
						<div
							style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center'
							}}
						>
							<span style={{ color: AMBER, fontWeight: 700, fontSize: 11 }}>
								{i + 1})
							</span>
							<Button
								label="delete"
								color="danger"
								small
								onClick={() => onJsonChange(deleteChoice(json, sceneId, i))}
							/>
						</div>
						<Input
							label="LABEL"
							value={c.label}
							onChange={(label) =>
								onJsonChange(updateChoice(json, sceneId, i, { label }))
							}
						/>
						<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
							<NumberInput
								label="PTS"
								value={c.points ?? 0}
								onChange={(points) =>
									onJsonChange(updateChoice(json, sceneId, i, { points }))
								}
							/>
							<div style={{ flex: 1 }}>
								<Select
									label="NEXT"
									value={c.next}
									options={sceneOptions}
									onChange={(next) =>
										onJsonChange(updateChoice(json, sceneId, i, { next }))
									}
								/>
							</div>
						</div>
						{/* "Reaction" is what the player sees right after
						    picking this choice -- the engine API field is
						    `flavour` (from tabletop's "flavour text"), but
						    that name isn't obvious in an authoring UI, so
						    the label is renamed here for the author. */}
						<Textarea
							label="REACTION (shown after the choice)"
							value={c.flavour ?? ''}
							rows={2}
							onChange={(flavour) =>
								onJsonChange(updateChoice(json, sceneId, i, { flavour: flavour || undefined }))
							}
						/>
					</div>
				))}
			</div>

			<div style={{ marginTop: 12 }}>
				<Button
					label="+ add choice"
					color="primary"
					onClick={() => onJsonChange(addChoice(json, sceneId))}
				/>
			</div>

			<div
				style={{
					marginTop: 28,
					paddingTop: 14,
					borderTop: `1px solid ${PANEL_BORDER}`
				}}
			>
				<Button
					label={canDelete ? 'delete scene' : 'delete scene (set start first)'}
					color={canDelete ? 'danger' : 'dim'}
					onClick={async () => {
						if (!canDelete) return;
						const ok = await confirm({
							title: 'Delete scene',
							message: (
								<>
									Delete scene <strong>{sceneId}</strong>? Any choices pointing
									here will be rewired to <strong>finish</strong> (null).
								</>
							),
							confirmLabel: 'Delete',
							tone: 'danger'
						});
						if (ok) {
							onJsonChange(deleteScene(json, sceneId));
							onSelectScene(null);
						}
					}}
				/>
			</div>
		</>
	);
}
