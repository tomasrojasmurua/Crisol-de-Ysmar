import * as THREE from 'three';

/** Arena gris de prueba: suelo de piedra, borde, columnas decorativas y luz de luna. */
export function createArenaScene(arenaRadius: number): THREE.Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0b10');
  scene.fog = new THREE.Fog('#0b0b10', 18, 55);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(arenaRadius + 6, 64),
    new THREE.MeshStandardMaterial({ color: '#2a2824', roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const edge = new THREE.Mesh(
    new THREE.RingGeometry(arenaRadius - 0.08, arenaRadius + 0.08, 96),
    new THREE.MeshBasicMaterial({ color: '#6d665a' }),
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.y = 0.01;
  scene.add(edge);

  const pillarGeometry = new THREE.CylinderGeometry(0.6, 0.8, 6, 8);
  const pillarMaterial = new THREE.MeshStandardMaterial({ color: '#3a3731', roughness: 0.9 });
  const pillars = new THREE.InstancedMesh(pillarGeometry, pillarMaterial, 12);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const r = arenaRadius + 2.5;
    matrix.makeTranslation(Math.cos(angle) * r, 3, Math.sin(angle) * r);
    pillars.setMatrixAt(i, matrix);
  }
  scene.add(pillars);

  scene.add(new THREE.HemisphereLight('#7d8296', '#2a241c', 1.6));
  const moon = new THREE.DirectionalLight('#b8c4ff', 1.3);
  moon.position.set(-8, 14, 6);
  scene.add(moon);
  // Luz de relleno desde el lado opuesto, para que el mago no quede negro visto de espaldas.
  const fill = new THREE.DirectionalLight('#8a7f6e', 0.7);
  fill.position.set(6, 8, -10);
  scene.add(fill);

  return scene;
}
