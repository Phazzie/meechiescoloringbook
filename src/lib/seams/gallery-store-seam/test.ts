// Purpose: Contract tests for GalleryStoreSeam.
// Why: Enforce mock adherence to the seam contract.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { galleryRecordFixture } from './fixtures';
import { createMockGalleryStoreSeam } from './mock';
import { validateGalleryRecord } from './validators';

describe('GalleryStoreSeam mock contract', () => {
  it('stores and lists records', async () => {
    const seam = createMockGalleryStoreSeam();
    await seam.save(galleryRecordFixture);
    const records = await seam.listRecent(1);

    expect(records).toEqual([galleryRecordFixture]);
    expect(validateGalleryRecord(records[0])).toEqual(galleryRecordFixture);
  });
});
