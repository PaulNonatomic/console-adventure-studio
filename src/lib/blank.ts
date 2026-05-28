/**
 * Adventure starter shapes.
 *
 * Two flavours, loaded by different paths in the UI:
 *
 *   BLANK_ADVENTURE     —  truly empty: one scene, one
 *                          terminal choice. For authors who
 *                          want to start from zero. Reached
 *                          via the toolbar's "new" button.
 *   STARTER_ADVENTURE   —  three-scene branching scaffold:
 *                          an entrance with a left/right
 *                          fork, each ending immediately.
 *                          The shape teaches the model
 *                          (branch + terminal) without making
 *                          the author delete demo copy. Reached
 *                          via the boot overlay's "fast" path.
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

/**
 * Three-scene branching scaffold loaded by the boot overlay's
 * "start from a skeleton" path. The placeholder copy reads as
 * obvious filler so an author doesn't accidentally ship it —
 * `(rename me)` headings + tag-style narration that flags
 * itself for replacement.
 */
export const STARTER_ADVENTURE: AdventureJson = {
	start: 'entrance',
	scenes: {
		entrance: {
			heading: '(rename me) · entrance',
			narration: [
				'Set the scene here. One or two lines is plenty —',
				'the choices below are what the player actually picks.'
			],
			choices: [
				{
					label: 'Go left',
					points: 1,
					flavour: '(what the player sees after picking this)',
					next: 'left'
				},
				{
					label: 'Go right',
					points: 1,
					flavour: '(what the player sees after picking this)',
					next: 'right'
				}
			]
		},
		left: {
			heading: '(rename me) · left',
			narration: ['One side of the fork. Make it specific.'],
			choices: [
				{
					label: 'End here',
					points: 2,
					flavour: 'The path ends. The tier resolves.',
					next: null
				}
			]
		},
		right: {
			heading: '(rename me) · right',
			narration: ['The other side of the fork. Different vibe.'],
			choices: [
				{
					label: 'End here',
					points: 2,
					flavour: 'The path ends. The tier resolves.',
					next: null
				}
			]
		}
	},
	tiers: [
		{ minScore: 0, label: 'Player', color: 'primary' },
		{ minScore: 3, label: 'Explorer', color: 'accent' }
	]
};
