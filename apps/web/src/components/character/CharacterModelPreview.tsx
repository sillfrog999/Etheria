import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CharacterModelId } from '@etheria/shared';

const MODEL_PATHS: Record<CharacterModelId, string> = {
  elf_female: '/assets/3d/characters/selectable/Elf_Female.glb',
  elf_male: '/assets/3d/characters/selectable/Elf_Male.glb',
  orc_female: '/assets/3d/characters/selectable/Orc_Female.glb',
  orc_male: '/assets/3d/characters/selectable/Orc_Male.glb',
};

export function CharacterModelPreview({ modelId }: { modelId: CharacterModelId }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 1.35, 5.2);
    camera.lookAt(0, 0.95, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(280, 280);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    host.replaceChildren(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xdceaff, 0x30251b, 2.1));
    const key = new THREE.DirectionalLight(0xffe0b0, 2.4);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ba9df, 1.1);
    fill.position.set(3, 2, -3);
    scene.add(fill);

    const turntable = new THREE.Group();
    scene.add(turntable);
    const loader = new GLTFLoader();
    let disposed = false;
    let frame = 0;

    loader.load(MODEL_PATHS[modelId], (gltf) => {
      if (disposed) return;
      const model = gltf.scene;
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = false;
          node.receiveShadow = false;
        }
      });
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const scale = size.y > 0 ? 2.05 / size.y : 1;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      turntable.add(model);
    }, undefined, (error) => {
      console.error('[Character Preview] Model failed to load:', error);
    });

    const animate = () => {
      if (disposed) return;
      frame = requestAnimationFrame(animate);
      turntable.rotation.y += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      turntable.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [modelId]);

  return (
    <div
      ref={hostRef}
      aria-label="3D character preview"
      style={{
        width: '280px',
        height: '280px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(100, 86, 62, .28), rgba(0, 0, 0, .12) 68%)',
        border: '1px solid #403522',
        borderRadius: '6px',
        overflow: 'hidden'
      }}
    />
  );
}
