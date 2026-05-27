// Purpose: Mock PromptCompilerSeam behavior using fixtures.
// Why: Keep tests deterministic without live I/O.
// Info flow: tests -> mock -> fixtures.
import type { CompiledPrompt, PromptCompilerInput, PromptCompilerSeam } from './contract';
import { SYSTEM_CONSTANTS } from '../../core/constants';

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
  SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[0],
  SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[1],
  'clean bold contours',
  SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[2],
  SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[3],
  'NO color fill, NO grayscale, NO shading, NO gradients',
  'printable, lots of open spaces for coloring',
  'avoid photorealism, avoid 3D render, avoid halftone, avoid crosshatching shading',
  `${SYSTEM_CONSTANTS.REQUIRED_PROMPT_PHRASES[4]} no color, no grayscale, no shading, no gradients`
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

export const createMockPromptCompilerSeam = (): PromptCompilerSeam => ({
  compile: async (input) => {
    const compiled: CompiledPrompt = {
      imagePrompt: buildPrompt(input),
      negativePrompt,
      metadata: {
        glamLevel: input.glamLevel,
        density: input.density,
        lineThickness: input.lineThickness,
        borderStyle: input.borderStyle,
        captionText: input.addCaption ? input.captionText : undefined,
        stylePreset: 'mock-glam',
        enforcedConstraints: constraints
      }
    };

    return compiled;
  }
});
