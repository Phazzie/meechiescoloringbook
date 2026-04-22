// Purpose: Shared test factory for a valid ColoringPageSpec baseline.
// Why: Avoid duplicating the same baseSpec object in multiple test files.
// Info flow: Imported by unit tests -> spread/override for test variants.
import type { ColoringPageSpec } from '../../contracts/spec-validation.contract';

export function makeBaseSpec(overrides: Partial<ColoringPageSpec> = {}): ColoringPageSpec {
	return {
		title: 'Test',
		items: [{ number: 1, label: 'Item one' }],
		listMode: 'list',
		alignment: 'left',
		numberAlignment: 'strict',
		listGutter: 'normal',
		whitespaceScale: 50,
		textSize: 'small',
		fontStyle: 'rounded',
		textStrokeWidth: 6,
		colorMode: 'black_and_white_only',
		decorations: 'none',
		illustrations: 'none',
		shading: 'none',
		border: 'plain',
		borderThickness: 8,
		variations: 1,
		outputFormat: 'pdf',
		pageSize: 'US_Letter',
		...overrides
	};
}
