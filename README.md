# Meechies Coloring Book

A SvelteKit + TypeScript app for generating black-and-white, outline-only coloring book pages.

## Requirements

- Node.js 20+
- npm

## Setup

```bash
npm install
```

## Development

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Testing

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Environment

Create a `.env` file based on `.env.example`.

```
XAI_API_KEY=your_key_here
XAI_TEXT_MODEL=grok-4.1-fast-reasoning
XAI_IMAGE_MODEL=grok-2-image
XAI_BASE_URL=https://api.x.ai/v1
XAI_IMAGE_ENDPOINT_PATH=/images/generations
FEATURE_INTEGRATION_TESTS=false
MAX_IMAGES_PER_REQUEST=4
DEFAULT_IMAGE_SIZE=1024x1024
```

## Notes

- Unit tests run offline by default using mocks.
- Integration tests require `FEATURE_INTEGRATION_TESTS=true` and valid xAI credentials.
- Note: the xAI image API does not support `size` or `quality` at this time, so `DEFAULT_IMAGE_SIZE` is retained for future compatibility.
