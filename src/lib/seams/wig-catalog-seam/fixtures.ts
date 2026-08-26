// Purpose: Provide fixture data for WigCatalogSeam.
// Why: Ensure deterministic mock and test inputs without live catalog reads.
// Info flow: fixtures -> mocks/tests.
import type { Wig } from './contract';

export const sampleWigFixture: Wig = {
  id: 'wig-001',
  name: 'Sleek Straight Goddess',
  brand: 'Beautyforever',
  affiliateProgram: 'beautyforever',
  affiliateUrl: 'https://www.beautyforever.com/straight-lace-front-wigs.html?utm_source=meechie',
  imageUrl: 'https://placehold.co/300x380/1a1a1a/ffffff?text=Sleek+Straight',
  priceUsd: 89.99,
  style: 'Straight Lace Front',
  hairType: 'human',
  length: 'medium',
  color: 'Natural Black',
  colorFamily: 'black',
  tags: ['sleek', 'professional', 'versatile']
};

export const sampleWigCatalogFixture: Wig[] = [
  sampleWigFixture,
  {
    id: 'wig-002',
    name: 'Big Body Wave Queen',
    brand: 'Beautyforever',
    affiliateProgram: 'beautyforever',
    affiliateUrl: 'https://www.beautyforever.com/body-wave-lace-front-wigs.html?utm_source=meechie',
    imageUrl: 'https://placehold.co/300x380/2d1b00/ffffff?text=Body+Wave',
    priceUsd: 109.99,
    style: 'Body Wave Lace Front',
    hairType: 'human',
    length: 'long',
    color: 'Natural Black',
    colorFamily: 'black',
    tags: ['voluminous', 'glamorous', 'wavy']
  }
];

export const acceptedWigImageUrlFixtures = [
  '/wigs/example.jpg',
  '/wigs/example.jpeg',
  '/wigs/example.png',
  '/wigs/example.webp',
  'https://cdn.example.com/wigs/example.jpg?version=1',
  'http://cdn.example.com/wigs/example.jpg'
] as const;

export const rejectedWigImageUrlFixtures = [
  '//evil.example/wig.jpg',
  '/wigs/../secret.jpg',
  '/wigs/%2e%2e/secret.jpg',
  '/wigs/example.jpg?version=1',
  '/wigs/example.jpg#preview',
  '/wigs/nested/example.jpg',
  '/wigs/example.svg',
  '/assets/example.jpg',
  'javascript:alert(1)',
  'data:image/png;base64,AAAA',
  'ftp://cdn.example.com/wigs/example.jpg',
  'http:cdn.example.com/wigs/example.jpg',
  ' https://cdn.example.com/wigs/example.jpg'
] as const;

export const wigCatalogLoadFailedFixture = {
  code: 'WIG_CATALOG_LOAD_FAILED' as const,
  message: 'Failed to load wig catalog data.'
};

export const wigNotFoundFixture = {
  code: 'WIG_NOT_FOUND' as const,
  message: 'No wig found with id: wig-999',
  details: { id: 'wig-999' }
};
