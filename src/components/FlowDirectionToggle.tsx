/**
 * Compact horizontal / vertical toggle for the graph flow
 * direction. Matches ViewToggle's segmented look so the two
 * controls read as a pair in the sub-bar.
 */
import { PANEL_BORDER, PHOSPHOR, DIM, AMBER } from '../lib/theme';
import type { FlowDirection } from '../lib/flowDirection';

interface Props {
	direction: FlowDirection;
	onChange: (d: FlowDirection) => void;
}

const ITEMS: Array<{ value: FlowDirection; label: string; hint: string }> = [
	{
		value: 'horizontal',
		label: '→',
		hint: 'Horizontal flow — layers left to right'
	},
	{
		value: 'vertical',
		label: '↓',
		hint: 'Vertical flow — layers top to bottom (legacy)'
	}
];

export function FlowDirectionToggle({ direction, onChange }: Props) {
	return (
		<div
			role="tablist"
			aria-label="Flow direction"
			style={{
				display: 'inline-flex',
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 5,
				overflow: 'hidden',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: 12
			}}
		>
			{ITEMS.map((item) => {
				const active = item.value === direction;
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
								item.value === 'vertical' ? 'none' : `1px solid ${PANEL_BORDER}`,
							padding: '3px 9px',
							fontFamily: 'inherit',
							fontSize: 12,
							fontWeight: active ? 700 : 500,
							cursor: 'pointer',
							lineHeight: 1,
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
		</div>
	);
}
