// Purpose: Preserve the legacy import path for the canonical MeechieVoiceSeam contract.
// Why: Existing consumers can migrate independently without maintaining a duplicate
//      contract. This file and src/lib/seams/meechie-voice-seam/contract.ts were
//      byte-identical 128-line mirrors, so any change touching both — including this
//      PR's one-line edit — tripped SonarCloud's duplication gate. Mirrors the collapse
//      already shipped for SpecValidationSeam in d1b5520.
// Info flow: Legacy imports -> canonical self-contained contract -> consumers.
export * from '../src/lib/seams/meechie-voice-seam/contract';
