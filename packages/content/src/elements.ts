import { type ElementData, elementDataSchema } from './schema';

const rawElements = [
  {
    id: 'brasa',
    name: 'Brasa',
    theme: 'Fuego',
    role: 'Daño directo y quemaduras',
    color: '#ff6a2b',
  },
  {
    id: 'tormenta',
    name: 'Tormenta',
    theme: 'Rayo y viento',
    role: 'Movilidad y encadenar',
    color: '#8fd3ff',
  },
  {
    id: 'marea',
    name: 'Marea',
    theme: 'Agua y hielo',
    role: 'Control, ralentizar y escudos',
    color: '#2f7dff',
  },
  {
    id: 'raiz',
    name: 'Raíz',
    theme: 'Naturaleza',
    role: 'Curación, trampas y bestias',
    color: '#5fd068',
  },
  {
    id: 'umbra',
    name: 'Umbra',
    theme: 'Sombra',
    role: 'Maldiciones y robo de vida',
    color: '#a35cff',
  },
] satisfies ElementData[];

export const ELEMENTS: readonly ElementData[] = elementDataSchema.array().parse(rawElements);
