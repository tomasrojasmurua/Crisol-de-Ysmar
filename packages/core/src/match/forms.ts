import { applyStatus, dealDamage, healWizard } from '../combat/hit';
import { distance, length, normalize, sub } from '../math/vec2';
import type { GameRules } from '../rules';
import { isHiddenFrom } from './queries';
import type { MatchState, Wizard } from './state';

/**
 * Lo que hacen las transformaciones cada paso: el magma deja el suelo ardiendo, la ola empapa
 * a los rivales que cruza y la pantera da zarpazos que roban vida.
 */
export function updateForms(state: MatchState, wizard: Wizard, rules: GameRules): void {
  const s = wizard.statuses;
  // Solo deja fuego al caminar: quieto no se acumula.
  const walking = length(wizard.moveInput) > 0.1;
  if (s.magma && walking && state.tick % rules.statuses.magma.trailEvery === 0) {
    const ticks = rules.spells.magmaForm.trailTicks;
    state.spells.push({
      kind: 'zone',
      id: state.nextEntityId++,
      ownerId: wizard.id,
      team: wizard.team,
      pos: wizard.pos,
      radius: rules.spells.magmaForm.trailRadius,
      effect: 'burn',
      durationTicks: ticks,
      ticksLeft: ticks,
    });
  }
  if (s.surfing) {
    const reach = rules.wizard.radius * 2 + 0.3;
    for (const other of state.wizards) {
      if (other.team === wizard.team || other.hp <= 0 || other.statuses.soaked) continue;
      if (distance(other.pos, wizard.pos) > reach) continue;
      applyStatus(state, other, 'soaked', wizard.id, rules);
      state.events.push({ type: 'burst', spell: 'surf', pos: other.pos, radius: 1 });
    }
  }
  if (s.panther && state.tick % rules.statuses.panther.intervalTicks === 0)
    claw(state, wizard, rules);
}

/** Zarpazo de la pantera: al rival más cercano a su alcance, y se cura con lo que hizo. */
function claw(state: MatchState, panther: Wizard, rules: GameRules): void {
  const spec = rules.statuses.panther;
  let prey: Wizard | undefined;
  let best = spec.reach + rules.wizard.radius;
  for (const other of state.wizards) {
    if (other.team === panther.team || other.hp <= 0 || isHiddenFrom(other, panther, rules)) {
      continue;
    }
    const d = distance(other.pos, panther.pos);
    if (d <= best) {
      prey = other;
      best = d;
    }
  }
  if (!prey) return;
  panther.facing = normalize(sub(prey.pos, panther.pos), panther.facing);
  const before = prey.hp;
  dealDamage(state, prey, panther.id, spec.damage, 'mark');
  healWizard(state, panther, before - prey.hp);
  state.events.push({ type: 'burst', spell: 'shadowPanther', pos: prey.pos, radius: 0.9 });
}
