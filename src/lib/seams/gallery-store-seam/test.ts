// Purpose: Contract tests for GalleryStoreSeam.
// Why: Enforce mock adherence to the seam contract and prove fault fixtures fail validation.
// Info flow: tests -> mock -> contract assertions.
import { describe, expect, it } from 'vitest';
import { galleryRecordFixture, galleryRecordFaultFixture } from './fixtures';
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

  it('listRecent respects the limit', async () => {
    const seam = createMockGalleryStoreSeam();
    await seam.save({ ...galleryRecordFixture, id: 'r1' });
    await seam.save({ ...galleryRecordFixture, id: 'r2' });
    await seam.save({ ...galleryRecordFixture, id: 'r3' });
    const records = await seam.listRecent(2);

    expect(records).toHaveLength(2);
    expect(records.map((r) => r.id)).toEqual(['r3', 'r2']);
  });

  it('records are isolated per mock instance', async () => {
    const seam1 = createMockGalleryStoreSeam();
    const seam2 = createMockGalleryStoreSeam();
    await seam1.save(galleryRecordFixture);

    const records1 = await seam1.listRecent(10);
    const records2 = await seam2.listRecent(10);

    expect(records1).toHaveLength(1);
    expect(records2).toHaveLength(0);
  });

  it('validator rejects a fault record (empty id and createdAt)', () => {
    expect(() => validateGalleryRecord(galleryRecordFaultFixture)).toThrow();
  });
});
