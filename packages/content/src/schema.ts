import { ELEMENT_IDS } from '@crisol/core';
import { z } from 'zod';

export const elementIdSchema = z.enum(ELEMENT_IDS);

const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, 'Color en formato #rrggbb');

export const elementDataSchema = z.object({
  id: elementIdSchema,
  /** Nombre visible en el juego. */
  name: z.string().min(1),
  theme: z.string().min(1),
  role: z.string().min(1),
  /** Color de los orbes y conjuros: la magia es lo único con color intenso. */
  color: hexColor,
});

export const affinityRulesSchema = z.object({
  /** Multiplicador de la fatiga del elemento elegido (0.75 = se cansa 25% más lento). */
  ownFatigueMultiplier: z.number().positive(),
  /** Multiplicador de la fatiga de los dos elementos opuestos. */
  opposingFatigueMultiplier: z.number().positive(),
});

export type ElementData = z.infer<typeof elementDataSchema>;
export type AffinityRules = z.infer<typeof affinityRulesSchema>;
