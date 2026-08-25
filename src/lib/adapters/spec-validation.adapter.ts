// Purpose: Preserve the legacy SpecValidationSeam adapter import path.
// Why: Keep one canonical implementation while older callers migrate.
// Info flow: Legacy adapter import -> canonical self-contained adapter.
import type { SpecValidationSeam } from '../../../contracts/spec-validation.contract';
import { specValidationAdapter as canonicalSpecValidationAdapter } from './spec-validation-seam';

export const specValidationAdapter: SpecValidationSeam =
	canonicalSpecValidationAdapter;
