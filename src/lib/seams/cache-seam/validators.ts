// Purpose: Validate CacheSeam inputs.
// Why: Catch invalid cache names and empty URL lists before they reach the Web Cache API.
// Info flow: adapter/mock -> validators -> typed values or thrown ZodErrors.
import { z } from 'zod';

export const cacheNameSchema = z.string().min(1, 'Cache name must not be empty.');
export const cacheUrlListSchema = z.array(z.string().min(1)).min(1, 'URL list must not be empty.');

export const validateCacheName = (input: unknown) => cacheNameSchema.parse(input);
export const validateCacheUrlList = (input: unknown) => cacheUrlListSchema.parse(input);
