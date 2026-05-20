// Purpose: Validate CacheSeam inputs.
// Why: Catch invalid cache names and empty URL lists before they reach the Web Cache API.
// Info flow: adapter/mock -> validators -> typed values or thrown TypeErrors.

export const validateCacheName = (input: unknown): string => {
	if (typeof input !== 'string' || input.length === 0) {
		throw new TypeError('Cache name must not be empty.');
	}
	return input;
};

export const validateCacheUrlList = (input: unknown): string[] => {
	if (!Array.isArray(input) || input.length === 0) {
		throw new TypeError('URL list must not be empty.');
	}
	for (const url of input) {
		if (typeof url !== 'string' || url.length === 0) {
			throw new TypeError('Cache URL must not be empty.');
		}
	}
	return input;
};
