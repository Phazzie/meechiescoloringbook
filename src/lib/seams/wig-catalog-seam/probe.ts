// Purpose: Probe real WigCatalogSeam behavior.
// Why: Capture real outputs to refresh fixtures when catalog data changes.
// Info flow: probe I/O -> recorded fixtures.
import type { WigCatalogSeam } from './contract';

export const probeWigCatalogList = async (seam: WigCatalogSeam) => seam.listWigs();

export const probeWigCatalogGetById = async (seam: WigCatalogSeam, id: string) =>
  seam.getWigById(id);
