/**
 * Top toolbar — brand wordmark + load actions (built-in
 * example, paste JSON, upload file, fetch URL).
 *
 * The load actions are deliberately compact buttons rather
 * than a hamburger menu — for a Phase 2A read-only viewer the
 * surface is small enough to keep flat.
 */
import { useRef } from 'react';
import { PANEL, PANEL_BORDER, PHOSPHOR, AMBER, DIM, TEXT } from '../lib/theme';
import {
	readFileAsJson,
	pasteJsonFromClipboard,
	fetchJsonFromUrl
} from '../lib/import';

interface Props {
	onLoadExample: () => void;
	onLoadJson: (json: unknown) => void;
	onNewAdventure: () => void;
	onSave: () => void;
	onOpenLoadDialog: () => void;
	onOpenShipDialog: () => void;
	onError: (message: string) => void;
	saveAvailable: boolean;
}

export function Toolbar({
	onLoadExample,
	onLoadJson,
	onNewAdventure,
	onSave,
	onOpenLoadDialog,
	onOpenShipDialog,
	onError,
	saveAvailable
}: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const callbacks = { onLoad: onLoadJson, onError };

	function handleUpload(file: File) {
		readFileAsJson(file, callbacks);
	}

	function handlePaste() {
		void pasteJsonFromClipboard(callbacks);
	}

	function handleFetchUrl() {
		const url = window.prompt('Fetch adventure JSON from URL:');
		if (!url) return;
		void fetchJsonFromUrl(url, callbacks);
	}

	return (
		<header
			style={{
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'space-between',
				padding: '10px 18px',
				background: PANEL,
				borderBottom: `1px solid ${PANEL_BORDER}`,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace'
			}}
		>
			<div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
				<span
					style={{
						color: PHOSPHOR,
						fontWeight: 700,
						fontSize: 14,
						letterSpacing: '0.1em'
					}}
				>
					console-adventure-studio
				</span>
				<span
					style={{ color: DIM, fontSize: 11 }}
					title={`Built ${__BUILD_TIME__}`}
				>
					build {__BUILD_TAG__}
				</span>
			</div>

			<div style={{ display: 'flex', gap: 6 }}>
				<input
					ref={fileInputRef}
					type="file"
					accept=".json,application/json"
					style={{ display: 'none' }}
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) handleUpload(f);
						e.target.value = '';
					}}
				/>
				<TbButton label="new" onClick={onNewAdventure} variant="primary" />
				<TbButton label="save" onClick={onSave} disabled={!saveAvailable} />
				<TbButton label="load" onClick={onOpenLoadDialog} disabled={!saveAvailable} />
				<TbDivider />
				<TbButton label="example" onClick={onLoadExample} />
				<TbButton label="paste JSON" onClick={handlePaste} />
				<TbButton label="upload" onClick={() => fileInputRef.current?.click()} />
				<TbButton label="from URL" onClick={handleFetchUrl} />
				<TbDivider />
				<TbButton label="ship" onClick={onOpenShipDialog} variant="primary" />
			</div>
		</header>
	);
}

function TbButton({
	label,
	onClick,
	variant = 'normal',
	disabled = false
}: {
	label: string;
	onClick: () => void;
	variant?: 'normal' | 'primary';
	disabled?: boolean;
}) {
	const fg = disabled ? DIM : variant === 'primary' ? PHOSPHOR : AMBER;
	return (
		<button
			onClick={disabled ? undefined : onClick}
			disabled={disabled}
			style={{
				background: 'transparent',
				color: fg,
				border: `1px solid ${variant === 'primary' && !disabled ? fg : PANEL_BORDER}`,
				borderRadius: 5,
				padding: '5px 11px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: disabled ? 'not-allowed' : 'pointer',
				opacity: disabled ? 0.5 : 1,
				transition: 'border-color 120ms, color 120ms, background 120ms'
			}}
			onMouseEnter={(e) => {
				if (disabled) return;
				e.currentTarget.style.borderColor = fg;
				e.currentTarget.style.color = TEXT;
				e.currentTarget.style.background = `${fg}11`;
			}}
			onMouseLeave={(e) => {
				if (disabled) return;
				e.currentTarget.style.borderColor =
					variant === 'primary' ? fg : PANEL_BORDER;
				e.currentTarget.style.color = fg;
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{label}
		</button>
	);
}

function TbDivider() {
	return (
		<div
			style={{
				width: 1,
				background: PANEL_BORDER,
				margin: '4px 4px'
			}}
		/>
	);
}
