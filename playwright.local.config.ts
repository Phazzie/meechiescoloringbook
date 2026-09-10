// Purpose: Run the end-to-end suite against a Chromium that is already on the machine, instead of
//          the exact build `@playwright/test` pins.
// Why: In a sandboxed container the pinned browser build is usually absent and downloading one is
//      forbidden, so `npm run test:e2e` reports "Executable doesn't exist" and suggests an install
//      that cannot run. Two scheduled runs of the worst-feature routine have now rebuilt this same
//      override by hand and thrown it away, each time recording in `WORST_TO_BEST_LOG.md` that the
//      next run would have to do it again. This is that override, kept.
// Info flow: PLAYWRIGHT_CHROMIUM_PATH -> launchOptions.executablePath -> the same suite, same
//            projects, same web server as `playwright.config.ts`.
// Invariants:
//   - Never the default. `npm run test:e2e` still uses `playwright.config.ts` and still pins the
//     browser, because a suite that silently runs against whatever build is lying around is not the
//     suite CI runs. This config is opted into by name.
//   - With `PLAYWRIGHT_CHROMIUM_PATH` unset it behaves exactly like the pinned config, so it cannot
//     quietly change what is being tested.
import { defineConfig, devices } from '@playwright/test';

/**
 * The browser to launch, when the environment names one.
 *
 * On the container these routines run in that is
 * `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, which the environment also advertises
 * through `PLAYWRIGHT_BROWSERS_PATH`. Read from the environment rather than hardcoded: a path
 * baked into the repository is a path that is wrong on every other machine.
 */
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: process.env.CI ? 1 : 2,
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
			use: {
				...devices['Desktop Chrome'],
				...(executablePath ? { launchOptions: { executablePath } } : {})
			}
		}
	]
});
