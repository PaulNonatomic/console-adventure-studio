/**
 * Code-gen for the "drop this onto your site" wrapper snippet
 * shown in the ship dialog. Produces the exact runnable code
 * an author needs to wire their JSON onto a real site via
 * `createAdventureFromJson`.
 *
 * Pure — no React, no DOM. The snippet's variable name is
 * derived from the start scene id so the code reads as
 * narrative-specific (`const foundry = …`) rather than
 * generic (`const adventure = …`).
 */
import type { AdventureJson } from 'console-adventure';

/**
 * Derive a JavaScript identifier from a scene id. Strips the
 * `(rename me) · entrance` style placeholder prefixes and
 * falls back to `adventure` if the cleaned name is empty or
 * starts with a digit.
 */
function identifierFor(json: AdventureJson): string {
	const raw = json.start
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.toLowerCase();
	if (!raw || /^\d/.test(raw)) return 'adventure';
	return raw;
}

/**
 * Filename for the JSON import in the snippet. Uses the
 * derived identifier so the import line reads consistently
 * with the variable name.
 */
function filenameFor(json: AdventureJson): string {
	return `./${identifierFor(json)}.json`;
}

/**
 * Build the exact runnable snippet shown under the "wrapper
 * code" tab in the ship dialog. The output is plain text;
 * syntax highlighting is applied by the renderer.
 */
export function buildWrapperSnippet(json: AdventureJson): string {
	const name = identifierFor(json);
	const file = filenameFor(json);
	return `import { createAdventureFromJson } from 'console-adventure';
import json from '${file}';

const ${name} = createAdventureFromJson(json, {
  onComplete: (result) => {
    console.log(result.score, result.tier);
  },
});

// then, on your dev-console:
${name}.start();
`;
}

export function getAdventureFilename(json: AdventureJson): string {
	return `${identifierFor(json)}.json`;
}
