// Purpose: Probe real behavior for GalleryStoreSeam.
// Why: Capture real outputs to refresh fixtures.
// Info flow: probe I/O -> recorded fixtures.
import type { GalleryRecord, GalleryStoreSeam } from './contract';

export const probeGalleryStoreSeam = async (
  seam: GalleryStoreSeam,
  record: GalleryRecord
) => {
  await seam.save(record);
  return seam.listRecent(1);
};
