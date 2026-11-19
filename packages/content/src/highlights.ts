import type { HighlightRules } from '@crisol/core';
import { z } from 'zod';

const count = z.number().int().nonnegative();
const points = z.number().nonnegative();

/**
 * Cómo se elige la mejor jugada de cada ronda y de la partida (ver
 * `packages/core/src/match/highlights.ts`). Un mago tiene 180 de vida: derribar vale como un
 * tercio de una vida de daño, alcanzar a otro rival o cerrar la ronda pesa menos.
 */
export const HIGHLIGHT_RULES: HighlightRules = z
  .object({
    gapTicks: count,
    minHit: points,
    maxTicks: count,
    leadTicks: count,
    damage: points,
    knockout: points,
    extraTarget: points,
    reaction: points,
    decisive: points,
    maxSpells: z.number().int().positive(),
  })
  .parse({
    // 2 s sin golpear cierra la jugada; lo lanzado 1,5 s antes del primer golpe cuenta.
    gapTicks: 60,
    // Los golpes de verdad pegan 3 o más; lo que gotea (quemaduras, zonas) pega menos de 1 por paso.
    minHit: 1,
    // Una jugada es una ráfaga de hasta 5 s: un asedio más largo se parte en tramos.
    maxTicks: 150,
    leadTicks: 45,
    damage: 1,
    knockout: 60,
    extraTarget: 20,
    reaction: 12,
    decisive: 25,
    maxSpells: 4,
  });
