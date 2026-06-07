// Purpose: Mock PromptCompilerSeam behavior using fixture scenarios.
// Why: Keep tests deterministic without live I/O; zero invented data.
// Info flow: tests -> mock -> fixtures.
import type { CompiledPrompt, PromptCompilerInput, PromptCompilerSeam } from './contract';
import { compiledPromptFaultFixture } from './fixtures';
import {
  BASE_PAGE_PHRASE,
  EASY_TO_COLOR_PHRASE,
  NEGATIVE_PROMPT_HEADING,
  OUTLINE_ONLY_PHRASE,
  VECTOR_LINEWORK_PHRASE
} from '../../core/prompt-template';

const densityMap: Record<PromptCompilerInput['density'], string> = {
  simple: 'sparse composition with lots of open space',
  medium: 'balanced composition with open space',
  busy: 'busy composition with decorative details'
};

const thicknessMap: Record<PromptCompilerInput['lineThickness'], string> = {
  thin: 'thin clean outlines',
  medium: 'medium clean outlines',
  thick: 'thick bold outlines'
};

const borderMap: Record<PromptCompilerInput['borderStyle'], string> = {
  none: 'no border',
  simple: 'simple outline border',
  glam: 'glamorous border with hearts, bows, stars, and sparkles'
};

const constraints = [
  BASE_PAGE_PHRASE,
  OUTLINE_ONLY_PHRASE,
  'clean bold contours',
  EASY_TO_COLOR_PHRASE,
  VECTOR_LINEWORK_PHRASE,
  'NO color fill, NO grayscale, NO shading, NO gradients',
  'printable, lots of open spaces for coloring',
  'avoid photorealism, avoid 3D render, avoid halftone, avoid crosshatching shading',
  `${NEGATIVE_PROMPT_HEADING} no color, no grayscale, no shading, no gradients`
];

const glamElements = [
  'glam, sparkly, rhinestone-dot outlines',
  'hearts, bows, stars, diamonds, gem outlines',
  'beauty doodles: lipstick, lashes, nails, heels',
  'snazzy high-fashion, playful, glamorous accents'
];

const negativePrompt =
  'color, colored, grayscale, grey, shading, shadow, gradient, photorealistic, 3d, render, crosshatching, hatching, halftone, painterly, texture fill';

const buildPrompt = (input: PromptCompilerInput) => {
  const caption = input.addCaption && input.captionText ? `Caption text: "${input.captionText}".` : 'No caption text.';

  return [
    '[Subject]',
    `- ${input.description}`,
    '',
    '[Coloring-book constraints — ALWAYS present]',
    ...constraints.map((line) => `- ${line}`),
    '',
    '[Girly glam style — vary by sliders]',
    ...glamElements.map((line) => `- ${line}`),
    '',
    '[Composition controls]',
    `- density: ${densityMap[input.density]}`,
    `- line thickness: ${thicknessMap[input.lineThickness]}`,
    `- border style: ${borderMap[input.borderStyle]}`,
    `- ${caption}`
  ].join('\n');
};

export const createMockPromptCompilerSeam = (scenario: 'sample' | 'fault' = 'sample'): PromptCompilerSeam => ({
  compile: async (input) => {
    if (scenario === 'fault') return structuredClone(compiledPromptFaultFixture as CompiledPrompt);

    return {
      imagePrompt: buildPrompt(input),
      negativePrompt,
      metadata: {
        glamLevel: input.glamLevel,
        density: input.density,
        lineThickness: input.lineThickness,
        borderStyle: input.borderStyle,
        captionText: input.addCaption ? input.captionText : undefined,
        stylePreset: 'mock-glam',
        enforcedConstraints: [...constraints]
      }
    };
  }
});
