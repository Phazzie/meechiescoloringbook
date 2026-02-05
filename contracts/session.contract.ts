// Purpose: Define the SessionSeam contract.
// Why: Provide a stable anonymous session identity.
// Info flow: Session lookup -> session context -> storage ownership.
import { z } from 'zod';
import { NonEmptyStringSchema, resultSchema } from './shared.contract';
import type { Result } from './shared.contract';

export const SessionContextSchema = z.object({
	sessionId: NonEmptyStringSchema
});

export const SessionResultSchema = resultSchema(SessionContextSchema);

export type SessionContext = z.infer<typeof SessionContextSchema>;
export type SessionResult = z.infer<typeof SessionResultSchema>;

export type SessionSeam = {
	getSession(): Promise<Result<SessionContext>>;
};
