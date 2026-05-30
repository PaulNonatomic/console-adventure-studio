/**
 * Guided tour (Move 01 follow-up) — 4-step coachmark sequence
 * pointing at the studio's core surfaces. Triggered by the boot
 * overlay's "Take the tour" choice, or re-launched from the
 * Toolbar ⋯ → "Help / tour" menu item.
 *
 * Per-step rendering:
 *   - The target element gets a phosphor outline + soft glow,
 *     drawn as a fixed-position div sized to its bounding rect.
 *     This is purely visual; the target's own DOM is untouched.
 *   - A tooltip card sits adjacent to the target (below by
 *     default, flipping to above when there isn't viewport
 *     room). Carries a step counter, title, body copy, and
 *     "Skip" / "Next" / "Finish" actions.
 *
 * Position tracking: a window-level `resize` + scroll listener
 * + a `requestAnimationFrame` driven recalculation on each
 * step change, so the coachmark stays pinned to its target as
 * the user resizes / scrolls. Targets are looked up via
 * `data-tour` attributes — components opt in by tagging the
 * element they want pointed at.
 *
 * Persistence: completion (Next on the last step) or Skip
 * sets `cas:tourSeen` in localStorage so the tour doesn't
 * auto-trigger on subsequent boot-overlay tours. The menu
 * entry deliberately clears the flag and re-launches so the
 * user can replay it on demand.
 */
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useState,
	type CSSProperties
} from 'react';
import { createPortal } from 'react-dom';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, CYAN, DIM, TEXT, VOID } from '../lib/theme';

const STORAGE_KEY = 'cas:tourSeen';

/** Step definitions. Edit order or copy here in one place. */
interface TourStep {
	selector: string;
	title: string;
	body: string;
	/** Which side of the target the tooltip prefers. Falls back if no room. */
	prefer?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: TourStep[] = [
	{
		selector: '[data-tour="scene-node"]',
		title: 'Scenes are nodes',
		body: 'Each card is one scene. Click a scene to open an inline editor right next to it — change heading, narration, choices. Drag the ⠿ grip to reorder choices; drag the right-edge handle to wire a choice to another scene.',
		prefer: 'right'
	},
	{
		selector: '[data-tour="right-panel"]',
		title: 'Inspect & Play',
		body: 'The right panel hosts the full scene inspector (more spacious than the inline editor) and a live playtest terminal. Switching tabs never resets the playtest.',
		prefer: 'left'
	},
	{
		selector: '[data-tour="play-tab"]',
		title: 'Test as you write',
		body: 'Click Play to run the adventure end-to-end. The graph lights up to mirror the live run — current scene glows cyan, visited scenes dim, the taken path goes cyan.',
		prefer: 'bottom'
	},
	{
		selector: '[data-tour="ship-button"]',
		title: 'Ship the JSON',
		body: 'When you\'re happy, Ship validates the adventure and downloads the JSON, ready to drop into a console-adventure project.',
		prefer: 'bottom'
	}
];

export function hasSeenTour(): boolean {
	try {
		return localStorage.getItem(STORAGE_KEY) === 'true';
	} catch {
		return false;
	}
}

export function markTourSeen(): void {
	try {
		localStorage.setItem(STORAGE_KEY, 'true');
	} catch {
		// Silently no-op; the tour is non-critical.
	}
}

export function clearTourSeen(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// Silently no-op.
	}
}

interface Props {
	onClose: () => void;
}

interface AnchorRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

const TOOLTIP_WIDTH = 320;
// Offset must clear the highlight halo (HALO = 14 inside Tour
// below) plus a few px of breathing room, otherwise the
// tooltip's edge touches the highlight outline.
const TOOLTIP_OFFSET = 22;
const VIEWPORT_MARGIN = 16;

