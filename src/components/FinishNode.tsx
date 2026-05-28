/**
 * Custom React Flow node for the synthetic "finish" terminus.
 *
 * Shown only when at least one choice has `next: null`. Renders
 * the tier table (when present) so the reader sees what each
 * score range resolves to. Visually distinct from scene nodes
 * — magenta border, "FINISH" header.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MAGENTA, PHOSPHOR, AMBER, TEXT, DIM, PANEL } from '../lib/theme';
import type { FinishNodeData } from '../lib/graph';
import { colorForTierSlot } from '../lib/theme';

export function FinishNode({ data }: NodeProps) {
	const d = data as FinishNodeData;
	return (
		<div
			style={{
				background: PANEL,
				border: `2px solid ${MAGENTA}`,
				borderRadius: 10,
				padding: '12px 16px',
				width: 260,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				color: TEXT,
				boxShadow: `0 0 24px ${MAGENTA}22`
			}}
		>
			<Handle type="target" position={Position.Top} style={{ background: MAGENTA }} />

			<div
				style={{
					color: MAGENTA,
					fontWeight: 700,
					fontSize: 14,
					letterSpacing: '0.15em',
					textAlign: 'center',
					marginBottom: 6
				}}
			>
				FINISH
			</div>
			<div
				style={{
					color: DIM,
					fontSize: 10,
					textAlign: 'center',
					marginBottom: 12
				}}
			>
				max score · <span style={{ color: PHOSPHOR, fontWeight: 700 }}>{d.maxScore}</span>
			</div>

			{d.tiers && d.tiers.length > 0 && (
				<>
					<div
						style={{
							fontSize: 9,
							fontWeight: 700,
							letterSpacing: '0.1em',
							color: DIM,
							marginBottom: 4
						}}
					>
						TIERS
					</div>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
						{[...d.tiers]
							.sort((a, b) => b.minScore - a.minScore)
							.map((t) => (
								<div
									key={t.label}
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										fontSize: 11,
										lineHeight: 1.4
									}}
								>
									<span style={{ color: AMBER }}>{t.minScore}+</span>
									<span
										style={{
											color: colorForTierSlot(t.color),
											fontWeight: 600
										}}
									>
										{t.label}
									</span>
								</div>
							))}
					</div>
				</>
			)}
		</div>
	);
}
