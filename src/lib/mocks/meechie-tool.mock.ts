// Purpose: Preserve the legacy import path for the canonical MeechieToolSeam mock.
// Why: Existing tests can migrate independently without maintaining duplicate fixture behavior.
// Info flow: Legacy imports -> canonical self-contained mock -> tests.
export { createMeechieToolMock } from '../seams/meechie-tool-seam/mock';
