// Purpose: Implement WigCatalogSeam by reading the static wigs.json catalog.
// Why: Isolate data loading behind the seam contract so tests can swap in a mock.
// Info flow: wigs.json import -> validateWigCatalog -> Result<Wig[]>.
import type { Wig, WigCatalogSeam } from '../../seams/wig-catalog-seam/contract';
import type { Result } from '../../../../contracts/shared.contract';
import { validateWigCatalog } from '../../seams/wig-catalog-seam/validators';
import rawCatalog from '../../data/wigs.json';

export const createWigCatalogSeam = (): WigCatalogSeam => {
  let cachedWigs: Wig[] | null = null;

  const loadWigs = (): Result<Wig[], { code: 'WIG_CATALOG_LOAD_FAILED'; message: string } | { code: 'WIG_CATALOG_EMPTY'; message: string }> => {
    if (cachedWigs) return { ok: true, value: cachedWigs };

    try {
      const wigs = validateWigCatalog(rawCatalog);
      if (wigs.length === 0) {
        return { ok: false, error: { code: 'WIG_CATALOG_EMPTY', message: 'Wig catalog is empty.' } };
      }
      cachedWigs = wigs;
      return { ok: true, value: wigs };
    } catch {
      return {
        ok: false,
        error: { code: 'WIG_CATALOG_LOAD_FAILED', message: 'Failed to parse wig catalog data.' }
      };
    }
  };

  return {
    listWigs: async () => loadWigs(),

    getWigById: async (id: string) => {
      const catalogResult = loadWigs();
      if (!catalogResult.ok) return catalogResult;

      const wig = catalogResult.value.find((w) => w.id === id);
      if (!wig) {
        return {
          ok: false,
          error: { code: 'WIG_NOT_FOUND', message: `No wig found with id: ${id}`, details: { id } }
        };
      }
      return { ok: true, value: wig };
    }
  };
};
