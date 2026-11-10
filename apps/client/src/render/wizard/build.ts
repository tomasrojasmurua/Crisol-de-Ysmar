import type * as THREE from 'three';
import { buildFace } from './faces';
import { buildFocus } from './foci';
import { buildHeadwear } from './headwear';
import type { ModelKit } from './kit';
import { buildMask } from './masks';
import { buildCape, buildOutfit } from './outfits';

/** Las piezas del Vestidor que forman a un hechicero. */
export interface ModelPieces {
  readonly face: string;
  readonly outfit: string;
  readonly headwear: string;
  readonly mask: string;
  readonly cape: string;
  readonly focus: string;
}

/** Lo que el resto del dibujo necesita saber del modelo armado. */
export interface WizardModel {
  /** La túnica: la Afinidad le pone grietas, escarcha o humo encima. */
  readonly robe: THREE.Mesh;
  /** Lo más alto de la cabeza, donde brotan las astas o flotan las runas. */
  readonly headTop: number;
  readonly mouthY: number;
}

/** Arma al hechicero pieza por pieza: ropa, capa, rostro, cabeza, máscara y foco. */
export function buildWizardModel(kit: ModelKit, pieces: ModelPieces): WizardModel {
  const robe = buildOutfit(kit, pieces.outfit);
  buildCape(kit, pieces.cape);
  const deepHood = pieces.headwear === 'capucha';
  const face = buildFace(kit, pieces.face, deepHood);
  const headTop = buildHeadwear(kit, pieces.headwear, face, pieces.face);
  buildMask(kit, pieces.mask, face, deepHood);
  buildFocus(kit, pieces.focus);
  return { robe, headTop: Math.min(headTop, 2.3), mouthY: face.mouthY };
}
