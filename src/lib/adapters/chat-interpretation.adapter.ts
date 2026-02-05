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

const isFaultMessage = (message: string): boolean => {
	const trimmed = message.trim();
	return trimmed.length < 3 || trimmed.includes('??');
};

export const chatInterpretationAdapter: ChatInterpretationSeam = {
	interpret: async (input: ChatInterpretationInput): Promise<Result<ChatInterpretationOutput>> => {
		if (isFaultMessage(input.message)) {
			return {
				ok: false,
				error: {
					code: 'CHAT_INPUT_INVALID',
					message: 'Chat message is too short or invalid.'
				}
			};
		}

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
