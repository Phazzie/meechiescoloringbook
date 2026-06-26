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
export const REQUIRED_ENV_VARS: readonly StartupEnvVar[] = [
	{ key: 'XAI_API_KEY', feature: 'image generation' }
];

// Each of these already degrades gracefully at runtime: GEMINI_API_KEY produces a
// WIG_TRY_ON_CONFIG_ERROR Result instead of throwing, and XAI_TEXT_MODEL falls back to
// DEFAULT_TEXT_MODEL in src/lib/core/text-model.ts.
export const OPTIONAL_ENV_VARS: readonly StartupEnvVar[] = [
	{ key: 'GEMINI_API_KEY', feature: 'wig try-on' },
	{ key: 'XAI_TEXT_MODEL', feature: 'Meechie studio text (falls back to a default model)' }
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
