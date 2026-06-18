// Purpose: Build the shared Result<T> error-response shape used by core orchestration pipelines.
// Why: generate, image-generation, chat-interpretation, tools, meechie-studio-text, and
//      wig-try-on pipelines each declared an identical buildError() helper.
// Info flow: status/code/message/details -> {status, body: Result error variant} consumed by route handlers.
import type { SeamError } from '../../../contracts/shared.contract';

export type PipelineErrorResponse = {
	status: number;
	body: { ok: false; error: SeamError };
};

export const buildPipelineError = (
	status: number,
	code: string,
	message: string,
	details?: Record<string, string>
): PipelineErrorResponse => ({
	status,
	body: {
		ok: false,
		error: details ? { code, message, details } : { code, message }
	}
});
