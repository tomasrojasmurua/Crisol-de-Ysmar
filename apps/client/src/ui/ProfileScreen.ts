import { ELEMENTS, spellName } from '@crisol/content';
import { type ElementId, SPELL_WEAVES, type SpellId } from '@crisol/core';
import { MODE_GROUPS, type ModeGroup, type PlayerRecord, topSpells } from '../game/PlayerStats';
import type { Profile } from '../game/Profile';
import { el, query } from './dom';
import { weaveOrbs } from './GrimoireBook';
import { elementIcon } from './icons';

const MODE_NAMES: Record<ModeGroup, string> = {
  duel: 'Duelo',
  teams: 'Equipos',
  ffa: 'Todos contra todos',
};

const formatNumber = (value: number): string => Math.round(value).toLocaleString('es-CL');

/** "3 de 5" o "—" si no hay partidas. */
const winsOf = (wins: number, played: number): string =>
  played === 0 ? '—' : `${wins} de ${played}`;

/** El elemento que más tejes, contando cada elemento de cada hechizo lanzado. */
function favoriteElement(spells: Partial<Record<SpellId, number>>): ElementId | null {
  const totals = new Map<ElementId, number>();
  for (const [spell, count] of Object.entries(spells) as [SpellId, number][]) {
    for (const element of SPELL_WEAVES[spell] ?? []) {
      totals.set(element, (totals.get(element) ?? 0) + count);
    }
  }
  let best: ElementId | null = null;
  let bestCount = 0;
  for (const [element, count] of totals) {
    if (count > bestCount) {
      best = element;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Tu perfil: lo que llevas jugado desde que creaste a tu hechicero. Se abre desde la tarjeta de
 * tu mago en el menú. Arriba las cuatro cifras grandes; abajo el combate, tus favoritos y cómo
 * te va en cada modo.
 */
export class ProfileScreen {
  private readonly root: HTMLElement;
  private readonly title: HTMLElement;
  private readonly lineage: HTMLElement;
  private readonly tiles: HTMLElement;
  private readonly empty: HTMLElement;
  private readonly combat: HTMLElement;
  private readonly favorites: HTMLElement;
  private readonly modes: HTMLElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'home-invite profile-sheet');
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-label', 'Tu perfil');
    this.root.innerHTML = `
      <div class="home-invite-card profile-card">
        <header class="home-invite-head">
          <h2 class="profile-title"></h2>
          <button type="button" class="grimoire-card-close" aria-label="Cerrar">×</button>
        </header>
        <p class="profile-lineage"></p>
        <div class="profile-tiles"></div>
        <p class="profile-empty" hidden>Juega una partida contra la IA o con amigos y aquí verás tu historial.</p>
        <div class="profile-columns">
          <section class="profile-block">
            <h3>En combate</h3>
            <dl class="profile-list profile-combat"></dl>
          </section>
          <section class="profile-block">
            <h3>Tus favoritos</h3>
            <ol class="profile-favorites"></ol>
            <h3>Victorias por modo</h3>
            <dl class="profile-list profile-modes"></dl>
          </section>
        </div>
      </div>`;
    parent.append(this.root);
    this.title = query(this.root, '.profile-title');
    this.lineage = query(this.root, '.profile-lineage');
    this.tiles = query(this.root, '.profile-tiles');
    this.empty = query(this.root, '.profile-empty');
    this.combat = query(this.root, '.profile-combat');
    this.favorites = query(this.root, '.profile-favorites');
    this.modes = query(this.root, '.profile-modes');
    query(this.root, '.grimoire-card-close').addEventListener('click', () => this.close());
    this.root.addEventListener('click', (event) => {
      if (event.target === this.root) this.close();
    });
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  open(profile: Profile, record: PlayerRecord): void {
    this.title.textContent = profile.name || 'Tu perfil';
    const school = ELEMENTS.find((e) => e.id === profile.school);
    this.lineage.textContent = school ? `Linaje de ${school.name}` : '';
    this.lineage.hidden = !school;
    if (school) this.root.style.setProperty('--linaje', school.color);

    const losses = record.played - record.wins - record.draws;
    const rate = record.played === 0 ? '—' : `${Math.round((record.wins / record.played) * 100)}%`;
    this.tiles.replaceChildren(
      tile('Partidas', formatNumber(record.played)),
      tile('Victorias', formatNumber(record.wins), `${formatNumber(losses)} derrotas`),
      tile('% de victorias', rate),
      tile('Mejor racha', formatNumber(record.bestStreak), `Ahora: ${record.streak}`),
    );
    this.empty.hidden = record.played > 0;

    fillList(this.combat, [
      ['Daño hecho', formatNumber(record.damage)],
      ['Derribos', formatNumber(record.knockouts)],
      ['Caídas', formatNumber(record.falls)],
      ['Hechizos lanzados', formatNumber(record.casts)],
      ['Reacciones', formatNumber(record.reactions)],
      ['Bestias', formatNumber(record.beasts)],
      ['Más daño en una partida', formatNumber(record.bestDamage)],
      ['Más derribos en una partida', formatNumber(record.bestKnockouts)],
    ]);

    const top = topSpells(record, 3);
    if (top.length === 0) {
      this.favorites.replaceChildren(el('li', 'profile-favorite-none', 'Aún no lanzas hechizos'));
    } else {
      this.favorites.replaceChildren(
        ...top.map(({ spell, count }) => {
          const weave = SPELL_WEAVES[spell];
          const item = el('li', 'profile-favorite');
          item.append(
            weaveOrbs(weave),
            el('span', 'profile-favorite-name', spellName(weave)),
            el('span', 'profile-favorite-count', `×${formatNumber(count)}`),
          );
          return item;
        }),
      );
      const element = favoriteElement(record.spells);
      const data = ELEMENTS.find((e) => e.id === element);
      if (element && data) {
        const item = el('li', 'profile-favorite profile-favorite-element');
        const icon = el('span', 'profile-element-icon');
        icon.innerHTML = elementIcon(element);
        icon.style.setProperty('--icon-color', data.color);
        item.append(icon, el('span', 'profile-favorite-name', `Elemento: ${data.name}`));
        this.favorites.append(item);
      }
    }

    fillList(this.modes, [
      ...MODE_GROUPS.map((mode): [string, string] => [
        MODE_NAMES[mode],
        winsOf(record.byMode[mode].wins, record.byMode[mode].played),
      ]),
      ['En red', winsOf(record.online.wins, record.online.played)],
    ]);
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
  }
}

function tile(label: string, value: string, note = ''): HTMLElement {
  const box = el('div', 'profile-tile');
  box.append(el('strong', 'profile-tile-value', value), el('span', 'profile-tile-label', label));
  if (note) box.append(el('span', 'profile-tile-note', note));
  return box;
}

function fillList(list: HTMLElement, rows: readonly (readonly [string, string])[]): void {
  list.replaceChildren(
    ...rows.map(([label, value]) => {
      const row = el('div', 'profile-row');
      row.append(el('dt', '', label), el('dd', '', value));
      return row;
    }),
  );
}
