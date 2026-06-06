// Purpose: Provide fixture data for SafetyPolicySeam.
// Why: Ensure deterministic mock and test inputs.
// Info flow: fixtures -> mocks/tests.
import type { SafetyPolicyGenerateInput } from './contract';
import type { CompiledPrompt, PromptCompilerInput } from '../prompt-compiler-seam/contract';
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

export const safeGenerateRequestFixture: SafetyPolicyGenerateInput = {
  spec: {
    title: 'Dream Big',
    items: [
      { number: 1, label: 'Shine' },
      { number: 2, label: 'Grow' }
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
  },
  styleHint: 'sparkle icons'
};

export const unsafeGenerateTitleFixture: SafetyPolicyGenerateInput = {
  ...safeGenerateRequestFixture,
  spec: { ...safeGenerateRequestFixture.spec, title: 'Self-harm scene' }
};

export const unsafeGenerateItemFixture: SafetyPolicyGenerateInput = {
  ...safeGenerateRequestFixture,
  spec: {
    ...safeGenerateRequestFixture.spec,
    items: [{ number: 1, label: 'extremist poster' }]
  }
};

export const unsafeGenerateFooterFixture: SafetyPolicyGenerateInput = {
  ...safeGenerateRequestFixture,
  spec: {
    ...safeGenerateRequestFixture.spec,
    footerItem: { number: 99, label: 'suicide note' }
  }
};

export const unsafeGenerateDedicationFixture: SafetyPolicyGenerateInput = {
  ...safeGenerateRequestFixture,
  spec: {
    ...safeGenerateRequestFixture.spec,
    dedication: 'for extremist fans'
  }
};

export const unsafeGenerateStyleHintFixture: SafetyPolicyGenerateInput = {
  ...safeGenerateRequestFixture,
  styleHint: 'self-harm scene'
};
