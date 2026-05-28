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
// PHOSPHOR is used by the "new" toolbar button (variant=primary).

interface Props {
	onLoadExample: () => void;
	onLoadJson: (json: unknown) => void;
	onNewAdventure: () => void;
	onError: (message: string) => void;
}

export function Toolbar({
	onLoadExample,
	onLoadJson,
	onNewAdventure,
	onError
}: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	function handleUpload(file: File) {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const parsed = JSON.parse(String(reader.result));
				onLoadJson(parsed);
			} catch (err) {
				onError(`Could not parse file: ${(err as Error).message}`);
			}
		};
		reader.readAsText(file);
	}

	async function handlePaste() {
		try {
			const text = await navigator.clipboard.readText();
			if (!text.trim()) {
				onError('Clipboard is empty.');
				return;
			}
			const parsed = JSON.parse(text);
			onLoadJson(parsed);
		} catch (err) {
			onError(`Paste failed: ${(err as Error).message}`);
		}
	}

	async function handleFetchUrl() {
		const url = window.prompt('Fetch adventure JSON from URL:');
		if (!url) return;
		try {
			const res = await fetch(url);
			if (!res.ok) {
				onError(`Fetch failed: ${res.status} ${res.statusText}`);
				return;
			}
			const parsed = await res.json();
			onLoadJson(parsed);
		} catch (err) {
			onError(`Fetch failed: ${(err as Error).message}`);
		}
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
				<span style={{ color: DIM, fontSize: 11 }}>
					read-only · v0.1
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
				<TbButton label="example" onClick={onLoadExample} />
				<TbButton label="paste JSON" onClick={handlePaste} />
				<TbButton label="upload" onClick={() => fileInputRef.current?.click()} />
				<TbButton label="from URL" onClick={handleFetchUrl} />
			</div>
		</header>
	);
}

function TbButton({
	label,
	onClick,
	variant = 'normal'
}: {
	label: string;
	onClick: () => void;
	variant?: 'normal' | 'primary';
}) {
	const fg = variant === 'primary' ? PHOSPHOR : AMBER;
	return (
		<button
			onClick={onClick}
			style={{
				background: 'transparent',
				color: fg,
				border: `1px solid ${variant === 'primary' ? fg : PANEL_BORDER}`,
				borderRadius: 5,
				padding: '5px 11px',
				fontFamily: 'inherit',
				fontSize: 11,
				cursor: 'pointer',
				transition: 'border-color 120ms, color 120ms, background 120ms'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = fg;
				e.currentTarget.style.color = TEXT;
				e.currentTarget.style.background = `${fg}11`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = variant === 'primary' ? fg : PANEL_BORDER;
				e.currentTarget.style.color = fg;
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{label}
		</button>
	);
}
