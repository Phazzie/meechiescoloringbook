// Purpose: Define WigCatalogSeam contract types.
// Why: Keep wig catalog interfaces explicit and shared across implementations.
// Info flow: contract types -> adapters/mocks/tests -> UI carousel.
import type { Result } from '../../../../contracts/shared.contract';

export type AffiliateProgram = 'beautyforever' | 'wigsbuy' | 'luvmehair';
export type HairType = 'human' | 'synthetic' | 'blend';
export type WigLength = 'short' | 'medium' | 'long' | 'extra-long';
export type ColorFamily = 'black' | 'brown' | 'blonde' | 'red' | 'gray' | 'vibrant' | 'ombre';

export type Wig = {
  id: string;
  name: string;
  brand: string;
  affiliateProgram: AffiliateProgram;
  affiliateUrl: string;
  imageUrl: string;
  priceUsd: number;
  style: string;
  hairType: HairType;
  length: WigLength;
  color: string;
  colorFamily: ColorFamily;
  tags: string[];
};

export type WigCatalogError =
  | { code: 'WIG_CATALOG_LOAD_FAILED'; message: string }
  | { code: 'WIG_CATALOG_EMPTY'; message: string }
  | { code: 'WIG_NOT_FOUND'; message: string; details: { id: string } };

export type WigCatalogSeam = {
  listWigs: () => Promise<Result<Wig[], WigCatalogError>>;
  getWigById: (id: string) => Promise<Result<Wig, WigCatalogError>>;
};
