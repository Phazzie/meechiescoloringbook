// Purpose: Contract tests for WigCatalogSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail before mocking.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import {
  acceptedWigImageUrlFixtures,
  rejectedWigImageUrlFixtures,
  sampleWigFixture,
  sampleWigCatalogFixture,
  wigCatalogLoadFailedFixture,
  wigNotFoundFixture
} from './fixtures';
import { createMockWigCatalogSeam } from './mock';
import { validateWig, validateWigCatalog } from './validators';

describe('WigCatalogSeam mock contract', () => {
  it('listWigs returns a full catalog on sample scenario', async () => {
    const seam = createMockWigCatalogSeam('sample');
    const result = await seam.listWigs();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(sampleWigCatalogFixture.length);
    expect(() => validateWigCatalog(result.value)).not.toThrow();
  });

  it('listWigs fault fixture returns a failing Result', async () => {
    const seam = createMockWigCatalogSeam('load_failed');
    const result = await seam.listWigs();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(wigCatalogLoadFailedFixture.code);
  });

  it('listWigs returns empty error on empty scenario', async () => {
    const seam = createMockWigCatalogSeam('empty');
    const result = await seam.listWigs();

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WIG_CATALOG_EMPTY');
  });

  it('getWigById returns a wig when id exists', async () => {
    const seam = createMockWigCatalogSeam('sample');
    const result = await seam.getWigById(sampleWigFixture.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(sampleWigFixture.id);
    expect(() => validateWig(result.value)).not.toThrow();
  });

  it('getWigById returns WIG_NOT_FOUND for unknown id', async () => {
    const seam = createMockWigCatalogSeam('sample');
    const result = await seam.getWigById(wigNotFoundFixture.details.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('WIG_NOT_FOUND');
  });

  it('each wig in sample catalog passes validateWig', () => {
    for (const wig of sampleWigCatalogFixture) {
      expect(() => validateWig(wig)).not.toThrow();
    }
  });

  it.each(acceptedWigImageUrlFixtures)('accepts safe wig image URL %s', (imageUrl) => {
    expect(() => validateWig({ ...sampleWigFixture, imageUrl })).not.toThrow();
  });

  it.each(rejectedWigImageUrlFixtures)('rejects unsafe wig image URL %s', (imageUrl) => {
    expect(() => validateWig({ ...sampleWigFixture, imageUrl })).toThrow();
  });
});
