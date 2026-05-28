/**
 * Brand palette.
 *
 * Re-exports `console-shell`'s `DEFAULT_THEME` slot values as
 * loose constants so they can be used in `style={}` props and
 * CSS literals without a runtime `resolveTheme()` call. The
 * source of truth is `console-shell` — if any colour shifts
 * there, it flows through here automatically on next install.
 *
 * Studio-specific surfaces (panel chrome, panel borders) are
 * defined locally below; they're not part of the
 * `console-shell` palette because they describe the *editor*
 * rather than the runtime console output.
 */
import { DEFAULT_THEME, type ThemeColor } from 'console-shell';

// Brand palette, sourced from console-shell.
export const PHOSPHOR = DEFAULT_THEME.primary;
export const AMBER = DEFAULT_THEME.accent;
export const MAGENTA = DEFAULT_THEME.danger;
export const CYAN = DEFAULT_THEME.info;
export const TEXT = DEFAULT_THEME.text;
export const DIM = DEFAULT_THEME.dim;
export const VOID = DEFAULT_THEME.background;

// Studio chrome — panel surfaces, border lines, etc. These
// describe the editor's own UI, not the runtime console
// output, so they live here rather than in console-shell.
export const PANEL = '#13131a';
export const PANEL_BORDER = '#252535';

/**
 * Theme colour slots that adventure-author UI knows about
 * (tier-colour dropdown, etc.). Derived from console-shell's
 * `ThemeColor` so any future additions there flow through.
 */
export const THEME_COLOR_SLOTS: ThemeColor[] = [
	'primary',
	'accent',
	'danger',
	'info',
	'text',
	'dim'
];

/** Resolve a `console-adventure` tier `color` slot to a CSS value. */
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
