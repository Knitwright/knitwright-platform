import {
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Spherical,
  Vector3,
  WebGLRenderer,
  type Side,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Bounds, View } from "@/lib/flat/model";
import type { GarmentMesh, MeshSheet } from "@/lib/garment3d/mesh";
import { cameraFor, textureSize, zoomLimits, type ViewerMotion } from "@/lib/garment3d/viewer";

/*
 * The only file that uses three.js. It is reached only through a dynamic import when a
 * person opens the 3D view, so no other page loads it. It draws; every number it uses
 * comes from lib/garment3d.
 */

const FOV = 32;
const TEXTURE_PIXELS = 2048;
const AUTO_ROTATE_SPEED = 1.2;

/** Paints a flat, given as a picture address, onto a canvas of the flat's shape. */
export function paintFlat(src: string, bounds: Bounds): Promise<HTMLCanvasElement> {
  const { width, height } = textureSize(bounds, TEXTURE_PIXELS);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("No 2D canvas."));
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas);
    };
    image.onerror = () => reject(new Error("The flat could not be painted."));
    image.src = src;
  });
}

function sheetMesh(sheet: MeshSheet, picture: HTMLCanvasElement, side: Side): Mesh {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(sheet.positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(sheet.uvs, 2));
  geometry.setIndex([...sheet.indices]);
  geometry.computeVertexNormals();
  const map = new CanvasTexture(picture);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 4;
  return new Mesh(geometry, new MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, side }));
}

export interface GarmentScene {
  showSide(view: View): void;
  dispose(): void;
}

export interface Pictures {
  readonly front: HTMLCanvasElement;
  readonly back: HTMLCanvasElement;
}

/** Draws the form into the canvas and lets a person turn it and come closer. */
export function mountGarment(canvas: HTMLCanvasElement, mesh: GarmentMesh, pictures: Pictures, motion: ViewerMotion): GarmentScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a8f99, 2.2));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(0.6, 0.9, 1.4);
  const rim = new DirectionalLight(0xffffff, 0.9);
  rim.position.set(-0.8, 0.4, -1.2);
  scene.add(key, rim);
  // The inside of the back shows through the neck opening, so the back is drawn on both faces.
  const parts = [sheetMesh(mesh.front, pictures.front, FrontSide), sheetMesh(mesh.back, pictures.back, DoubleSide)];
  scene.add(...parts);

  const camera = new PerspectiveCamera(FOV, 1, 0.01, 50);
  const controls = new OrbitControls(camera, canvas);
  const limits = zoomLimits(mesh.size);
  controls.minDistance = limits.min;
  controls.maxDistance = limits.max;
  controls.enablePan = false;
  controls.enableDamping = motion.easeSeconds > 0;
  controls.autoRotate = motion.autoRotate;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  controls.addEventListener("start", () => {
    controls.autoRotate = false;
  });

  const resize = () => {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  resize();
  camera.position.set(...cameraFor("front", mesh.size, FOV, camera.aspect));
  controls.update();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let ease: { from: Spherical; to: Spherical; start: number } | null = null;
  let frame = 0;
  const tick = (now: number) => {
    if (ease) {
      const t = Math.min(1, (now - ease.start) / (motion.easeSeconds * 1000));
      const smooth = t * t * (3 - 2 * t);
      const s = new Spherical(
        ease.from.radius,
        ease.from.phi + (ease.to.phi - ease.from.phi) * smooth,
        ease.from.theta + (ease.to.theta - ease.from.theta) * smooth,
      );
      camera.position.setFromSpherical(s);
      if (t === 1) ease = null;
    }
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    showSide(view) {
      controls.autoRotate = false;
      const to = new Spherical().setFromVector3(new Vector3(...cameraFor(view, mesh.size, FOV, camera.aspect)));
      to.radius = camera.position.length();
      if (motion.easeSeconds === 0) {
        ease = null;
        camera.position.setFromSpherical(to);
        return;
      }
      const from = new Spherical().setFromVector3(camera.position);
      // Turn the short way round.
      const turn = ((to.theta - from.theta + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      ease = { from, to: new Spherical(to.radius, to.phi, from.theta + turn), start: performance.now() };
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      for (const part of parts) {
        part.geometry.dispose();
        const material = part.material as MeshStandardMaterial;
        material.map?.dispose();
        material.dispose();
      }
      renderer.dispose();
    },
  };
}