export function Tour({ onClose }: Props) {
	const [stepIndex, setStepIndex] = useState(0);
	const [anchor, setAnchor] = useState<AnchorRect | null>(null);
	const step = STEPS[stepIndex];

	const measure = useCallback(() => {
		if (!step) return;
		const el = document.querySelector<HTMLElement>(step.selector);
		if (!el) {
			setAnchor(null);
			return;
		}
		const rect = el.getBoundingClientRect();
		setAnchor({
			x: rect.left,
			y: rect.top,
			width: rect.width,
			height: rect.height
		});
	}, [step]);

	// Re-measure on step change, window resize, and scroll.
	// We use rAF on each "tick" event rather than measuring
	// synchronously — that way React Flow's transition
	// animations (which fire many resize events in quick
	// succession) still land on the final position rather than
	// the in-flight one.
	useLayoutEffect(() => {
		let raf = requestAnimationFrame(measure);
		const onTick = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(measure);
		};
		window.addEventListener('resize', onTick);
		window.addEventListener('scroll', onTick, true);
		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', onTick);
			window.removeEventListener('scroll', onTick, true);
		};
	}, [measure]);

	// Esc skips the tour; ← / → walk between steps.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				handleSkip();
				return;
			}
			if (e.key === 'ArrowRight') {
				e.preventDefault();
				handleNext();
				return;
			}
			if (e.key === 'ArrowLeft' && stepIndex > 0) {
				e.preventDefault();
				setStepIndex(stepIndex - 1);
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
		// handlers close over stepIndex; the listener rebinds
		// when it changes so each step's Right-arrow advances
		// correctly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [stepIndex]);

	const handleSkip = () => {
		markTourSeen();
		onClose();
	};
	const handleNext = () => {
		if (stepIndex === STEPS.length - 1) {
			markTourSeen();
			onClose();
		} else {
			setStepIndex(stepIndex + 1);
		}
	};

	// Highlight rectangle around the target. Padded out so the
	// outline breathes around the target instead of hugging it
	// flush -- a 14px halo around a scene node reads as "look
	// here," whereas a tight outline reads as a re-selection.
	const HALO = 14;
	const highlightStyle: CSSProperties | null = anchor
		? {
				position: 'fixed',
				left: anchor.x - HALO,
				top: anchor.y - HALO,
				width: anchor.width + HALO * 2,
				height: anchor.height + HALO * 2,
				border: `2px solid ${PHOSPHOR}`,
				borderRadius: 14,
				boxShadow: `0 0 0 6px ${PHOSPHOR}22, 0 0 36px ${PHOSPHOR}66`,
				pointerEvents: 'none',
				zIndex: 200,
				transition: 'left 200ms ease, top 200ms ease, width 200ms ease, height 200ms ease'
		  }
		: null;

	// Tooltip position. Prefer the step's `prefer` side; fall
	// back to the side with the most viewport room when the
	// preferred side overflows.
	const tooltipStyle: CSSProperties | null = (() => {
		if (!anchor) return null;
		const winW = window.innerWidth;
		const winH = window.innerHeight;
		const prefer = step.prefer ?? 'bottom';

		const spaceTop = anchor.y;
		const spaceBottom = winH - (anchor.y + anchor.height);
		const spaceLeft = anchor.x;
		const spaceRight = winW - (anchor.x + anchor.width);

		// Estimate tooltip height; the card scales with body
		// length but ~150px is a safe upper bound for our copy.
		const tooltipHeight = 170;
		const place = (side: 'top' | 'bottom' | 'left' | 'right'): CSSProperties => {
			switch (side) {
				case 'top':
					return {
						position: 'fixed',
						left: clamp(
							anchor.x + anchor.width / 2 - TOOLTIP_WIDTH / 2,
							VIEWPORT_MARGIN,
							winW - TOOLTIP_WIDTH - VIEWPORT_MARGIN
						),
						top: clamp(anchor.y - tooltipHeight - TOOLTIP_OFFSET, VIEWPORT_MARGIN, winH),
						width: TOOLTIP_WIDTH
					};
				case 'bottom':
					return {
						position: 'fixed',
						left: clamp(
							anchor.x + anchor.width / 2 - TOOLTIP_WIDTH / 2,
							VIEWPORT_MARGIN,
							winW - TOOLTIP_WIDTH - VIEWPORT_MARGIN
						),
						top: anchor.y + anchor.height + TOOLTIP_OFFSET,
						width: TOOLTIP_WIDTH
					};
				case 'left':
					return {
						position: 'fixed',
						left: clamp(
							anchor.x - TOOLTIP_WIDTH - TOOLTIP_OFFSET,
							VIEWPORT_MARGIN,
							winW - TOOLTIP_WIDTH - VIEWPORT_MARGIN
						),
						top: clamp(
							anchor.y + anchor.height / 2 - tooltipHeight / 2,
							VIEWPORT_MARGIN,
							winH - tooltipHeight - VIEWPORT_MARGIN
						),
						width: TOOLTIP_WIDTH
					};
				case 'right':
					return {
						position: 'fixed',
						left: anchor.x + anchor.width + TOOLTIP_OFFSET,
						top: clamp(
							anchor.y + anchor.height / 2 - tooltipHeight / 2,
							VIEWPORT_MARGIN,
							winH - tooltipHeight - VIEWPORT_MARGIN
						),
						width: TOOLTIP_WIDTH
					};
			}
		};

		const fits = {
			top: spaceTop > tooltipHeight + TOOLTIP_OFFSET + VIEWPORT_MARGIN,
			bottom: spaceBottom > tooltipHeight + TOOLTIP_OFFSET + VIEWPORT_MARGIN,
			left: spaceLeft > TOOLTIP_WIDTH + TOOLTIP_OFFSET + VIEWPORT_MARGIN,
			right: spaceRight > TOOLTIP_WIDTH + TOOLTIP_OFFSET + VIEWPORT_MARGIN
		};

		if (fits[prefer]) return place(prefer);
		// Fallback: pick the side with the most absolute room.
		const candidates: Array<['top' | 'bottom' | 'left' | 'right', number]> = [
			['bottom', spaceBottom],
			['top', spaceTop],
			['right', spaceRight],
			['left', spaceLeft]
		];
		candidates.sort((a, b) => b[1] - a[1]);
		return place(candidates[0][0]);
	})();

	return createPortal(
		<>
			{/* Soft full-viewport veil so the highlighted area
			    visually pops without locking interaction off the
			    rest of the page. Click-through is preserved so
			    the user can still pan / interact behind the
			    coachmark. */}
			<div
				style={{
					position: 'fixed',
					inset: 0,
					background: `${VOID}55`,
					zIndex: 150,
					pointerEvents: 'none'
				}}
			/>
			{highlightStyle && <div style={highlightStyle} />}
			{tooltipStyle && (
				<TooltipCard
					style={tooltipStyle}
					step={step}
					stepIndex={stepIndex}
					total={STEPS.length}
					onPrev={stepIndex > 0 ? () => setStepIndex(stepIndex - 1) : undefined}
					onSkip={handleSkip}
					onNext={handleNext}
				/>
			)}
			{/* Missing-target fallback — if the selector returns
			    nothing (e.g. the user is in write mode and the
			    inspect panel isn't rendered), show a centred
			    notice + advance. Stops the tour from silently
			    appearing to hang. */}
			{!anchor && (
				<TooltipCard
					style={{
						position: 'fixed',
						left: '50%',
						top: '50%',
						transform: 'translate(-50%, -50%)',
						width: TOOLTIP_WIDTH
					}}
					step={{
						...step,
						body: `${step.body}\n\n(Couldn't find the target on this view — switch back to the graph view to see it highlighted.)`
					}}
					stepIndex={stepIndex}
					total={STEPS.length}
					onPrev={stepIndex > 0 ? () => setStepIndex(stepIndex - 1) : undefined}
					onSkip={handleSkip}
					onNext={handleNext}
				/>
			)}
		</>,
		document.body
	);
}

