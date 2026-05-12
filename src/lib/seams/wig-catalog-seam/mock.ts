// Purpose: Mock WigCatalogSeam behavior using fixtures.
// Why: Keep tests deterministic without filesystem reads.
// Info flow: tests -> mock -> fixtures.
import type { Wig, WigCatalogError, WigCatalogSeam } from './contract';
import type { Result } from '../../../../contracts/shared.contract';
import {
  sampleWigCatalogFixture,
  wigCatalogLoadFailedFixture
} from './fixtures';

export const createMockWigCatalogSeam = (
  scenario: 'sample' | 'empty' | 'load_failed' = 'sample'
): WigCatalogSeam => ({
  listWigs: async (): Promise<Result<Wig[], WigCatalogError>> => {
    if (scenario === 'load_failed') {
      return { ok: false, error: wigCatalogLoadFailedFixture };
    }
    if (scenario === 'empty') {
      return { ok: false, error: { code: 'WIG_CATALOG_EMPTY', message: 'No wigs in catalog.' } };
    }
    return { ok: true, value: sampleWigCatalogFixture };
  },

  getWigById: async (id: string): Promise<Result<Wig, WigCatalogError>> => {
    if (scenario === 'load_failed') {
      return { ok: false, error: wigCatalogLoadFailedFixture };
    }
    const wig = sampleWigCatalogFixture.find((w) => w.id === id);
    if (!wig) {
      return {
        ok: false,
        error: { code: 'WIG_NOT_FOUND', message: `No wig found with id: ${id}`, details: { id } }
      };
    }
    return { ok: true, value: wig };
  }
});
