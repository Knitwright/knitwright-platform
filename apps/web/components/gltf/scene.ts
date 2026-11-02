import {
  Box3,
  CanvasTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GltfModel } from "@/lib/gltf";
import { presetCamera, type ModelBox, type PresetView } from "@/lib/gltf/viewer";
import type { ViewerMotion } from "@/lib/garment3d/viewer";
import { distanceFor, listenForVideoEvents, subjectHeight, type CameraAsk } from "@/lib/garment3d/video-events";

/*
 * The only file in the glTF folders that uses three.js. It is reached only through a dynamic import when a person opens
 * the 3D view. It draws; every number it uses comes from lib/gltf. three.js already ships the loader, so no new
 * dependency is added.
 */

const FOV = 32;
const AUTO_ROTATE_SPEED = 1.2;

/** Reads a glTF given as an object. The file is not changed. */
export async function parseModel(model: GltfModel): Promise<Group> {
  const loaded = await new GLTFLoader().parseAsync(JSON.stringify(model), "");
  return loaded.scene;
}

export function boxOf(root: Group): ModelBox {
  const box = new Box3().setFromObject(root);
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  return { size: [size.x, size.y, size.z], centre: [centre.x, centre.y, centre.z] };
}

/** The scene with lights, the model, and the one 2048 picture on every material when there is one. Needs no graphics card. */
export function buildModelScene(root: Group, atlas: TexImageSource | null): { scene: Scene; materials: MeshStandardMaterial[]; texture: CanvasTexture | null } {
  const scene = new Scene();
  scene.add(new HemisphereLight(0xffffff, 0x8a8f99, 2.2));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(0.6, 0.9, 1.4);
  const rim = new DirectionalLight(0xffffff, 0.9);
  rim.position.set(-0.8, 0.4, -1.2);
  scene.add(key, rim, root);
  // glTF texture coordinates run v down from the top of the picture, so the picture must not be flipped.
  const texture = atlas ? new CanvasTexture(atlas as HTMLCanvasElement) : null;
  if (texture) {
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
  }
  const materials = new Set<MeshStandardMaterial>();
  root.traverse((object) => {
    if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) materials.add(object.material);
  });
  if (texture) {
    for (const material of materials) {
      material.map = texture;
      material.needsUpdate = true;
    }
  }
  return { scene, materials: [...materials], texture };
}

export interface ModelScene {
  showView(view: PresetView): void;
  dispose(): void;
}

/** Draws the model into the canvas, and lets a person turn it, come closer and jump to a preset view. */
export function mountModel(canvas: HTMLCanvasElement, root: Group, atlas: HTMLCanvasElement | null, motion: ViewerMotion): ModelScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const { scene, texture } = buildModelScene(root, atlas);
  const box = boxOf(root);
  const camera = new PerspectiveCamera(FOV, 1, 0.01, 50);
  const controls = new OrbitControls(camera, canvas);
  const longest = Math.max(...box.size);
  controls.minDistance = longest * 0.45;
  controls.maxDistance = longest * 4;
  controls.enablePan = false;
  controls.enableDamping = motion.easeSeconds > 0;
  controls.autoRotate = motion.autoRotate;
  controls.autoRotateSpeed = AUTO_ROTATE_SPEED;
  controls.target.set(...box.centre);
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
  const place = (view: PresetView) => {
    camera.position.set(...presetCamera(view, box, FOV, camera.aspect));
    controls.update();
  };
  place("front");
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  /** The distance the whole model fills the frame at, which a zoom of 1 means. */
  const whole = (): number => new Vector3(...presetCamera("front", box, FOV, camera.aspect)).sub(new Vector3(...box.centre)).length();
  let push: { from: number; to: number; start: number; ms: number; theta: number; y: number } | null = null;

  const stand = (theta: number, radius: number, y: number): void => {
    camera.position.set(box.centre[0] + radius * Math.sin(theta), y, box.centre[2] + radius * Math.cos(theta));
  };

  /**
   * The camera moves the video studio asks for (decision 0095, item 3): the angle round the model,
   * the distance for a zoom and the height of the shot's subject. The colourway event is **not**
   * answered here, because this view holds one picture of one colourway, so the carousel stays
   * disabled with the sentence that says why rather than recording the same kit three times.
   */
  const point = (ask: CameraAsk): void => {
    controls.autoRotate = false;
    const theta = (ask.degrees * Math.PI) / 180;
    const y = box.centre[1] + subjectHeight(ask.subject, box.size[1] ?? 0);
    const limits = { min: controls.minDistance, max: controls.maxDistance };
    const from = distanceFor(whole(), ask.zoom, limits);
    controls.target.set(box.centre[0], y, box.centre[2]);
    stand(theta, from, y);
    controls.update();
    const to = ask.toZoom === null ? null : distanceFor(whole(), ask.toZoom, limits);
    push = to === null || to === from || ask.seconds <= 0 ? null : { from, to, start: performance.now(), ms: ask.seconds * 1000, theta, y };
  };

  const stopListening = listenForVideoEvents(canvas, {
    // The turn the recorder has asked for since decision 0058: one revolution in so many seconds.
    turn: (seconds) => {
      controls.autoRotateSpeed = seconds ? 60 / seconds : AUTO_ROTATE_SPEED;
      controls.autoRotate = seconds !== null;
    },
    camera: point,
  });

  renderer.setAnimationLoop(() => {
    if (push) {
      const t = Math.min(1, (performance.now() - push.start) / push.ms);
      stand(push.theta, push.from + (push.to - push.from) * t, push.y);
      if (t === 1) push = null;
    }
    controls.update();
    renderer.render(scene, camera);
  });
  return {
    showView: (view) => {
      controls.autoRotate = false;
      push = null;
      place(view);
    },
    dispose() {
      renderer.setAnimationLoop(null);
      stopListening();
      observer.disconnect();
      controls.dispose();
      texture?.dispose();
      renderer.dispose();
    },
  };
}
