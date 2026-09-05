/*
 * Purpose: Define the canonical AuthContextSeam contract and schemas.
 * Why: Standardize identity and capabilities representation in self-contained seam architecture.
 * Info flow: Session input -> AuthContextSeam -> downstream authorization.
 * Invariants: Authenticated identity strictly requires non-empty userId.
 */
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const AuthContextSchema = z
	.object({
		kind: z.enum(['anonymous', 'authenticated']),
		userId: NonEmptyStringSchema.trim().min(1).optional(),
		capabilities: z.array(NonEmptyStringSchema),
		rateLimitTier: NonEmptyStringSchema
	})
	.refine(
		(value) =>
			value.kind === 'authenticated'
				? typeof value.userId === 'string' && value.userId.trim().length > 0
				: true,
		{
			message: 'userId is required when kind is authenticated'
		}
	);

export const AuthContextInputSchema = z.object({
	sessionId: NonEmptyStringSchema.trim().min(1).optional()
});

export const AuthContextResultSchema = resultSchema(AuthContextSchema);

export type AuthContext = z.infer<typeof AuthContextSchema>;
export type AuthContextInput = z.infer<typeof AuthContextInputSchema>;
export type AuthContextResult = z.infer<typeof AuthContextResultSchema>;

export type AuthContextSeam = {
	getAuthContext(input: AuthContextInput): Promise<Result<AuthContext>>;
};
