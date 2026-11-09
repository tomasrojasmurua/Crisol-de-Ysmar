import { type AffinityRules, affinityRulesSchema } from './schema';

/** Valores iniciales; la simulación de balance dirá si hay que moverlos. */
export const AFFINITY_RULES: AffinityRules = affinityRulesSchema.parse({
  ownFatigueMultiplier: 0.75,
  opposingFatigueMultiplier: 1.15,
});
