/**
 * Boot overlay — first-run orientation.
 *
 * Replaces the cold open where a new visitor landed
 * mid-graph with only a tiny bottom-left hint to navigate
 * from. Frames the three onboarding paths *as* the product's
 * own `choose(1..3)` grammar:
 *
 *   1. Take the tour — load the built-in example adventure + walkthrough
 *   2. Start from a skeleton — three-scene branching scaffold
 *   3. Bring your own — paste / upload / fetch URL
 *
 * Dismisses on Esc, backdrop click, "don't show on boot"
 * checkbox, or picking any choice. The dismiss preference
 * persists to localStorage under `cas:skipBoot`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
	PANEL,
	PANEL_BORDER,
	PHOSPHOR,
	AMBER,
	CYAN,
	TEXT,
	DIM,
	VOID
} from '../lib/theme';
import {
	readFileAsJson,
	pasteJsonFromClipboard,
	fetchJsonFromUrl
} from '../lib/import';

const SKIP_BOOT_KEY = 'cas:skipBoot';

/** External persistence — read once at mount for the initial `showBoot` state. */
export function shouldShowBootOverlay(): boolean {
	try {
		return localStorage.getItem(SKIP_BOOT_KEY) === null;
	} catch {
		return true;
	}
}

interface Props {
	onClose: () => void;
	/** Choice 1 — load the example adventure and trigger the guided tour. */
	onTour: () => void;
	/** Choice 2 — load the three-scene branching scaffold. */
	onSkeleton: () => void;
	/** Choice 3 sub-paths — feed parsed JSON / error back to App. */
	onLoadJson: (json: unknown) => void;
	onError: (message: string) => void;
}

type ImportMode = 'paste' | 'upload' | 'url';

export function BootOverlay({
	onClose,
	onTour,
	onSkeleton,
	onLoadJson,
	onError
}: Props) {
	// "Bring your own" expands into a small sub-menu rather
	// than firing the import immediately — gives the user a
	// confirmation step and a place to type a URL inline.
	const [importMode, setImportMode] = useState<ImportMode | null>(null);
	const [skipBoot, setSkipBoot] = useState<boolean>(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const dismiss = useCallback(() => {
		if (skipBoot) {
			try {
				localStorage.setItem(SKIP_BOOT_KEY, '1');
			} catch {
				/* private mode / blocked storage — fail open */
			}
		}
		onClose();
	}, [skipBoot, onClose]);

	const pick = useCallback(
		(action: () => void) => {
			action();
			dismiss();
		},
		[dismiss]
	);

	// Keyboard:
	//   1 / 2 / 3 trigger the three choices
	//   Esc closes the overlay
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				dismiss();
				return;
			}
			// Ignore digits if the user is typing into the URL input
			// or the file dialog has focus.
			const target = e.target as HTMLElement | null;
			if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
				return;
			}
			if (e.key === '1') pick(onTour);
			else if (e.key === '2') pick(onSkeleton);
			else if (e.key === '3') setImportMode((prev) => prev ?? 'paste');
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	}, [dismiss, pick, onTour, onSkeleton]);

	function doPaste() {
		void pasteJsonFromClipboard({
			onLoad: (json) => {
				onLoadJson(json);
				dismiss();
			},
			onError
		});
	}

	function doUpload(file: File) {
		readFileAsJson(file, {
			onLoad: (json) => {
				onLoadJson(json);
				dismiss();
			},
			onError
		});
	}

	function doFetch(url: string) {
		void fetchJsonFromUrl(url, {
			onLoad: (json) => {
				onLoadJson(json);
				dismiss();
			},
			onError
		});
	}

	return (
		<div
			// Backdrop covers the canvas + dims it so the modal
			// reads as foreground. Click outside the panel to
			// dismiss; clicking the panel itself shouldn't.
			onClick={dismiss}
			style={{
				position: 'fixed',
				inset: 0,
				background: 'rgba(10, 10, 15, 0.75)',
				backdropFilter: 'blur(2px)',
				WebkitBackdropFilter: 'blur(2px)',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 200,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				aria-labelledby="boot-title"
				style={{
					width: 620,
					maxWidth: '92vw',
					background: PANEL,
					border: `1px solid ${PANEL_BORDER}`,
					borderRadius: 14,
					boxShadow: '0 30px 90px rgba(0,0,0,0.7)',
					padding: '22px 26px 18px',
					display: 'flex',
					flexDirection: 'column',
					gap: 16
				}}
			>
				<BootHeader />

				<div>
					<div
						id="boot-title"
						style={{
							color: TEXT,
							fontSize: 24,
							fontWeight: 700,
							letterSpacing: '-0.01em',
							marginBottom: 6
						}}
					>
						Where do you want to{' '}
						<span style={{ color: PHOSPHOR }}>start?</span>
					</div>
					<div style={{ color: DIM, fontSize: 12 }}>
						A text-adventure editor, opened the way it plays — pick a path.
					</div>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					accept=".json,application/json"
					style={{ display: 'none' }}
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) doUpload(f);
						e.target.value = '';
					}}
				/>

				<div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
					<ChoiceButton
						index={1}
						title="Take the tour"
						tag="GUIDED"
						tagColor={CYAN}
						body="Walk the example adventure with callouts — see how scenes, choices, tiers and the playtest fit together."
						onClick={() => pick(onTour)}
					/>
					<ChoiceButton
						index={2}
						title="Start from a skeleton"
						tag="FAST"
						tagColor={PHOSPHOR}
						body="Drop in a 3-scene branching scaffold — entrance, a fork, an ending — and rewrite it into your own."
						onClick={() => pick(onSkeleton)}
					/>
					<ChoiceButton
						index={3}
						title="Bring your own"
						tag="IMPORT"
						tagColor={AMBER}
						body="Paste JSON, upload a file, or fetch from a URL. Anything matching adventure.schema.json loads."
						onClick={() => setImportMode((prev) => prev ?? 'paste')}
						expanded={importMode !== null}
					/>

					{importMode !== null && (
						<ImportPanel
							mode={importMode}
							onModeChange={setImportMode}
							onPaste={doPaste}
							onUploadClick={() => fileInputRef.current?.click()}
							onFetch={doFetch}
							onCancel={() => setImportMode(null)}
						/>
					)}
				</div>

				<BootFooter
					skipBoot={skipBoot}
					onSkipBootChange={setSkipBoot}
					onClose={dismiss}
				/>
			</div>
		</div>
	);
}

