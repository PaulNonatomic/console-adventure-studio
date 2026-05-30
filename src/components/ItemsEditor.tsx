/**
 * Item catalogue editor. Sits inside AdventureEditor (the right
 * panel's adventure-level view, shown when no scene is
 * selected). Lets the author add / remove items, edit each
 * item's name + description, and configure an `onUse` effect
 * with the same shape choices use (flavour text, points, scene
 * jump, scene restriction, consume-on-use).
 *
 * Why a separate file: per-item rows have an internal collapsed
 * / expanded onUse panel, which adds enough JSX that inlining
 * it in AdventureEditor would crowd that file. The catalogue is
 * also the natural unit for future v2 work (item icons,
 * stackable items, item state) so it's worth giving it its own
 * surface from the start.
 */
import { useState } from 'react';
import type { AdventureJson, ItemDef, ItemUseEffect } from 'console-adventure';
import { Input, NumberInput, Textarea, Select, Button } from './Inputs';
import { PHOSPHOR, AMBER, DIM, CYAN, PANEL_BORDER } from '../lib/theme';
import {
	addItem,
	updateItem,
	updateItemOnUse,
	deleteItem
} from '../lib/edit';

interface Props {
	json: AdventureJson;
	onJsonChange: (next: AdventureJson) => void;
}

const sectionLabel = {
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.1em',
	color: DIM,
	marginBottom: 6,
	marginTop: 18
} as const;

export function ItemsEditor({ json, onJsonChange }: Props) {
	const entries = Object.entries(json.items ?? {});
	const sceneIds = Object.keys(json.scenes).sort();

	return (
		<>
			<div style={sectionLabel}>ITEMS</div>
			{entries.length === 0 && (
				<div style={{ color: DIM, fontSize: 10, marginBottom: 8 }}>
					No items yet — define items here, then place them in scenes from
					the scene inspector. Choices can require / consume / grant items.
				</div>
			)}
			{entries.map(([id, item]) => (
				<ItemRow
					key={id}
					itemId={id}
					item={item}
					sceneIds={sceneIds}
					onChange={(partial) => onJsonChange(updateItem(json, id, partial))}
					onOnUseChange={(patch) =>
						onJsonChange(updateItemOnUse(json, id, patch))
					}
					onDelete={() => onJsonChange(deleteItem(json, id))}
				/>
			))}
			<Button
				label="+ add item"
				color="accent"
				small
				onClick={() => {
					const { json: nextJson } = addItem(json);
					onJsonChange(nextJson);
				}}
			/>
		</>
	);
}

/* ─── per-item row ─────────────────────────────────────── */

function ItemRow({
	itemId,
	item,
	sceneIds,
	onChange,
	onOnUseChange,
	onDelete
}: {
	itemId: string;
	item: ItemDef;
	sceneIds: string[];
	onChange: (partial: Partial<ItemDef>) => void;
	onOnUseChange: (patch: Partial<ItemUseEffect> | null) => void;
	onDelete: () => void;
}) {
	const [showOnUse, setShowOnUse] = useState(item.onUse !== undefined);

	return (
		<div
			style={{
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 4,
				padding: '8px 10px',
				marginBottom: 8,
				display: 'flex',
				flexDirection: 'column',
				gap: 8
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'baseline',
					justifyContent: 'space-between'
				}}
			>
				<span style={{ fontSize: 10, color: CYAN }}>
					id <span style={{ color: PHOSPHOR }}>{itemId}</span>
				</span>
				<Button label="delete" color="danger" small onClick={onDelete} />
			</div>
			<Input
				label="NAME"
				value={item.name}
				onChange={(name) => onChange({ name })}
			/>
			<Textarea
				label="DESCRIPTION (optional)"
				value={item.description ?? ''}
				rows={2}
				onChange={(description) =>
					onChange({ description: description || undefined })
				}
			/>

			{/* onUse panel — collapsible. Default state mirrors
			    whether the item has an existing onUse, so editing
			    a flavour-only item doesn't immediately expand the
			    section. */}
			<div
				style={{
					display: 'flex',
					alignItems: 'center',
					gap: 8
				}}
			>
				<Button
					label={
						showOnUse ? 'remove onUse effect' : '+ add onUse effect'
					}
					color={showOnUse ? 'dim' : 'accent'}
					small
					onClick={() => {
						if (showOnUse) {
							onOnUseChange(null);
							setShowOnUse(false);
						} else {
							onOnUseChange({});
							setShowOnUse(true);
						}
					}}
				/>
				<span style={{ color: DIM, fontSize: 9 }}>
					What happens on `use()`
				</span>
			</div>
			{showOnUse && (
				<OnUseEditor
					effect={item.onUse ?? {}}
					sceneIds={sceneIds}
					onChange={onOnUseChange}
				/>
			)}
		</div>
	);
}

