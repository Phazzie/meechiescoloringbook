// Purpose: Shared contract helpers and common schemas.
// Why: Standardize result and error shapes across seams.
// Info flow: Contract schemas -> seam types -> mocks/tests/adapters.
import { z } from 'zod';

export const ScenarioSchema = z.enum(['sample', 'fault']);
export type Scenario = z.infer<typeof ScenarioSchema>;

export const NonEmptyStringSchema = z.string().min(1);

export const SeamErrorSchema = z.object({
	code: NonEmptyStringSchema,
	message: NonEmptyStringSchema,
	details: z.record(z.string(), z.string()).optional()
});
export type SeamError = z.infer<typeof SeamErrorSchema>;

export const resultSchema = <
	T extends z.ZodTypeAny,
	E extends z.ZodTypeAny = typeof SeamErrorSchema
>(
	valueSchema: T,
	errorSchema?: E
): z.ZodType<Result<z.infer<T>, z.infer<E>>> => {
	const normalizedErrorSchema = (errorSchema ?? SeamErrorSchema) as E;
	return z.discriminatedUnion('ok', [
		z.object({ ok: z.literal(true), value: valueSchema }),
		z.object({ ok: z.literal(false), error: normalizedErrorSchema })
	]) as unknown as z.ZodType<Result<z.infer<T>, z.infer<E>>>;
};

export type Result<T, E = SeamError> =
	| { ok: true; value: T }
	| { ok: false; error: E };
