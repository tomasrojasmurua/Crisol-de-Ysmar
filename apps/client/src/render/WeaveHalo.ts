import { type ElementId, MAX_WEAVE_LENGTH } from '@crisol/core';
import * as THREE from 'three';
import { elementColor, glow } from './palette';

/** Altura del tejido sobre el suelo: por encima de cualquier sombrero. */
const HALO_Y = 2.75;
const SLOT_GAP = 0.42;
const ORB_RADIUS = 0.16;

/**
 * El tejido flotando sobre la cabeza: tres huecos en fila, de izquierda a derecha en el orden en
 * que se tejió, siempre de frente a la cámara. Se lee de lejos qué viene y cuánto falta.
 * Al canalizar, los orbes crecen y se juntan al centro hasta que el hechizo sale.
 */
export class WeaveHalo {
  readonly group = new THREE.Group();
  private readonly orbs: THREE.Mesh[] = [];
  private readonly sockets: THREE.Mesh[] = [];

  constructor() {
    this.group.position.y = HALO_Y;
    const orbGeometry = new THREE.SphereGeometry(ORB_RADIUS, 14, 10);
    const socketGeometry = new THREE.RingGeometry(ORB_RADIUS * 0.75, ORB_RADIUS, 20);
    const socketMaterial = new THREE.MeshBasicMaterial({
      color: '#d8c9a3',
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (let i = 0; i < MAX_WEAVE_LENGTH; i++) {
      const socket = new THREE.Mesh(socketGeometry, socketMaterial);
      socket.position.x = slotX(i);
      socket.visible = false;
      this.sockets.push(socket);
      const orb = new THREE.Mesh(orbGeometry, new THREE.MeshBasicMaterial());
      orb.visible = false;
      this.orbs.push(orb);
      this.group.add(socket, orb);
    }
  }

  /**
   * `weave` es lo que se está tejiendo (o canalizando); `progress` va de 0 a 1 al canalizar.
   * `viewYaw` es hacia dónde mira la cámara, para quedar de frente.
   */
  update(
    weave: readonly ElementId[],
    progress: number,
    channeling: boolean,
    alive: boolean,
    timeSeconds: number,
    viewYaw: number,
  ): void {
    const showing = alive && weave.length > 0;
    this.group.visible = showing;
    if (!showing) return;
    this.group.rotation.y = viewYaw;
    const gather = channeling ? Math.min(1, progress) : 0;
    for (let i = 0; i < MAX_WEAVE_LENGTH; i++) {
      const element = weave[i];
      const orb = this.orbs[i];
      const socket = this.sockets[i];
      if (!orb || !socket) continue;
      // Los huecos vacíos solo mientras se teje: muestran cuánto falta.
      socket.visible = !channeling && element === undefined;
      orb.visible = element !== undefined;
      if (element === undefined) continue;
      (orb.material as THREE.MeshBasicMaterial).color.copy(glow(elementColor(element), 2.4));
      const center = slotX((weave.length - 1) / 2);
      const x = slotX(i) + (center - slotX(i)) * gather * 0.85;
      const bob = Math.sin(timeSeconds * 3 + i * 1.7) * 0.04;
      orb.position.set(x, bob + gather * 0.15, 0);
      const pulse = channeling ? 1 + Math.sin(timeSeconds * 18) * 0.08 : 1;
      orb.scale.setScalar((1 + gather * 0.6) * pulse);
    }
  }
}

function slotX(i: number): number {
  return (i - (MAX_WEAVE_LENGTH - 1) / 2) * SLOT_GAP;
}
