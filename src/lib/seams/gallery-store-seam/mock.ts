import type { GalleryRecord, GalleryStoreSeam } from './contract';

export const createMockGalleryStoreSeam = (initialRecords: GalleryRecord[] = []): GalleryStoreSeam => {
  const records = [...initialRecords];

  return {
    save: async (record) => {
      records.unshift(record);
    },
    listRecent: async (limit) => records.slice(0, limit)
  };
};