/* ─── onUse sub-editor ─────────────────────────────────── */

function OnUseEditor({
	effect,
	sceneIds,
	onChange
}: {
	effect: ItemUseEffect;
	sceneIds: string[];
	onChange: (patch: Partial<ItemUseEffect>) => void;
}) {
	const goToValue =
		effect.goTo === null
			? '__finish__'
			: effect.goTo === undefined
			? '__stay__'
			: effect.goTo;

	return (
		<div
			style={{
				border: `1px dashed ${PANEL_BORDER}`,
				borderRadius: 4,
				padding: '8px 10px',
				display: 'flex',
				flexDirection: 'column',
				gap: 8,
				background: `${AMBER}06`
			}}
		>
			<Textarea
				label="TEXT (printed on use)"
				value={effect.text ?? ''}
				rows={2}
				onChange={(text) => onChange({ text: text || undefined })}
			/>
			<div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
				<NumberInput
					label="PTS"
					value={effect.points ?? 0}
					onChange={(points) => onChange({ points })}
				/>
				<div style={{ flex: 1 }}>
					<Select
						label="GO TO"
						value={goToValue}
						options={[
							{ value: '__stay__', label: '(stay in this scene)' },
							{ value: '__finish__', label: '(finish — null)' },
							...sceneIds.map((id) => ({ value: id, label: id }))
						]}
						onChange={(v) => {
							if (v === '__stay__') onChange({ goTo: undefined });
							else if (v === '__finish__') onChange({ goTo: null });
							else onChange({ goTo: v as string });
						}}
					/>
				</div>
			</div>
			<label
				style={{
					display: 'inline-flex',
					alignItems: 'center',
					gap: 8,
					fontSize: 11,
					color: PHOSPHOR
				}}
			>
				<input
					type="checkbox"
					checked={effect.consumed ?? false}
					onChange={(e) => onChange({ consumed: e.target.checked })}
				/>
				Consumed on use (single-shot)
			</label>
			<MultiSceneSelect
				label="LIMIT TO SCENES (optional)"
				sceneIds={sceneIds}
				value={effect.inScenes ?? []}
				onChange={(ids) => onChange({ inScenes: ids.length === 0 ? undefined : ids })}
			/>
		</div>
	);
}

/* ─── tiny multi-scene picker ──────────────────────────── */

/**
 * Chip-style multi-select for a list of scene ids. A row of
 * toggle pills per scene; tap to add / remove. Compact enough
 * to inline inside an onUse panel without taking too much room.
 */
function MultiSceneSelect({
	label,
	sceneIds,
	value,
	onChange
}: {
	label: string;
	sceneIds: string[];
	value: string[];
	onChange: (ids: string[]) => void;
}) {
	const selected = new Set(value);
	return (
		<div>
			<div
				style={{
					fontSize: 9,
					fontWeight: 700,
					letterSpacing: '0.1em',
					color: DIM,
					marginBottom: 4
				}}
			>
				{label}
			</div>
			{sceneIds.length === 0 && (
				<div style={{ color: DIM, fontSize: 10 }}>(no scenes)</div>
			)}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
				{sceneIds.map((id) => {
					const on = selected.has(id);
					return (
						<button
							key={id}
							onClick={() => {
								const next = new Set(selected);
								if (on) next.delete(id);
								else next.add(id);
								onChange([...next]);
							}}
							style={{
								background: on ? `${PHOSPHOR}22` : 'transparent',
								color: on ? PHOSPHOR : DIM,
								border: `1px solid ${on ? PHOSPHOR : PANEL_BORDER}`,
								borderRadius: 10,
								padding: '2px 9px',
								fontFamily: 'inherit',
								fontSize: 10,
								cursor: 'pointer',
								letterSpacing: '0.02em',
								transition: 'background 120ms, color 120ms, border-color 120ms'
							}}
						>
							{id}
						</button>
					);
				})}
			</div>
		</div>
	);
}
