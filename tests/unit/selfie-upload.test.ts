// Purpose: Verify selfie upload data URL parsing without pulling in a component test dependency.
// Why: FileReader.result is not guaranteed to be a string even when readAsDataURL is requested.
// Info flow: FileReader.result -> parser -> component error state/callback decision.
import { describe, expect, it } from 'vitest';
import { parseSelfieDataUrl } from '$lib/core/selfie-upload';

const uploadError = 'Image could not be read. Please try again.';

describe('SelfieUpload', () => {
	it('rejects non-string FileReader results with the upload error', () => {
		expect(parseSelfieDataUrl(new ArrayBuffer(8))).toEqual({
			ok: false,
			error: uploadError
		});
	});

	it('rejects string results without a base64 payload with the upload error', () => {
		expect(parseSelfieDataUrl('data:image/png;base64,')).toEqual({
			ok: false,
			error: uploadError
		});
	});

	it('returns the full data URL and base64 payload for valid string results', () => {
		const dataUrl = 'data:image/png;base64,aGVsbG8=';

		expect(parseSelfieDataUrl(dataUrl)).toEqual({
			ok: true,
			dataUrl,
			base64: 'aGVsbG8='
		});
	});
});
