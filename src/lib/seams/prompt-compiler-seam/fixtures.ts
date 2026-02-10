// Purpose: Provide fixture data for PromptCompilerSeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { CompiledPrompt, PromptCompilerInput } from './contract';

export const promptCompilerInputFixture: PromptCompilerInput = {
  description: 'a glam kitten wearing a bow',
  glamLevel: 4,
  density: 'medium',
  lineThickness: 'medium',
  borderStyle: 'glam',
  addCaption: true,
  captionText: 'Glam Kitty'
};

export const compiledPromptFixture: CompiledPrompt = {
  imagePrompt: [
    '[Subject]',
    '- a glam kitten wearing a bow',
    '',
    '[Coloring-book constraints — ALWAYS present]',
    '- black-and-white coloring book page',
    '- outline-only line art, clean bold contours',
    '- NO color fill, NO grayscale, NO shading, NO gradients',
    '- printable, lots of open spaces for coloring',
    '- avoid photorealism, avoid 3D render, avoid halftone, avoid crosshatching shading',
    '',
    '[Girly glam style — vary by sliders]',
    '- glam, sparkly, rhinestone-dot outlines',
    '- hearts, bows, stars, diamonds, gem outlines',
    '- beauty doodles: lipstick, lashes, nails, heels',
    '- snazzy high-fashion, playful, glamorous accents',
    '',
    '[Composition controls]',
    '- density: balanced composition with open space',
    '- line thickness: medium clean outlines',
    '- border style: glamorous border with hearts, bows, stars, and sparkles',
    '- Caption text: "Glam Kitty".'
  ].join('\n'),
  negativePrompt:
    'color, colored, grayscale, grey, shading, shadow, gradient, photorealistic, 3d, render, crosshatching, hatching, halftone, painterly, texture fill',
  metadata: {
    glamLevel: 4,
    density: 'medium',
    lineThickness: 'medium',
    borderStyle: 'glam',
    captionText: 'Glam Kitty',
    stylePreset: 'mock-glam',
    enforcedConstraints: [
      'black-and-white coloring book page',
      'outline-only line art, clean bold contours',
      'NO color fill, NO grayscale, NO shading, NO gradients',
      'printable, lots of open spaces for coloring',
      'avoid photorealism, avoid 3D render, avoid halftone, avoid crosshatching shading'
    ]
  }
};
