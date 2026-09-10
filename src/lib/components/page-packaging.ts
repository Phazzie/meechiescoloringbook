/*
 * Purpose: The only call to `outputPackagingAdapter.package` in the app — one variant, every way it
 *          can go wrong turned into a value the export row can render.
 * Why: There were three of these, byte-similar and separately maintained:
 *      `studio-state.svelte.ts`, `page-artifact-state.svelte.ts` and `MeechieTools.svelte` each
 *      carried their own twenty-line `packageVariant`. All three read `result.error.message` and
 *      discarded `result.error.code`; all three wrote a caught exception's message into the same
 *      reader-facing field. Three copies is also why the fix had to be made three times and why the
 *      next one would have been missed — the same reason `PageExportRow`, `VaultStatusLine` and
 *      `PrintPageButton` each became one implementation.
 * Info flow: images + the variant asked for -> `OutputPackagingSeam` -> a `PageExportAttempt`
 *            carrying either its files or a classified `ExportFailure`.
 * Invariants:
 *   - Both failure shapes are handled here. The adapter reports a refusal in its `Result` and can
 *     still reject outright — pdf-lib's `embedPng`, `embedJpg` and `save` all throw, and so does the
 *     canvas — and to a reader both mean the same thing: this download is not available, here is
 *     why. Catching here is what keeps a packaging failure out of a caller's outer `catch`, which on
 *     every one of the three surfaces writes the field a FAILED GENERATION uses, directly above the
 *     button that buys another one.
 *   - One variant per call, never `variants: ['print', 'square']`. The adapter returns on its first
 *     error WITHOUT its accumulated files, so asking for both together loses the printable PDF
 *     whenever the share canvas is the thing that breaks. The PDF is the product.
 *   - `pageSize` is carried on the attempt that comes back, not read from a caller's live spec. The
 *     Page Controls stay enabled while packaging runs; `page-exports.ts` gives the full reason.
 *   - No sentence is written here. What the reader is told is `export-failure.ts`'s decision alone.
 */

import { outputPackagingAdapter } from '$lib/adapters/output-packaging-seam';
import type { OutputVariant } from '$lib/seams/output-packaging-seam/contract';
import type { GeneratedImage } from '../../../contracts/image-generation.contract';
import type { ColoringPageSpec } from '../../../contracts/spec-validation.contract';
import { classifyExportFailure } from '$lib/core/export-failure';
import type { PageExportAttempt } from '$lib/core/page-exports';

/**
 * Package one variant of a finished page.
 *
 * Never throws: a rejection from the seam becomes an attempt that names its own failure, because a
 * caller that has to `try` around this would be free to handle it the way all three used to.
 */
export const packagePageVariant = async (
	variant: OutputVariant,
	images: readonly GeneratedImage[],
	fileBaseName: string,
	pageSize: ColoringPageSpec['pageSize']
): Promise<PageExportAttempt> => {
	try {
		const result = await outputPackagingAdapter.package({
			images: [...images],
			outputFormat: 'pdf',
			fileBaseName,
			pageSize,
			variants: [variant]
		});
		return result.ok
			? { variant, files: result.value.files, failure: null, pageSize }
			: {
					variant,
					files: [],
					// The whole `SeamError`, so the classifier sees the `code` all three call sites
					// used to drop on the floor.
					failure: classifyExportFailure(variant, result.error),
					pageSize
				};
	} catch (packagingError) {
		return {
			variant,
			files: [],
			failure: classifyExportFailure(variant, packagingError),
			pageSize
		};
	}
};
