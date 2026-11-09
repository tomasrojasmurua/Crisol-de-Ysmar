import * as THREE from 'three';

/** Arena de prueba: suelo de piedra oscura, niebla y una figura que hace de mago. */
export function createArenaScene(): { scene: THREE.Scene; wizard: THREE.Object3D } {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0b0b10');
  scene.fog = new THREE.Fog('#0b0b10', 12, 40);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(20, 48),
    new THREE.MeshStandardMaterial({ color: '#2a2824', roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wizard = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.2, 6, 12),
    new THREE.MeshStandardMaterial({ color: '#3b3a40', roughness: 0.8 }),
  );
  wizard.position.y = 1;
  scene.add(wizard);

  scene.add(new THREE.HemisphereLight('#6b6f80', '#1a1712', 0.6));
  const moon = new THREE.DirectionalLight('#b8c4ff', 1.2);
  moon.position.set(-6, 10, 4);
  scene.add(moon);

  return { scene, wizard };
}
