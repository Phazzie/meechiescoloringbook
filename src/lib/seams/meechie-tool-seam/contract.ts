// Purpose: Define MeechieToolSeam contract types.
// Why: Keep seam interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests.
import type { z } from 'zod';
import type {
	MeechieToolIdSchema,
	MeechieToolInputSchema,
	MeechieToolOutputSchema,
	HoroscopeSignSchema
} from './validators';
import type { Result } from '../../../../contracts/shared.contract';

export type MeechieToolId = z.infer<typeof MeechieToolIdSchema>;
export type MeechieToolInput = z.infer<typeof MeechieToolInputSchema>;
export type MeechieToolOutput = z.infer<typeof MeechieToolOutputSchema>;
export type HoroscopeSign = z.infer<typeof HoroscopeSignSchema>;

export type MeechieToolSeam = {
	respond(input: MeechieToolInput): Promise<Result<MeechieToolOutput>>;
};
