// Purpose: Adapter implementation for MeechieVoiceSeam.
// Why: Provide a deterministic Meechie voice pack for downstream tools.
// Info flow: Voice request -> voice pack -> tool adapter.
import type {
	MeechieVoiceInput,
	MeechieVoicePack,
	MeechieVoiceSeam
} from '../../seams/meechie-voice-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';

import { meechieVoicePack } from '../../seams/meechie-voice-seam/voice-pack';

export const meechieVoiceAdapter: MeechieVoiceSeam = {
	getVoicePack: async (input: MeechieVoiceInput): Promise<Result<MeechieVoicePack>> => {
		if (input.voiceId !== meechieVoicePack.voiceId) {
			return {
				ok: false,
				error: {
					code: 'VOICE_PACK_NOT_FOUND',
					message: 'Voice pack not found.'
				}
			};
		}

		return {
			ok: true,
			value: meechieVoicePack
		};
	}
};
