/**
 * Brand palette — kept in step with console-shell's DEFAULT_THEME
 * so the editor visually matches the runtime output. Duplicating
 * the constants here (rather than importing from `console-shell`)
 * lets us use these as CSS literals and in inline `style={}`
 * props without a runtime call to `resolveTheme()`.
 */
export const PHOSPHOR = '#C7F441';
export const AMBER = '#F5A623';
export const MAGENTA = '#FF388F';
export const CYAN = '#00D4FF';
export const TEXT = '#eef0f5';
export const DIM = '#909090';
export const VOID = '#0A0A0F';
export const PANEL = '#13131a';
export const PANEL_BORDER = '#252535';

/** Resolve a console-adventure tier `color` slot to a CSS value. */
export function colorForTierSlot(slot: string | undefined): string {
	switch (slot) {
		case 'primary':
			return PHOSPHOR;
		case 'accent':
			return AMBER;
		case 'danger':
			return MAGENTA;
		case 'info':
			return CYAN;
		case 'text':
			return TEXT;
		case 'dim':
			return DIM;
		default:
			return PHOSPHOR;
	}
}
