// Purpose: Define the AuthContextSeam contract.
// Why: Represent identity and capabilities without exposing I/O.
// Info flow: Session input -> auth context -> downstream seams.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const AuthContextSchema = z
	.object({
		kind: z.enum(['anonymous', 'authenticated']),
		userId: NonEmptyStringSchema.optional(),
		capabilities: z.array(NonEmptyStringSchema),
		rateLimitTier: NonEmptyStringSchema
	})
	.refine((value) => (value.kind === 'authenticated' ? !!value.userId : true), {
		message: 'userId is required when kind is authenticated'
	});

export const AuthContextInputSchema = z.object({
	sessionId: NonEmptyStringSchema.optional()
});

export const AuthContextResultSchema = resultSchema(AuthContextSchema);

export type AuthContext = z.infer<typeof AuthContextSchema>;
export type AuthContextInput = z.infer<typeof AuthContextInputSchema>;
export type AuthContextResult = z.infer<typeof AuthContextResultSchema>;

export type AuthContextSeam = {
	getAuthContext(input: AuthContextInput): Promise<Result<AuthContext>>;
};
