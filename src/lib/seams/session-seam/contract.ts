/*
 * Purpose: Define the canonical SessionSeam contract and schemas.
 * Why: Provide a stable anonymous session identity in self-contained seam architecture.
 * Info flow: Browser storage -> SessionSeam -> consumer modules.
 * Invariants: Session IDs must be non-empty and non-whitespace strings.
 */
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from '../../../../contracts/shared.contract';
import type { Result } from '../../../../contracts/shared.contract';

export const SessionContextSchema = z.object({
	sessionId: NonEmptyStringSchema.trim().min(1)
});

export const SessionResultSchema = resultSchema(SessionContextSchema);

export type SessionContext = z.infer<typeof SessionContextSchema>;
export type SessionResult = z.infer<typeof SessionResultSchema>;

export type SessionSeam = {
	getSession(): Promise<Result<SessionContext>>;
};
