const STORAGE_KEY = 'crisol.numerosDeDano';

/**
 * Si se muestran los números de daño en las partidas (en Pausa; apagado por defecto). En el
 * entrenamiento y el tutorial se ven siempre: ahí sirven para aprender qué acierta.
 */
export function readDamageNumbers(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'si';
  } catch {
    return false;
  }
}

export function saveDamageNumbers(on: boolean): void {
  try {
    if (on) localStorage.setItem(STORAGE_KEY, 'si');
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Sin almacenamiento: vale solo por esta vez.
  }
}
