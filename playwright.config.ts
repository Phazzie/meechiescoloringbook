// Purpose: Configure Playwright end-to-end testing.
// Why: Define browser projects and base URL for e2e runs.
// Info flow: Playwright reads config -> executes tests.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: process.env.CI ? 1 : 2,
	retries: 0,
	// `list` for the console, plus an HTML report on disk for CI to upload when the job fails.
	// Stated rather than left to the default: Playwright's default reporter is `list` locally and
	// `dot` on CI, and neither writes `playwright-report/`. The `e2e` job's failure step uploaded
	// that directory, so before this it uploaded nothing at all — caught in review of PR #350.
	// `open: 'never'` because nothing here is watching a browser.
	reporter: [['list'], ['html', { open: 'never' }]],
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
