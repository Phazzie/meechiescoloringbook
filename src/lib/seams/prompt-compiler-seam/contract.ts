export type DensityLevel = 'simple' | 'medium' | 'busy';
export type LineThickness = 'thin' | 'medium' | 'thick';
export type BorderStyle = 'none' | 'simple' | 'glam';

export type PromptCompilerInput = {
  description: string;
  glamLevel: 1 | 2 | 3 | 4 | 5;
  density: DensityLevel;
  lineThickness: LineThickness;
  borderStyle: BorderStyle;
  addCaption: boolean;
  captionText?: string;
};

export type PromptCompilerMetadata = {
  glamLevel: number;
  density: DensityLevel;
  lineThickness: LineThickness;
  borderStyle: BorderStyle;
  captionText?: string;
  stylePreset: string;
  enforcedConstraints: string[];
};

export type CompiledPrompt = {
  imagePrompt: string;
  negativePrompt: string;
  metadata: PromptCompilerMetadata;
};

export type PromptCompilerSeam = {
  compile: (input: PromptCompilerInput) => Promise<CompiledPrompt>;
};
