/**
 * Built-in example narratives — the foundry adventure ships
 * with the studio so a first-time visitor can see what the
 * tool is for without having to bring their own JSON.
 *
 * Kept inline rather than fetched at runtime so the studio
 * works fully offline once loaded.
 */
import type { AdventureJson } from 'console-adventure';

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
			narration: [
				'A cabinet at the end of the row has no label. > _'
			],
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
