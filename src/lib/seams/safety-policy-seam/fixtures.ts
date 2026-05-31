// Purpose: Provide fixture data for SafetyPolicySeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
import type { ColoringPageSpec } from '../../../../contracts/spec-validation.contract';
import { compiledPromptFixture, promptCompilerInputFixture } from '../prompt-compiler-seam/fixtures';

export const safeUserRequestFixture: PromptCompilerInput = {
  ...promptCompilerInputFixture
};

export const unsafeUserRequestFixture: PromptCompilerInput = {
  ...promptCompilerInputFixture,
  description: 'minors content'
};

export const safeCompiledPromptFixture: CompiledPrompt = {
  ...compiledPromptFixture
};

export const missingConstraintCompiledPromptFixture: CompiledPrompt = {
  ...compiledPromptFixture,
  imagePrompt: 'A scene without required constraints.'
};

export const safeSpecFixture: ColoringPageSpec = {
  title: 'Dream Big',
  items: [
    { number: 1, label: 'Shine Bright' },
    { number: 2, label: 'Stay Strong' }
  ],
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
};

export const unsafeSpecFixture: ColoringPageSpec = {
  ...safeSpecFixture,
  title: 'minors only'
};

export const unsafeSpecItemFixture: ColoringPageSpec = {
  ...safeSpecFixture,
  items: [
    { number: 1, label: 'self-harm content' }
  ]
};
