/**
 * Compact per-choice gating editor — REQUIRES / CONSUMES /
 * GRANTS chip lists for a single choice. Used by both the
 * right-panel `SceneEditor` and the floating `EdgeEditor` so
 * the gating semantics stay identical across surfaces.
 *
 * Hidden entirely when the adventure has no items in its
 * catalogue -- without items to reference, the three arrays
 * would always be empty and the section would just clutter the
 * choice row.
 */
import type { AdventureJson } from 'console-adventure';
import { AMBER, DIM, MAGENTA, CYAN, PANEL_BORDER, VOID } from '../lib/theme';
import { setChoiceItemList } from '../lib/edit';

interface Props {
	json: AdventureJson;
	sceneId: string;
	choiceIndex: number;
	onJsonChange: (next: AdventureJson) => void;
}

export function ChoiceItemGating({
	json,
	sceneId,
	choiceIndex,
	onJsonChange
}: Props) {
	const itemIds = Object.keys(json.items ?? {}).sort();
	if (itemIds.length === 0) return null;

	const choice = json.scenes[sceneId]?.choices[choiceIndex];
	if (!choice) return null;

	const fields: Array<{
		key: 'requires' | 'consumes' | 'grants';
		label: string;
		hint: string;
		color: string;
	}> = [
		{
			key: 'requires',
			label: 'REQUIRES',
			hint: 'choice hidden unless player has these',
			color: CYAN
		},
		{
			key: 'consumes',
			label: 'CONSUMES',
			hint: 'removed from inventory on pick',
			color: MAGENTA
		},
		{
			key: 'grants',
			label: 'GRANTS',
			hint: 'added to inventory on pick',
			color: AMBER
		}
	];

	return (
		<div
			style={{
				border: `1px dashed ${PANEL_BORDER}`,
				borderRadius: 4,
				padding: '8px 10px',
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
				background: VOID
			}}
		>
			{fields.map(({ key, label, hint, color }) => {
				const selected = new Set(choice[key] ?? []);
				return (
					<div key={key}>
						<div
							style={{
								display: 'flex',
								alignItems: 'baseline',
								justifyContent: 'space-between',
								marginBottom: 3
							}}
						>
							<span
								style={{
									fontSize: 9,
									fontWeight: 700,
									letterSpacing: '0.1em',
									color
								}}
							>
								{label}
							</span>
							<span style={{ color: DIM, fontSize: 8 }}>{hint}</span>
						</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
							{itemIds.map((id) => {
								const on = selected.has(id);
								const name = json.items?.[id]?.name ?? id;
								return (
									<button
										key={id}
										title={`${id} — ${name}`}
										onClick={() => {
											const next = new Set(selected);
											if (on) next.delete(id);
											else next.add(id);
											onJsonChange(
												setChoiceItemList(json, sceneId, choiceIndex, key, [
													...next
												])
											);
										}}
										style={{
											background: on ? `${color}22` : 'transparent',
											color: on ? color : DIM,
											border: `1px solid ${on ? color : PANEL_BORDER}`,
											borderRadius: 10,
											padding: '1px 8px',
											fontFamily: 'inherit',
											fontSize: 9,
											cursor: 'pointer',
											letterSpacing: '0.02em',
											transition: 'background 120ms, color 120ms, border-color 120ms'
										}}
									>
										{name}
									</button>
								);
							})}
						</div>
					</div>
				);
			})}
		</div>
	);
}
