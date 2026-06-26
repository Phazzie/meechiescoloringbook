// Purpose: Classify which environment variables are missing at server boot.
// Why: AppConfigSeam/ImageProviderConfigSeam only validate env vars lazily on first
//      request; a missing key should be visible in startup logs, not the first user-facing error.
// Info flow: raw env record -> required/optional split -> hooks.server.ts logs the result.

export type StartupEnvVar = {
	key: string;
	feature: string;
};

// XAI_API_KEY has no fallback anywhere in the codebase: ImageProviderConfigSeam and
// AppConfigSeam both reject an empty value, and image generation is the core feature.
//
// The next five are required only because src/lib/adapters/wig-try-on-seam/index.ts calls
// AppConfigSeam.getConfig() (not the narrower ImageProviderConfigSeam) to reach geminiApiKey,
// and appConfigSchema (src/lib/seams/app-config-seam/validators.ts) rejects an empty value for
// all of them with no adapter-level fallback — so getConfig() throws before the Gemini key is
// ever read. ImageProviderConfigSeam's own adapter already defaults xaiImageModel/xaiBaseUrl/
// xaiImageEndpointPath for the image-generation path, so only wig try-on is actually blocked by
// these being unset. XAI_TEXT_MODEL has a separate, unrelated fallback (DEFAULT_TEXT_MODEL in
// src/lib/core/text-model.ts) for selectTextModel() callers, but that fallback does not help
// AppConfigSeam.getConfig(), which reads env.XAI_TEXT_MODEL directly.
export const REQUIRED_ENV_VARS: readonly StartupEnvVar[] = [
	{ key: 'XAI_API_KEY', feature: 'image generation' },
	{ key: 'XAI_TEXT_MODEL', feature: 'wig try-on' },
	{ key: 'XAI_IMAGE_MODEL', feature: 'wig try-on' },
	{ key: 'XAI_BASE_URL', feature: 'wig try-on' },
	{ key: 'XAI_IMAGE_ENDPOINT_PATH', feature: 'wig try-on' },
	{ key: 'DEFAULT_IMAGE_SIZE', feature: 'wig try-on' }
];

// GEMINI_API_KEY already degrades gracefully at runtime: AppConfigSeam defaults it to '',
// and src/lib/adapters/wig-try-on-seam/index.ts returns a WIG_TRY_ON_CONFIG_ERROR Result
// instead of throwing when it is empty.
export const OPTIONAL_ENV_VARS: readonly StartupEnvVar[] = [
	{ key: 'GEMINI_API_KEY', feature: 'wig try-on' }
];

export type StartupEnvCheckResult = {
	missingRequired: StartupEnvVar[];
	missingOptional: StartupEnvVar[];
};

const isMissing = (env: Record<string, string | undefined>, key: string): boolean => {
	return !env[key]?.trim();
};

export const checkStartupEnv = (
	env: Record<string, string | undefined>
): StartupEnvCheckResult => ({
	missingRequired: REQUIRED_ENV_VARS.filter((envVar) => isMissing(env, envVar.key)),
	missingOptional: OPTIONAL_ENV_VARS.filter((envVar) => isMissing(env, envVar.key))
});
