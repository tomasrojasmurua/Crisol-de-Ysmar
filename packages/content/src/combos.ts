import type { ComboId } from '@crisol/core';

/** Nombre y explicación de cada reacción entre estados, para el aviso en pantalla y el Grimorio. */
export const COMBO_TEXT: Readonly<
  Record<ComboId, { readonly name: string; readonly detail: string }>
> = {
  conduction: { name: 'Conducción', detail: 'Tormenta sobre empapado: aturde 0,6 s.' },
  shatter: { name: 'Quiebre', detail: 'Tormenta sobre congelado: rompe el hielo con 50% más.' },
  kindling: { name: 'Leña', detail: 'Brasa sobre enraizado: 25% más y quema 3 s.' },
  steam: { name: 'Vapor', detail: 'Marea sobre quien arde: apaga el fuego y quita escudos 3 s.' },
  ashenCurse: {
    name: 'Brasa maldita',
    detail: 'Umbra sobre quien arde: el fuego se vuelve maldición.',
  },
  mire: { name: 'Lodazal', detail: 'Raíz sobre empapado: enraiza 1 s.' },
};
