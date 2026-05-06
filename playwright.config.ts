// Purpose: Configure Playwright end-to-end testing.
// Why: Define browser projects and base URL for e2e runs.
// Info flow: Playwright reads config -> executes tests.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	retries: 0,
	webServer: {
		command: 'npm run dev -- --host 127.0.0.1 --port 4173',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 180000
	},
	use: {
		baseURL: 'http://localhost:4173'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
