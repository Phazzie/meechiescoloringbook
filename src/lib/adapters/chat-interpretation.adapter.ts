// Purpose: Adapter implementation for ChatInterpretationSeam.
// Why: Call the server-side xAI endpoint and normalize contract results.
// Info flow: User message -> API endpoint -> structured spec.
import type {
	ChatInterpretationInput,
	ChatInterpretationOutput,
	ChatInterpretationSeam
} from '../../../contracts/chat-interpretation.contract';
import { ChatInterpretationResultSchema } from '../../../contracts/chat-interpretation.contract';
import type { Result } from '../../../contracts/shared.contract';

export const chatInterpretationAdapter: ChatInterpretationSeam = {
	interpret: async (input: ChatInterpretationInput): Promise<Result<ChatInterpretationOutput>> => {
		try {
			const response = await fetch('/api/chat-interpretation', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(input)
			});
			// Always parse the body first: the route sends a structured Result even on
			// non-2xx status codes (e.g. CHAT_INPUT_INVALID on 400, provider errors on 502).
			// Fall back to CHAT_HTTP_ERROR or CHAT_RESPONSE_INVALID on parse/validation errors; network error only when fetch throws.
			const payload = await response.json().catch(() => null);
			const parsed = payload !== null ? ChatInterpretationResultSchema.safeParse(payload) : null;
			if (parsed?.success) {
				return parsed.data;
			}
			if (!response.ok) {
				return {
					ok: false,
					error: {
						code: 'CHAT_HTTP_ERROR',
						message: 'Chat interpretation request failed.',
						details: {
							status: String(response.status),
							statusText: response.statusText
						}
					}
				};
			}
			return {
				ok: false,
				error: {
					code: 'CHAT_RESPONSE_INVALID',
					message: 'Chat interpretation response did not match contract.'
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: {
					code: 'CHAT_NETWORK_ERROR',
					message: error instanceof Error ? error.message : 'Chat request failed.'
				}
			};
		}
	}
};
