/**
 * Evita que el navegador del celular haga zoom o desplace la página mientras se juega.
 * Safari en iOS ignora `user-scalable=no` y parte de `touch-action`, así que además
 * se cancelan sus gestos de pellizco y el doble toque.
 */
export function blockBrowserGestures(target: Document = document): void {
  const cancel = (event: Event): void => event.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick', 'contextmenu']) {
    target.addEventListener(type, cancel, { passive: false });
  }
  target.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );

  // Dos toques seguidos en menos de 300 ms disparan el zoom de iOS.
  let lastTouchEnd = 0;
  target.addEventListener(
    'touchend',
    (event) => {
      if (event.timeStamp - lastTouchEnd < 300) event.preventDefault();
      lastTouchEnd = event.timeStamp;
    },
    { passive: false },
  );
}