// ─── sub-components ──────────────────────────────────────────

function BootHeader() {
	return (
		<div
			style={{
				color: DIM,
				fontSize: 11,
				lineHeight: 1.6,
				background: VOID,
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 8,
				padding: '10px 14px',
				fontFamily: 'inherit'
			}}
		>
			<div>
				<span style={{ color: PHOSPHOR, fontWeight: 700 }}>$</span> studio --boot
			</div>
			<div>
				<span style={{ color: DIM }}>&gt;</span> loaded engine ·
				console-adventure v0.4 · example adventure ready
			</div>
			<div>
				<span style={{ color: DIM }}>&gt;</span> ready{' '}
				<span
					style={{
						display: 'inline-block',
						width: 7,
						height: 11,
						background: PHOSPHOR,
						verticalAlign: '-1px',
						animation: 'cas-blink 1.1s steps(2, start) infinite'
					}}
					aria-hidden
				/>
				<style>{`@keyframes cas-blink { 50% { opacity: 0; } }`}</style>
			</div>
		</div>
	);
}

interface ChoiceButtonProps {
	index: number;
	title: string;
	tag: string;
	tagColor: string;
	body: string;
	onClick: () => void;
	expanded?: boolean;
}

function ChoiceButton({
	index,
	title,
	tag,
	tagColor,
	body,
	onClick,
	expanded = false
}: ChoiceButtonProps) {
	return (
		<button
			onClick={onClick}
			style={{
				display: 'grid',
				gridTemplateColumns: 'auto 1fr auto',
				alignItems: 'center',
				gap: 14,
				padding: '12px 14px',
				background: expanded ? `${tagColor}11` : 'transparent',
				border: `1px solid ${expanded ? tagColor : PANEL_BORDER}`,
				borderRadius: 8,
				color: TEXT,
				fontFamily: 'inherit',
				fontSize: 12,
				cursor: 'pointer',
				textAlign: 'left',
				transition: 'border-color 120ms, background 120ms'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = tagColor;
				e.currentTarget.style.background = `${tagColor}0e`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = expanded ? tagColor : PANEL_BORDER;
				e.currentTarget.style.background = expanded ? `${tagColor}11` : 'transparent';
			}}
		>
			<span
				style={{
					color: tagColor,
					fontSize: 22,
					fontWeight: 700,
					lineHeight: 1,
					width: 22,
					textAlign: 'center'
				}}
			>
				{index}
			</span>
			<span>
				<span style={{ color: PHOSPHOR, fontWeight: 700 }}>{title}</span>{' '}
				<span
					style={{
						display: 'inline-block',
						color: tagColor,
						background: `${tagColor}1a`,
						border: `1px solid ${tagColor}55`,
						borderRadius: 4,
						padding: '1px 6px',
						fontSize: 9,
						fontWeight: 700,
						letterSpacing: '0.14em',
						verticalAlign: 'middle',
						marginLeft: 4
					}}
				>
					{tag}
				</span>
				<div style={{ color: DIM, fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
					{body}
				</div>
			</span>
			<span style={{ color: DIM, fontSize: 14 }}>→</span>
		</button>
	);
}

interface ImportPanelProps {
	mode: ImportMode;
	onModeChange: (mode: ImportMode) => void;
	onPaste: () => void;
	onUploadClick: () => void;
	onFetch: (url: string) => void;
	onCancel: () => void;
}

function ImportPanel({
	mode,
	onModeChange,
	onPaste,
	onUploadClick,
	onFetch,
	onCancel
}: ImportPanelProps) {
	const [url, setUrl] = useState('');

	return (
		<div
			style={{
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 8,
				padding: '12px 14px',
				background: VOID,
				display: 'flex',
				flexDirection: 'column',
				gap: 12
			}}
		>
			<div style={{ display: 'flex', gap: 6 }}>
				<ModePill label="paste" active={mode === 'paste'} onClick={() => onModeChange('paste')} />
				<ModePill label="upload" active={mode === 'upload'} onClick={() => onModeChange('upload')} />
				<ModePill label="from URL" active={mode === 'url'} onClick={() => onModeChange('url')} />
				<div style={{ flex: 1 }} />
				<button
					onClick={onCancel}
					style={{
						background: 'transparent',
						border: 'none',
						color: DIM,
						fontSize: 11,
						cursor: 'pointer',
						fontFamily: 'inherit',
						padding: '4px 8px'
					}}
				>
					cancel
				</button>
			</div>

			{mode === 'paste' && (
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<button
						onClick={onPaste}
						style={primaryActionStyle()}
					>
						paste from clipboard
					</button>
					<span style={{ color: DIM, fontSize: 10 }}>
						Reads whatever JSON is on your clipboard right now.
					</span>
				</div>
			)}

			{mode === 'upload' && (
				<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
					<button onClick={onUploadClick} style={primaryActionStyle()}>
						choose a .json file
					</button>
					<span style={{ color: DIM, fontSize: 10 }}>
						Anything matching adventure.schema.json loads.
					</span>
				</div>
			)}

			{mode === 'url' && (
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const trimmed = url.trim();
						if (trimmed) onFetch(trimmed);
					}}
					style={{ display: 'flex', gap: 8 }}
				>
					<input
						type="url"
						placeholder="https://example.com/adventure.json"
						value={url}
						onChange={(e) => setUrl(e.target.value)}
						autoFocus
						style={{
							flex: 1,
							background: PANEL,
							border: `1px solid ${PANEL_BORDER}`,
							color: TEXT,
							padding: '6px 10px',
							borderRadius: 5,
							fontFamily: 'inherit',
							fontSize: 11,
							outline: 'none'
						}}
					/>
					<button type="submit" style={primaryActionStyle()}>
						fetch
					</button>
				</form>
			)}
		</div>
	);
}

