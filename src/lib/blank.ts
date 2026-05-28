/**
 * Blank adventure starter. Loaded when the user clicks "new"
 * in the toolbar.
 *
 * Deliberately minimal: one scene with one choice that
 * terminates immediately. Enough for the editor to render
 * something on screen, with placeholder copy that nudges the
 * author toward the next edit ("Rename me", "Add narration",
 * "Add a choice").
 */
import type { AdventureJson } from 'console-adventure';

export const BLANK_ADVENTURE: AdventureJson = {
	start: 'scene-1',
	scenes: {
		'scene-1': {
			heading: 'Scene 1',
			narration: ['Add your narration here.'],
			choices: [
				{
					label: 'A choice',
					points: 1,
					flavour: 'Something happens.',
					next: null
				}
			]
		}
	},
	tiers: [{ minScore: 0, label: 'Player', color: 'primary' }]
};
