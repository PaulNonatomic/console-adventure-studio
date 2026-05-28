/**
 * Reusable brand-styled form inputs. Wrapped here so every
 * editor field shares the same look + focus styling without
 * each component having to re-declare it.
 *
 * Inline styles (rather than CSS classes) so this file is the
 * only place to touch when adjusting the input look.
 */
import type { CSSProperties, ChangeEvent, ReactNode } from 'react';
import { PHOSPHOR, AMBER, MAGENTA, TEXT, DIM, PANEL_BORDER, VOID } from '../lib/theme';

const inputBase: CSSProperties = {
	width: '100%',
	background: VOID,
	border: `1px solid ${PANEL_BORDER}`,
	borderRadius: 4,
	color: TEXT,
	padding: '6px 8px',
	fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
	fontSize: 11,
	lineHeight: 1.4,
	outline: 'none',
	transition: 'border-color 120ms'
};

const labelStyle: CSSProperties = {
	display: 'block',
	fontSize: 9,
	fontWeight: 700,
	letterSpacing: '0.1em',
	color: DIM,
	marginBottom: 4
};

interface InputProps {
	label?: string;
	value: string;
	onChange: (next: string) => void;
	placeholder?: string;
}

export function Input({ label, value, onChange, placeholder }: InputProps) {
	return (
		<Field label={label}>
			<input
				type="text"
				value={value}
				placeholder={placeholder}
				onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
				style={inputBase}
				onFocus={(e) => (e.target.style.borderColor = AMBER)}
				onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
			/>
		</Field>
	);
}

interface NumberInputProps {
	label?: string;
	value: number;
	onChange: (next: number) => void;
}

export function NumberInput({ label, value, onChange }: NumberInputProps) {
	return (
		<Field label={label}>
			<input
				type="number"
				value={value}
				onChange={(e: ChangeEvent<HTMLInputElement>) => {
					const v = Number(e.target.value);
					if (!Number.isNaN(v)) onChange(v);
				}}
				style={{ ...inputBase, width: 64, textAlign: 'right' }}
				onFocus={(e) => (e.target.style.borderColor = AMBER)}
				onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
			/>
		</Field>
	);
}

interface TextareaProps {
	label?: string;
	value: string;
	onChange: (next: string) => void;
	rows?: number;
}

export function Textarea({ label, value, onChange, rows = 3 }: TextareaProps) {
	return (
		<Field label={label}>
			<textarea
				value={value}
				rows={rows}
				onChange={(e) => onChange(e.target.value)}
				style={{ ...inputBase, resize: 'vertical', fontFamily: inputBase.fontFamily }}
				onFocus={(e) => (e.target.style.borderColor = AMBER)}
				onBlur={(e) => (e.target.style.borderColor = PANEL_BORDER)}
			/>
		</Field>
	);
}

interface SelectProps<T extends string | null> {
	label?: string;
	value: T;
	options: Array<{ value: T; label: string }>;
	onChange: (next: T) => void;
}

export function Select<T extends string | null>({
	label,
	value,
	options,
	onChange
}: SelectProps<T>) {
	// `null` doesn't survive HTML <select> directly — encode it
	// as the empty string in the DOM and translate at the edges.
	const encode = (v: T): string => (v === null ? '' : String(v));
	const decode = (raw: string): T => (raw === '' ? (null as T) : (raw as T));
	return (
		<Field label={label}>
			<select
				value={encode(value)}
				onChange={(e) => onChange(decode(e.target.value))}
				style={{
					...inputBase,
					appearance: 'none',
					WebkitAppearance: 'none',
					MozAppearance: 'none',
					cursor: 'pointer',
					backgroundImage: `linear-gradient(45deg, transparent 50%, ${PHOSPHOR} 50%), linear-gradient(135deg, ${PHOSPHOR} 50%, transparent 50%)`,
					backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
					backgroundSize: '5px 5px',
					backgroundRepeat: 'no-repeat',
					paddingRight: 22
				}}
				onFocus={(e) => (e.currentTarget.style.borderColor = AMBER)}
				onBlur={(e) => (e.currentTarget.style.borderColor = PANEL_BORDER)}
			>
				{options.map((opt) => (
					<option key={encode(opt.value)} value={encode(opt.value)}>
						{opt.label}
					</option>
				))}
			</select>
		</Field>
	);
}

function Field({ label, children }: { label?: string; children: ReactNode }) {
	if (!label) return <>{children}</>;
	return (
		<div style={{ marginBottom: 10 }}>
			<span style={labelStyle}>{label}</span>
			{children}
		</div>
	);
}

interface ButtonProps {
	label: string;
	onClick: () => void;
	color?: 'primary' | 'accent' | 'danger' | 'dim';
	small?: boolean;
}

export function Button({ label, onClick, color = 'accent', small = false }: ButtonProps) {
	const fg =
		color === 'primary'
			? PHOSPHOR
			: color === 'danger'
				? MAGENTA
				: color === 'dim'
					? DIM
					: AMBER;
	return (
		<button
			onClick={onClick}
			style={{
				background: 'transparent',
				border: `1px solid ${PANEL_BORDER}`,
				color: fg,
				padding: small ? '3px 8px' : '6px 12px',
				borderRadius: 4,
				fontFamily: 'ui-monospace, "JetBrains Mono", monospace',
				fontSize: small ? 9 : 11,
				cursor: 'pointer',
				transition: 'border-color 120ms, background 120ms'
			}}
			onMouseEnter={(e) => {
				e.currentTarget.style.borderColor = fg;
				e.currentTarget.style.background = `${fg}11`;
			}}
			onMouseLeave={(e) => {
				e.currentTarget.style.borderColor = PANEL_BORDER;
				e.currentTarget.style.background = 'transparent';
			}}
		>
			{label}
		</button>
	);
}
