import * as THREE from 'three';
import jungleUrl from '../../assets/suelos/jungla.webp';
import mossUrl from '../../assets/suelos/musgo.webp';
import stoneUrl from '../../assets/suelos/piedra-detalle.webp';
import { uploadEarly } from '../earlyUpload';

/**
 * Los suelos ilustrados: tierra de la jungla, musgo y el detalle de la piedra de la plaza. Cada
 * textura nace con un color liso (o con el suelo dibujado en código) y la imagen la reemplaza
 * apenas baja, así nunca se ve un suelo negro mientras carga. El reemplazo tiene que medir lo
 * mismo que la imagen: la tarjeta gráfica reserva el tamaño la primera vez y después solo
 * acepta imágenes que quepan.
 */
export const FLOOR_IMAGE_SIZE = 1024;

function swapIn(texture: THREE.Texture, url: string): THREE.Texture {
  new THREE.ImageLoader().load(url, (image) => {
    texture.image = image;
    texture.needsUpdate = true;
    uploadEarly(texture);
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function flat(color: string): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = FLOOR_IMAGE_SIZE;
  canvas.height = FLOOR_IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, FLOOR_IMAGE_SIZE, FLOOR_IMAGE_SIZE);
  }
  return new THREE.CanvasTexture(canvas);
}

/** La tierra de la jungla; mientras baja, `fallback` (el suelo dibujado en código). */
export function jungleGround(fallback: THREE.Texture): THREE.Texture {
  return swapIn(fallback, jungleUrl);
}

/** El musgo que se mezcla con la tierra en manchas grandes. */
export function mossGround(): THREE.Texture {
  const texture = swapIn(flat('#2c3a12'), mossUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** El detalle de la piedra: gris medio es "sin cambio" (se multiplica por 2). */
export function stoneDetail(): THREE.Texture {
  return swapIn(flat('#808080'), stoneUrl);
}

/**
 * Multiplica el mapa del material por `detail` repetido `repeat` veces: las losas dibujadas en
 * código ganan la textura de la piedra de cerca, sin perder su forma de anillos.
 */
export function addStoneDetail(
  material: THREE.MeshLambertMaterial,
  detail: THREE.Texture,
  repeat: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.floorDetail = { value: detail };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D floorDetail;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        diffuseColor.rgb *= texture2D(floorDetail, vMapUv * ${repeat.toFixed(1)}).rgb * 2.0;`,
      );
  };
  material.customProgramCacheKey = () => 'floor-stone-detail';
}

/**
 * Mezcla el musgo con la tierra en manchas grandes que no se repiten a la vista: la forma de
 * las manchas sale de unas ondas calculadas en el sombreado, sin otra textura.
 */
export function addMossPatches(material: THREE.MeshLambertMaterial, moss: THREE.Texture): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.floorMoss = { value: moss };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D floorMoss;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 patchAt = vMapUv * 1.2;
        float waves = sin(patchAt.x * 1.7 + sin(patchAt.y * 0.9) * 2.1)
          + sin(patchAt.y * 1.3 + sin(patchAt.x * 1.1) * 1.7)
          + 0.5 * sin((patchAt.x + patchAt.y) * 2.9);
        float mossy = smoothstep(0.6, 1.5, waves);
        vec3 mossColor = texture2D(floorMoss, vMapUv * 1.3).rgb * 0.85;
        diffuseColor.rgb = mix(diffuseColor.rgb, mossColor, mossy);`,
      );
  };
  material.customProgramCacheKey = () => 'floor-moss-patches';
}
