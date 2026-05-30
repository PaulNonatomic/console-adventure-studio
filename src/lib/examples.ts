/**
 * Built-in example narratives — ship with the studio so a
 * first-time visitor can see what the tool is for without
 * having to bring their own JSON.
 *
 * Two examples are exported:
 *   - `EXAMPLE_ADVENTURE` — a small five-scene branching tale.
 *     Kept deliberately neutral so the structure is the lesson,
 *     not the theme. This is the default the studio loads on
 *     first run and what "Open: example adventure" picks.
 *   - `FOUNDRY_EXAMPLE` — the original themed foundry story.
 *     A meatier seven-scene piece that doubles as a stress-test
 *     for the layout / share card / tier rendering.
 *
 * Kept inline rather than fetched at runtime so the studio
 * works fully offline once loaded.
 */
import type { AdventureJson } from 'console-adventure';

/**
 * Simple branching narrative -- three starting paths converge
 * at a clearing, where three endings diverge again. Plain
 * traveller-at-a-crossroads framing so the structure (branch
 * + reconverge + branch) is what the author notices.
 */
export const EXAMPLE_ADVENTURE: AdventureJson = {
	start: 'crossroads',
	intro: [
		'EXAMPLE ADVENTURE',
		'a small branching tale -- three paths, one clearing, three ways out',
		'pick a path with  example.choose(n)'
	],
	scenes: {
		crossroads: {
			heading: '~/example · the crossroads',
			narration: [
				'You stand where three paths meet. The sun sits low and yellow.',
				'A forest darkens to your left. A meadow opens straight ahead.',
				'A river bends away to the right.'
			],
			choices: [
				{
					label: 'Take the forest path',
					points: 1,
					flavour: 'Leaves close around you almost immediately.',
					next: 'forest'
				},
				{
					label: 'Cross the open meadow',
					points: 2,
					flavour: 'Tall grass parts as you walk through.',
					next: 'meadow'
				},
				{
					label: 'Follow the river',
					points: 1,
					flavour: 'The current is louder than it looked from here.',
					next: 'river'
				}
			]
		},
		forest: {
			heading: '~/example · the forest',
			narration: [
				'Roots cross the path. Birds you cannot see call to each other.',
				'A clearing opens ahead through a gap in the trees.'
			],
			choices: [
				{
					label: 'Step into the clearing',
					points: 2,
					flavour: 'You catch the smell of woodsmoke.',
					next: 'clearing'
				},
				{
					label: 'Skirt the edge instead',
					points: 1,
					flavour: 'You stay just within the treeline as you pass.',
					next: 'clearing'
				}
			]
		},
		meadow: {
			heading: '~/example · the meadow',
			narration: [
				'Insects hum lazy circles around you. The grass is up past your knees.',
				'Beyond the meadow you can see a small clearing.'
			],
			choices: [
				{
					label: 'Lie down and rest a while',
					points: 1,
					flavour: 'You watch the clouds drift for a few minutes.',
					next: 'clearing'
				},
				{
					label: 'Keep walking at a steady pace',
					points: 2,
					flavour: 'You feel the afternoon stretch out around you.',
					next: 'clearing'
				}
			]
		},
		river: {
			heading: '~/example · the river',
			narration: [
				'The water runs clear over rounded stones. You can see fish.',
				'Downstream the bank opens into a clearing.'
			],
			choices: [
				{
					label: 'Wade across',
					points: 2,
					flavour: 'The cold wakes you straight up.',
					next: 'clearing'
				},
				{
					label: 'Walk along the bank',
					points: 1,
					flavour: 'You follow the river bend at an easy pace.',
					next: 'clearing'
				}
			]
		},
		clearing: {
			heading: '~/example · the clearing',
			narration: [
				'A small fire smoulders in the centre of the clearing. No one is tending it.',
				'Three paths lead out -- back the way you came, deeper into the wood, or up a slow rise.'
			],
			choices: [
				{
					label: 'Stoke the fire and stay',
					points: 3,
					flavour: 'Warmth and quiet company find you here.',
					next: null
				},
				{
					label: 'Continue at a steady pace',
					points: 2,
					flavour: 'You leave the clearing behind without looking back.',
					next: null
				},
				{
					label: 'Slip away into the trees',
					points: 1,
					flavour: 'No one sees you go.',
					next: null
				}
			]
		}
	},
	tiers: [
		{ minScore: 7, label: 'Wayfarer', color: 'primary' },
		{ minScore: 5, label: 'Wanderer', color: 'accent' },
		{ minScore: 0, label: 'Traveller', color: 'dim' }
	],
	share: {
		text: 'Walked the example as ${tier} (${score}/${max}).',
		url: 'https://example.com/?s=${score}'
	}
};