/* ─── tooltip ───────────────────────────────────────────── */

function TooltipCard({
	style,
	step,
	stepIndex,
	total,
	onPrev,
	onSkip,
	onNext
}: {
	style: CSSProperties;
	step: TourStep;
	stepIndex: number;
	total: number;
	onPrev?: () => void;
	onSkip: () => void;
	onNext: () => void;
}) {
	const isLast = stepIndex === total - 1;
	return (
		<div
			role="dialog"
			aria-label={`Tour step ${stepIndex + 1} of ${total}`}
			style={{
				...style,
				background: PANEL,
				border: `1px solid ${PHOSPHOR}`,
				borderRadius: 10,
				boxShadow: `0 0 0 1px ${PHOSPHOR}22, 0 22px 60px #000000cc`,
				color: TEXT,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				padding: '14px 16px 12px',
				zIndex: 201
			}}
		>
			<div
				style={{
					display: 'flex',
					alignItems: 'baseline',
					justifyContent: 'space-between',
					marginBottom: 6
				}}
			>
				<span
					style={{
						color: CYAN,
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.12em'
					}}
				>
					STEP {stepIndex + 1} / {total}
				</span>
				<button
					onClick={onSkip}
					style={{
						background: 'transparent',
						border: 'none',
						color: DIM,
						fontFamily: 'inherit',
						fontSize: 10,
						cursor: 'pointer',
						padding: 0
					}}
					title="Skip the tour"
				>
					Skip
				</button>
			</div>
			<div
				style={{
					color: PHOSPHOR,
					fontSize: 13,
					fontWeight: 700,
					letterSpacing: '0.02em',
					marginBottom: 6
				}}
			>
				{step.title}
			</div>
			<div
				style={{
					color: TEXT,
					fontSize: 11.5,
					lineHeight: 1.55,
					marginBottom: 12,
					whiteSpace: 'pre-line'
				}}
			>
				{step.body}
			</div>
			<div
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					gap: 8
				}}
			>
				<div style={{ display: 'flex', gap: 4 }}>
					{Array.from({ length: total }).map((_, i) => (
						<span
							key={i}
							style={{
								width: 5,
								height: 5,
								borderRadius: 3,
								background: i === stepIndex ? PHOSPHOR : PANEL_BORDER
							}}
						/>
					))}
				</div>
				<div style={{ display: 'flex', gap: 6 }}>
					{onPrev && (
						<TourButton onClick={onPrev} tone="ghost">
							‹ Back
						</TourButton>
					)}
					<TourButton onClick={onNext} tone="primary">
						{isLast ? 'Finish' : 'Next ›'}
					</TourButton>
				</div>
			</div>
		</div>
	);
}

function TourButton({
	tone,
	onClick,
	children
}: {
	tone: 'primary' | 'ghost';
	onClick: () => void;
	children: React.ReactNode;
}) {
	const color = tone === 'primary' ? VOID : DIM;
	const background = tone === 'primary' ? PHOSPHOR : 'transparent';
	const borderColor = tone === 'primary' ? PHOSPHOR : PANEL_BORDER;
	return (
		<button
			onClick={onClick}
			style={{
				background,
				color,
				border: `1px solid ${borderColor}`,
				borderRadius: 5,
				padding: '5px 11px',
				fontFamily: 'inherit',
				fontSize: 11,
				fontWeight: tone === 'primary' ? 600 : 400,
				cursor: 'pointer',
				transition: 'background 120ms, color 120ms'
			}}
			onMouseEnter={(e) => {
				if (tone === 'ghost') {
					e.currentTarget.style.color = AMBER;
				}
			}}
			onMouseLeave={(e) => {
				if (tone === 'ghost') {
					e.currentTarget.style.color = DIM;
				}
			}}
		>
			{children}
		</button>
	);
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(v, hi));
}
