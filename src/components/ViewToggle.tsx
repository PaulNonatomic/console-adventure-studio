/**
 * Segmented control for the top-level view mode. Sits in a
 * thin sub-bar beneath the main Toolbar so it's always
 * available but never gets in the way of the load / save / ship
 * actions in the toolbar proper.
 *
 * The control is intentionally compact (three small buttons,
 * monospace) so it reads as a developer-tool affordance rather
 * than a brand element. Lime / amber highlighting only on the
 * active segment.
 */
import { PANEL, PANEL_BORDER, PHOSPHOR, DIM, AMBER } from '../lib/theme';
import type { ViewMode } from '../lib/viewMode';

interface Props {
	mode: ViewMode;
	onChange: (m: ViewMode) => void;
}

const ITEMS: Array<{ value: ViewMode; label: string; hint: string }> = [
	{ value: 'graph', label: 'graph', hint: 'Node graph canvas (the existing view)' },
	{
		value: 'write',
		label: 'write',
		hint: 'Script view — write the adventure as a document'
	},
	{ value: 'split', label: 'split', hint: 'Graph + script side by side' }
];

export function ViewToggle({ mode, onChange }: Props) {
	return (
		<div
			role="tablist"
			aria-label="View mode"
			style={{
				display: 'inline-flex',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 5,
				overflow: 'hidden',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: 11
			}}
		>
			{ITEMS.map((item) => {
				const active = item.value === mode;
				return (
					<button
						key={item.value}
						role="tab"
						aria-selected={active}
						title={item.hint}
						onClick={() => onChange(item.value)}
						style={{
							background: active ? `${PHOSPHOR}22` : 'transparent',
							color: active ? PHOSPHOR : DIM,
							border: 'none',
							borderRight:
								item.value === 'split' ? 'none' : `1px solid ${PANEL_BORDER}`,
							padding: '4px 10px',
							fontFamily: 'inherit',
							fontSize: 11,
							fontWeight: active ? 700 : 500,
							cursor: 'pointer',
							transition: 'background 120ms, color 120ms'
						}}
						onMouseEnter={(e) => {
							if (!active) e.currentTarget.style.color = AMBER;
						}}
						onMouseLeave={(e) => {
							if (!active) e.currentTarget.style.color = DIM;
						}}
					>
						{item.label}
					</button>
				);
			})}
			{/* spacer — keeps spacing consistent against neighbours */}
			<span style={{ display: 'none', color: PANEL }} />
		</div>
	);
}
