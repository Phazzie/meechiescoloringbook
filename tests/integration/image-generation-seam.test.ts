// Purpose: Integration tests for ImageGenerationSeam.
// Why: Validate live adapter behavior when integration tests are enabled.
// Info flow: test -> seam adapter -> assertions.
import { describe, expect, it } from 'vitest';
import { createImageGenerationSeam } from '../../src/lib/adapters/image-generation-seam';

const featureEnabled = process.env.FEATURE_INTEGRATION_TESTS === 'true';
const hasApiKey = Boolean(process.env.XAI_API_KEY);

describe('ImageGenerationSeam integration', () => {
const runTest = featureEnabled && hasApiKey;

if (runTest) {
it('generates an image via xAI', async () => {
const imageSeam = createImageGenerationSeam();
const result = await imageSeam.generate({
spec: {
title: 'Kitten Glam',
items: [{ number: 1, label: 'Sparkle' }],
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
pageSize: 'US_Letter'
},
prompt: [
'Black-and-white coloring book page',
'outline-only',
'easy to color',
'Crisp vector-like linework',
'NEGATIVE PROMPT:',
'US Letter 8.5x11 portrait.',
'a bow-wearing kitten in a glam setting'
].join(' '),
variations: 1,
outputFormat: 'pdf'
});

expect(result.ok).toBe(true);
if (result.ok) {
expect(result.value.images.length).toBeGreaterThan(0);
}
});
} else {
it.skip('is skipped when integration flag or API key is missing', () => {
expect(true).toBe(true);
});
}
});