function primaryActionStyle(): React.CSSProperties {
	return {
		background: 'transparent',
		color: PHOSPHOR,
		border: `1px solid ${PHOSPHOR}`,
		padding: '6px 12px',
		borderRadius: 5,
		fontFamily: 'inherit',
		fontSize: 11,
		fontWeight: 700,
		cursor: 'pointer'
	};
}

function ModePill({
	label,
	active,
	onClick
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			onClick={onClick}
			style={{
				background: active ? `${AMBER}1a` : 'transparent',
				border: `1px solid ${active ? AMBER : PANEL_BORDER}`,
				color: active ? AMBER : DIM,
				padding: '4px 10px',
				borderRadius: 4,
				fontFamily: 'inherit',
				fontSize: 10,
				cursor: 'pointer'
			}}
		>
			{label}
		</button>
	);
}

interface BootFooterProps {
	skipBoot: boolean;
	onSkipBootChange: (v: boolean) => void;
	onClose: () => void;
}

function BootFooter({ skipBoot, onSkipBootChange, onClose }: BootFooterProps) {
	return (
		<div
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				borderTop: `1px solid ${PANEL_BORDER}`,
				paddingTop: 12,
				fontSize: 10,
				color: DIM
			}}
		>
			<span>
				press <Kbd>1</Kbd>–<Kbd>3</Kbd> · <Kbd>esc</Kbd> — the example's
				already on the canvas
			</span>
			<label
				style={{
					display: 'flex',
					gap: 6,
					alignItems: 'center',
					cursor: 'pointer'
				}}
			>
				<input
					type="checkbox"
					checked={skipBoot}
					onChange={(e) => onSkipBootChange(e.target.checked)}
					style={{ accentColor: PHOSPHOR }}
				/>
				don't show on boot
			</label>
			<button
				onClick={onClose}
				style={{
					background: 'transparent',
					border: 'none',
					color: DIM,
					fontSize: 11,
					cursor: 'pointer',
					fontFamily: 'inherit'
				}}
				aria-label="dismiss"
			>
				skip
			</button>
		</div>
	);
}

function Kbd({ children }: { children: React.ReactNode }) {
	return (
		<span
			style={{
				display: 'inline-block',
				background: VOID,
				border: `1px solid ${PANEL_BORDER}`,
				borderRadius: 3,
				padding: '0 4px',
				color: AMBER,
				fontSize: 9,
				margin: '0 1px'
			}}
		>
			{children}
		</span>
	);
}
