import {
  BufferGeometry,
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
  CanvasTexture,
  Vector3,
  WebGLRenderer,
  type Side,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GarmentMesh, MeshSheet } from "@/lib/garment3d/mesh";
import { cameraFor, zoomLimits, type ViewerMotion } from "@/lib/garment3d/viewer";
import { cameraAngleFor, type StageViewId } from "@/lib/teamwear";

/**
 * The only file of the teamwear configurator that uses three.js. It is reached through a dynamic
 * import, so no other page loads it, and every number it uses comes from `lib/garment3d` or
 * `lib/teamwear/stage.ts`.
 *
 * It is its own file rather than `components/garment3d/scene.ts` because the stage needs five views
 * and that scene offers two (front and back): the view chip of spec F-T1 adds the left, the right
 * and the collar, which are camera angles this file places.
 */

const FOV = 32;

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

export interface KitStageScene {
  showView(view: StageViewId): void;
  /** One turn in this many seconds, or null to stop. */
  turn(revolutionSeconds: number | null): void;
  /** The canvas as a PNG data address, for the snapshot button. */
  snapshot(): string;
  dispose(): void;
}

export interface StagePictures {
  readonly front: HTMLCanvasElement;
  readonly back: HTMLCanvasElement;
}

/** Where the camera stands for a view: the angle from `lib/teamwear`, at the distance that frames the garment. */
function positionFor(view: StageViewId, size: GarmentMesh["size"], aspect: number): Spherical {
  const angle = cameraAngleFor(view);
  const frame = new Vector3(...cameraFor("front", size, FOV, aspect)).length();
  const radians = (degrees: number): number => (degrees * Math.PI) / 180;
  return new Spherical(frame * angle.distanceFactor, radians(angle.polarDegrees), radians(angle.azimuthDegrees));
}

/**
 * Draws the kit into the canvas and lets a person turn it and come closer. `onFirstFrame` is called
 * once, with the milliseconds since the page was asked for, which is the measurement the first
 * render budget is tested against.
 */
export function mountKit(
  canvas: HTMLCanvasElement,
  mesh: GarmentMesh,
  pictures: StagePictures,
  motion: ViewerMotion,
  onFirstFrame: (milliseconds: number) => void,
): KitStageScene {
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
  controls.autoRotate = false;
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
  camera.position.setFromSpherical(positionFor("front", mesh.size, camera.aspect));
  controls.update();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let first = true;
  let frame = 0;
  const tick = () => {
    controls.update();
    renderer.render(scene, camera);
    if (first) {
      first = false;
      onFirstFrame(performance.now());
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    showView(view) {
      controls.autoRotate = false;
      const to = positionFor(view, mesh.size, camera.aspect);
      camera.position.setFromSpherical(to);
      controls.update();
    },
    turn(revolutionSeconds) {
      controls.autoRotateSpeed = revolutionSeconds ? 60 / revolutionSeconds : 1.2;
      controls.autoRotate = revolutionSeconds !== null;
    },
    snapshot() {
      renderer.render(scene, camera);
      return canvas.toDataURL("image/png");
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
