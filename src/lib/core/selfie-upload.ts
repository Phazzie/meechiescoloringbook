// Purpose: Parse browser FileReader output for selfie uploads.
// Why: FileReader.result can be string, ArrayBuffer, or null, but uploads need a data URL string.
// Info flow: FileReader.result -> parseSelfieDataUrl -> component preview and upload callback.

const SELFIE_UPLOAD_READ_ERROR = 'Image could not be read. Please try again.';

export type ParsedSelfieDataUrl =
	| {
			ok: true;
			dataUrl: string;
			base64: string;
	  }
	| {
			ok: false;
			error: typeof SELFIE_UPLOAD_READ_ERROR;
	  };

export const parseSelfieDataUrl = (result: FileReader['result']): ParsedSelfieDataUrl => {
	if (typeof result !== 'string') {
		return { ok: false, error: SELFIE_UPLOAD_READ_ERROR };
	}

	const commaIndex = result.indexOf(',');
	const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : '';
	if (!base64) {
		return { ok: false, error: SELFIE_UPLOAD_READ_ERROR };
	}

	return {
		ok: true,
		dataUrl: result,
		base64
	};
};
