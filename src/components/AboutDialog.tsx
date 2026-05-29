/**
 * Modal shown from the Toolbar ⋯ → About row. Pulls the build
 * tag + build time out of the Vite-injected globals (the same
 * values the menu's right-side hint shows in compact form) and
 * surfaces them with a readable wordmark + repo link.
 *
 * Visually a thinner sibling of the other dialogs in the studio
 * (ConfirmDialog / InputDialog / ShipDialog) -- PANEL on a
 * VOID-tinted backdrop, Esc + backdrop-click both close.
 */
import { useEffect, useRef } from 'react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, CYAN, DIM, TEXT, VOID } from '../lib/theme';

interface Props {
	onClose: () => void;
}

const REPO_URL = 'https://github.com/PaulNonatomic/console-adventure-studio';

export function AboutDialog({ onClose }: Props) {
	const previousFocusRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		previousFocusRef.current = document.activeElement as HTMLElement | null;
		return () => {
			previousFocusRef.current?.focus?.();
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [onClose]);

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="about-dialog-title"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
			style={{
				position: 'fixed',
				inset: 0,
				background: `${VOID}cc`,
				zIndex: 100,
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				style={{
					width: 'min(440px, 92vw)',
					background: PANEL,
					border: `1px solid ${PHOSPHOR}`,
					borderRadius: 11,
					boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 22px 60px #000000cc`,
					color: TEXT,
					padding: '22px 24px 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: 14
				}}
			>
				<div
					id="about-dialog-title"
					style={{
						display: 'flex',
						alignItems: 'baseline',
						gap: 12,
						flexWrap: 'wrap'
					}}
				>
					<span
						style={{
							color: PHOSPHOR,
							fontSize: 14,
							fontWeight: 700,
							letterSpacing: '0.04em'
						}}
					>
						console-adventure-studio
					</span>
					<span style={{ color: DIM, fontSize: 10 }}>
						build <span style={{ color: AMBER }}>{__BUILD_TAG__}</span>
					</span>
				</div>

				<div style={{ color: TEXT, fontSize: 12, lineHeight: 1.6 }}>
					A visual editor for branching <span style={{ color: AMBER }}>console-adventure</span> narratives.
					Build the graph, playtest live, ship a validated JSON.
				</div>

				<div
					style={{
						background: VOID,
						border: `1px solid ${PANEL_BORDER}`,
						borderRadius: 6,
						padding: '10px 12px',
						display: 'flex',
						flexDirection: 'column',
						gap: 6,
						fontSize: 11
					}}
				>
					<KV label="Build" value={__BUILD_TAG__} valueColor={AMBER} />
					<KV label="Built" value={__BUILD_TIME__} valueColor={DIM} />
					<KV
						label="Repo"
						value={
							<a
								href={REPO_URL}
								target="_blank"
								rel="noreferrer"
								style={{
									color: CYAN,
									textDecoration: 'none',
									borderBottom: `1px dashed ${CYAN}66`
								}}
							>
								{REPO_URL.replace('https://', '')}
							</a>
						}
						valueColor={CYAN}
					/>
				</div>

				<div
					style={{
						display: 'flex',
						justifyContent: 'flex-end',
						marginTop: 4
					}}
				>
					<button
						onClick={onClose}
						style={{
							background: 'transparent',
							color: AMBER,
							border: `1px solid ${AMBER}`,
							borderRadius: 5,
							padding: '6px 14px',
							fontFamily: 'inherit',
							fontSize: 11,
							cursor: 'pointer',
							transition: 'background 120ms'
						}}
						onMouseEnter={(e) =>
							(e.currentTarget.style.background = `${AMBER}11`)
						}
						onMouseLeave={(e) =>
							(e.currentTarget.style.background = 'transparent')
						}
					>
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

function KV({
	label,
	value,
	valueColor
}: {
	label: string;
	value: React.ReactNode;
	valueColor: string;
}) {
	return (
		<div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
			<span style={{ color: DIM, letterSpacing: '0.06em' }}>{label}</span>
			<span style={{ color: valueColor, textAlign: 'right' }}>{value}</span>
		</div>
	);
}
