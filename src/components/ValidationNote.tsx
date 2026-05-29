/**
 * Small floating chip in the canvas that summarises validation
 * issues -- unreachable scenes, dead ends, missing targets.
 *
 * Mirrors the per-node badges (UNREACHABLE / DEAD END / MISSING
 * TARGET) but at the graph level, so the author sees at a
 * glance "this script has N issues" without having to scan
 * every node. Clicking opens the Ship dialog, which already
 * carries a full validation panel with jump-to-scene links.
 *
 * Hidden when the validation is clean. Positioned bottom-right
 * of the canvas, above the "show inline editor" restore chip
 * that pops in the same area, so neither stomps on the other.
 */
import type { Validation } from '../lib/validate';
import { MAGENTA, PANEL, DIM } from '../lib/theme';

interface Props {
	validation: Validation;
	onOpenShipDialog: () => void;
}

export function ValidationNote({ validation, onOpenShipDialog }: Props) {
	const issueCount =
		validation.unreachable.length +
		validation.deadEnds.length +
		validation.missingTargets.length;
	if (issueCount === 0) return null;

	// Summarise the first issue inline so the chip is
	// informative at a glance. Plural variant when more than
	// one issue is present.
	const firstIssue =
		validation.unreachable[0] ??
		validation.deadEnds[0] ??
		validation.missingTargets[0]?.scene ??
		null;
	const summary =
		issueCount === 1 && firstIssue
			? firstIssue
			: `${issueCount} issues`;

	return (
		<button
			onClick={onOpenShipDialog}
			title="Open the ship dialog for the full validation report"
			style={{
				position: 'absolute',
				bottom: 16,
				right: 16,
				background: PANEL,
				color: MAGENTA,
				border: `1px solid ${MAGENTA}`,
				borderRadius: 14,
				padding: '5px 11px',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: 10,
				cursor: 'pointer',
				letterSpacing: '0.05em',
				display: 'flex',
				alignItems: 'center',
				gap: 6,
				boxShadow: `0 4px 16px ${MAGENTA}33`,
				transition: 'background 120ms'
			}}
			onMouseEnter={(e) => (e.currentTarget.style.background = `${MAGENTA}11`)}
			onMouseLeave={(e) => (e.currentTarget.style.background = PANEL)}
		>
			<span style={{ fontSize: 11 }}>⚠</span>
			<span style={{ fontWeight: 700 }}>{summary}</span>
			<span style={{ color: DIM, fontSize: 9 }}>· click to review</span>
		</button>
	);
}
