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
			const payload = await response.json();
			const parsed = ChatInterpretationResultSchema.safeParse(payload);
			if (!parsed.success) {
				return {
					ok: false,
					error: {
						code: 'CHAT_RESPONSE_INVALID',
						message: 'Chat interpretation response did not match contract.'
					}
				};
			}
			return parsed.data;
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
