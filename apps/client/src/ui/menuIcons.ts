/**
 * Íconos de los menús: grilla de 24, trazo de 2, color por `currentColor`. Acompañan a las
 * etiquetas, no las reemplazan (la lectura inmediata importa más que la decoración).
 */
function icon(paths: string): string {
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
  );
}

export const MENU_ICONS = {
  wardrobe: icon('<path d="M9 5a3 3 0 0 1 6 0c0 1.5-1 2.5-3 3.5V12l8 5v3H4v-3l8-5V8.5"/>'),
  grimoire: icon(
    '<path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z"/><path d="M12 6v14"/>',
  ),
  soundAll: icon(
    '<path d="M4 9h4l5-4v14l-5-4H4Z"/><path d="M17 9c2 2 2 4 0 6"/><path d="M20 6c4 4 4 8 0 12"/>',
  ),
  soundEffects: icon(
    '<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M16 8l1.2 2.8L20 12l-2.8 1.2L16 16l-1.2-2.8L12 12l2.8-1.2Z"/>',
  ),
  soundOff: icon('<path d="M3 9h4l5-4v14l-5-4H3Z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  friend: icon(
    '<circle cx="9" cy="8" r="4"/><path d="M2 20v-2a7 7 0 0 1 14 0v2Z"/><path d="M18 8h5M20.5 5.5v5"/>',
  ),
  training: icon(
    '<path d="M20 12a8 8 0 1 1-8-8"/><path d="M17 12a5 5 0 1 1-5-5"/><path d="M12 12l9-9M17 3h4v4"/>',
  ),
  copy: icon(
    '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
  ),
  back: icon('<path d="M10 5L3 12l7 7M3 12h18"/>'),
  leave: icon(
    '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M14 7l5 5-5 5M8 12h11"/>',
  ),
  /** Duelo: dos hojas cruzadas. */
  duel: icon(
    '<path d="M4 4l12 12M20 4L8 16"/><path d="M14 18l4-4M10 18l-4-4M18 18l2 2M6 18l-2 2"/>',
  ),
  /** Equipos: tres figuras. */
  teams: icon(
    '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="9" r="2"/><circle cx="19" cy="9" r="2"/><path d="M7 20a5 5 0 0 1 10 0M1.5 18a3.5 3.5 0 0 1 5-3M22.5 18a3.5 3.5 0 0 0-5-3"/>',
  ),
  /** Todos contra todos: una corona para el último en pie. */
  ffa: icon('<path d="M3 18h18M4 15l-1-9 5 4 4-6 4 6 5-4-1 9Z"/>'),
  /** Revancha: dos flechas que se persiguen en círculo. */
  rematch: icon(
    '<path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4"/><path d="M5 3v4h4M19 21v-4h-4"/>',
  ),
  pause: icon('<path d="M9 5v14M15 5v14"/>'),
  chevron: icon('<path d="M9 6l6 6-6 6"/>'),
  /** Estrella de cuatro puntas, sólida: adorna el botón principal. */
  star: icon(
    '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" fill="currentColor"/>',
  ),
} as const;