/**
 * The original foundry-themed adventure -- six scenes, a clear
 * branch + reconverge structure, themed around "a studio
 * behind the screen." Doubles as a stress-test for the
 * studio's share-card / tier-rendering surfaces. Kept as the
 * second selectable example so authors who already used it as
 * a reference can still load it.
 */
export const FOUNDRY_EXAMPLE: AdventureJson = {
	start: 'entrance',
	intro: [
		'THE FOUNDRY',
		'a five-scene drift through the studio behind the screen',
		'pick a path with  foundry.choose(n)'
	],
	scenes: {
		entrance: {
			heading: '~/foundry · entrance',
			narration: [
				'You stand before The Foundry. The doors hum with a low CRT flicker.',
				'Two paths open: a hall lined with arcade cabinets, and a workshop',
				'whose walls are papered with blueprints.'
			],
			choices: [
				{
					label: 'Enter the arcade hall',
					points: 2,
					flavour: 'The cabinets hum awake as you pass.',
					next: 'arcade'
				},
				{
					label: 'Enter the workshop',
					points: 2,
					flavour: 'A draughtsman lamp clicks on as you step in.',
					next: 'workshop'
				}
			]
		},
		arcade: {
			heading: '~/foundry · the unmarked cabinet',
			narration: ['A cabinet at the end of the row has no label. > _'],
			choices: [
				{
					label: 'Type "help" and see what happens',
					points: 3,
					flavour: '"you already are." A panel sighs open.',
					next: 'forge'
				},
				{
					label: 'Walk past',
					points: 2,
					flavour: 'You wander deeper.',
					next: 'forge'
				},
				{
					label: 'Kick it',
					points: 1,
					flavour: 'A coin clatters out — a wall slides open.',
					next: 'forge'
				}
			]
		},
		workshop: {
			heading: '~/foundry · the workshop',
			narration: [
				'Schematics paper every wall. A draughtsman is at the bench, not looking up.'
			],
			choices: [
				{
					label: 'Trace the attention diagram',
					points: 3,
					flavour: 'Input → softmax → output.',
					next: 'forge'
				},
				{
					label: 'Pick up the drone schematic',
					points: 2,
					flavour: 'Denser than it looks.',
					next: 'forge'
				},
				{
					label: "Ask what they're building",
					points: 3,
					flavour: '"The next one."',
					next: 'forge'
				}
			]
		},
		forge: {
			heading: '~/foundry · the great forge',
			narration: ['The Master Forge gestures at three tools on the anvil.'],
			choices: [
				{
					label: 'Take the hammer',
					points: 3,
					flavour: 'Things get built.',
					next: 'riddle'
				},
				{
					label: 'Take the lens',
					points: 3,
					flavour: 'Everything reveals one more layer.',
					next: 'riddle'
				},
				{
					label: 'Take the brush',
					points: 3,
					flavour: 'Things get coloured in.',
					next: 'riddle'
				},
				{
					label: 'Take all three',
					points: 2,
					flavour: 'Greedy. Spirit is right.',
					next: 'riddle'
				}
			]
		},
		riddle: {
			heading: '~/foundry · the riddle',
			narration: ['"What is analogue energy, shipped digitally?"'],
			choices: [
				{
					label: 'A vinyl record',
					points: 1,
					flavour: 'Warm — but no.',
					next: 'ledger'
				},
				{
					label: 'A studio that means it',
					points: 3,
					flavour: '"You read the banner."',
					next: 'ledger'
				},
				{
					label: 'A cassette mixtape',
					points: 1,
					flavour: 'Also wrong.',
					next: 'ledger'
				},
				{
					label: 'A handwritten letter, but PDF',
					points: 2,
					flavour: 'Half-credit.',
					next: 'ledger'
				}
			]
		},
		ledger: {
			heading: '~/foundry · the ledger',
			narration: ['Sign however feels true.'],
			choices: [
				{
					label: 'Sign your real name',
					points: 2,
					flavour: 'The ink is lime green.',
					next: null
				},
				{
					label: 'Sign with a handle',
					points: 2,
					flavour: 'The page accepts it.',
					next: null
				},
				{
					label: 'Sign "Anonymous"',
					points: 1,
					flavour: 'The ledger knows you.',
					next: null
				}
			]
		}
	},
	tiers: [
		{ minScore: 11, label: 'Foundry Legend', color: 'danger' },
		{ minScore: 8, label: 'Master Forge', color: 'primary' },
		{ minScore: 5, label: 'Journeyman', color: 'accent' },
		{ minScore: 0, label: 'Apprentice', color: 'dim' }
	],
	share: {
		text: 'Forged ${tier} (${score}/${max}) in the foundry.',
		url: 'https://example.com/foundry?s=${score}'
	}
};
