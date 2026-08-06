// Purpose: Unit tests for AppConfigSeam validation and parsing.
// Why: Ensure environment config is read safely.
// Info flow: test inputs -> validators -> assertions.
import { describe, expect, it } from 'vitest';
import { createAppConfigSeam } from '../../src/lib/adapters/app-config-seam';

const baseEnv = {
	XAI_API_KEY: 'test-key',
	XAI_TEXT_MODEL: 'grok-4.3',
	XAI_IMAGE_MODEL: 'grok-imaging-image',
	XAI_BASE_URL: 'https://api.x.ai/v1',
	XAI_IMAGE_ENDPOINT_PATH: '/images/generations',
	FEATURE_INTEGRATION_TESTS: 'false',
	MAX_IMAGES_PER_REQUEST: '4',
	DEFAULT_IMAGE_SIZE: '1024x1024'
};

describe('AppConfigSeam adapter', () => {
	it('parses valid environment config', () => {
		const seam = createAppConfigSeam(baseEnv);
		const config = seam.getConfig();

		expect(config.xaiApiKey).toBe('test-key');
		expect(config.featureIntegrationTests).toBe(false);
		expect(config.maxImagesPerRequest).toBe(4);
	});

	it('throws when required env vars are missing', () => {
		const seam = createAppConfigSeam({ ...baseEnv, XAI_API_KEY: undefined });
		expect(() => seam.getConfig()).toThrow();
	});

	it("parses FEATURE_INTEGRATION_TESTS: 'true' as boolean true", () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			FEATURE_INTEGRATION_TESTS: 'true'
		});
		const config = seam.getConfig();
		expect(config.featureIntegrationTests).toBe(true);
	});

	it("parses FEATURE_INTEGRATION_TESTS: 'false' as boolean false", () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			FEATURE_INTEGRATION_TESTS: 'false'
		});
		const config = seam.getConfig();
		expect(config.featureIntegrationTests).toBe(false);
	});

	it("parses FEATURE_INTEGRATION_TESTS: any non-'true' string as boolean false", () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			FEATURE_INTEGRATION_TESTS: '1'
		});
		const config = seam.getConfig();
		expect(config.featureIntegrationTests).toBe(false);
	});

	it('parses MAX_IMAGES_PER_REQUEST string as a number', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: '8'
		});
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(8);
	});

	it('throws when MAX_IMAGES_PER_REQUEST exceeds schema max of 10', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: '11'
		});
		expect(() => seam.getConfig()).toThrow();
	});

	it('throws when MAX_IMAGES_PER_REQUEST is 0 (below minimum)', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: '0'
		});
		expect(() => seam.getConfig()).toThrow();
	});

	it('defaults maxImagesPerRequest to 4 when MAX_IMAGES_PER_REQUEST is absent', () => {
		const { MAX_IMAGES_PER_REQUEST: _, ...envWithout } = baseEnv;
		const seam = createAppConfigSeam(envWithout);
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(4);
	});

	it('defaults maxImagesPerRequest to 4 when MAX_IMAGES_PER_REQUEST is empty string', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: ''
		});
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(4);
	});

	it('defaults maxImagesPerRequest to 4 when MAX_IMAGES_PER_REQUEST is whitespace only', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: '   '
		});
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(4);
	});

	it('defaults maxImagesPerRequest to 4 when MAX_IMAGES_PER_REQUEST is non-numeric', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: 'abc'
		});
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(4);
	});

	it('defaults maxImagesPerRequest to 4 instead of truncating float strings', () => {
		const seam = createAppConfigSeam({
			...baseEnv,
			MAX_IMAGES_PER_REQUEST: '3.5'
		});
		const config = seam.getConfig();
		expect(config.maxImagesPerRequest).toBe(4);
	});
});
