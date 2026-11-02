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
import { distanceFor, listenForVideoEvents, subjectHeight, type CameraAsk, type ViewHandlers } from "@/lib/garment3d/video-events";

/*
 * The only file that uses three.js. It is reached only through a dynamic import when a
 * person opens the 3D view, so no other page loads it. It draws; every number it uses
 * comes from lib/garment3d.
 *
 * It answers the video studio's three events (L5, decision 0095): the turn it has answered since
 * decision 0058, the camera the flip and the kit reveal need, and the colourway the carousel needs
 * -- the last one only when this view was given more than one kit to show, so it never claims an
 * ability it does not have.
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

/** The two sides of one colour version of the design, painted. */
export interface SidePictures {
  readonly front: HTMLCanvasElement;
  readonly back: HTMLCanvasElement;
}

export interface Pictures extends SidePictures {
  /**
   * The design's other colour versions, by the word the video studio names a kit with ("home",
   * "away", "gk"). Given them, this view can record the home / away / GK carousel; given none, it
   * says it cannot and the carousel stays disabled with its reason (decision 0095, item 3).
   */
  readonly kits?: Readonly<Record<string, SidePictures>>;
}

/** A zoom that moves while a shot runs: the push in on the fabric and out again on the crest. */
interface Push {
  readonly from: number;
  readonly to: number;
  readonly start: number;
  readonly ms: number;
  readonly theta: number;
  readonly y: number;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Where the camera stands for one shot, which is a distance and an angle round the garment. */
const standAt = (camera: PerspectiveCamera, theta: number, radius: number, y: number): void => {
  camera.position.set(radius * Math.sin(theta), y, radius * Math.cos(theta));
};

/** What a camera move needs of the scene, so the move itself is not inside the mount. */
interface Rig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly size: GarmentMesh["size"];
  readonly limits: Readonly<{ min: number; max: number }>;
}

/**
 * Points the camera where a shot asks, and answers with the push it left running, or null for a
 * shot that holds still. The angle is round the garment from the front, the distance comes from the
 * zoom inside the view's own limits, and the height comes from what the shot is pointed at.
 */
function pointAt(rig: Rig, ask: CameraAsk): Push | null {
  rig.controls.autoRotate = false;
  const theta = (ask.degrees * Math.PI) / 180;
  const y = subjectHeight(ask.subject, rig.size.height);
  // The distance the whole garment fills the frame at, which a zoom of 1 means.
  const whole = new Vector3(...cameraFor("front", rig.size, FOV, rig.camera.aspect)).length();
  const from = distanceFor(whole, ask.zoom, rig.limits);
  rig.controls.target.set(0, y, 0);
  standAt(rig.camera, theta, from, y);
  rig.controls.update();
  const to = ask.toZoom === null ? null : distanceFor(whole, ask.toZoom, rig.limits);
  if (to === null || to === from || ask.seconds <= 0) return null;
  return { from, to, start: performance.now(), ms: ask.seconds * 1000, theta, y };
}

/** Puts another kit's drawings on the garment, keeping each texture made so it can be disposed. */
function swapKit(parts: readonly Mesh[], kit: SidePictures, made: CanvasTexture[]): void {
  parts.forEach((part, index) => {
    const texture = new CanvasTexture(index === 0 ? kit.front : kit.back);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    made.push(texture);
    const material = part.material as MeshStandardMaterial;
    material.map = texture;
    material.needsUpdate = true;
  });
}

/** The scene, its lights and the two painted sheets of the garment. */
function buildScene(mesh: GarmentMesh, pictures: SidePictures): { readonly scene: Scene; readonly parts: readonly Mesh[] } {
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
  return { scene, parts };
}

/** The orbit controls, with how close and how far this garment lets the camera go. */
function buildControls(canvas: HTMLCanvasElement, camera: PerspectiveCamera, mesh: GarmentMesh, motion: ViewerMotion): OrbitControls {
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
  return controls;
}

/** Draws the form into the canvas and lets a person turn it and come closer. */
export function mountGarment(canvas: HTMLCanvasElement, mesh: GarmentMesh, pictures: Pictures, motion: ViewerMotion): GarmentScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  const { scene, parts } = buildScene(mesh, pictures);

  const camera = new PerspectiveCamera(FOV, 1, 0.01, 50);
  const controls = buildControls(canvas, camera, mesh, motion);
  const limits = zoomLimits(mesh.size);

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
  let push: Push | null = null;
  const swapped: CanvasTexture[] = [];

  const rig: Rig = { camera, controls, size: mesh.size, limits };
  const kits = pictures.kits ?? {};
  const handlers: ViewHandlers = {
    turn: (seconds) => {
      controls.autoRotateSpeed = seconds ? 60 / seconds : AUTO_ROTATE_SPEED;
      controls.autoRotate = seconds !== null;
    },
    camera: (ask) => {
      ease = null;
      push = pointAt(rig, ask);
    },
    // Claimed only by a view that was given more than one kit, so the carousel is never recorded
    // as three shots of the same one (decision 0095, item 3).
    ...(Object.keys(kits).length > 0
      ? {
          colourway: (asked: string) => {
            const kit = kits[asked];
            if (kit) swapKit(parts, kit, swapped);
          },
        }
      : {}),
  };
  const stopListening = listenForVideoEvents(canvas, handlers);

  let frame = 0;
  const tick = (now: number) => {
    if (ease) {
      const t = Math.min(1, (now - ease.start) / (motion.easeSeconds * 1000));
      const s = new Spherical(
        ease.from.radius,
        ease.from.phi + (ease.to.phi - ease.from.phi) * smooth(t),
        ease.from.theta + (ease.to.theta - ease.from.theta) * smooth(t),
      );
      camera.position.setFromSpherical(s);
      if (t === 1) ease = null;
    }
    if (push) {
      const t = Math.min(1, (now - push.start) / push.ms);
      standAt(camera, push.theta, push.from + (push.to - push.from) * t, push.y);
      if (t === 1) push = null;
    }
    controls.update();
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    showSide(view) {
      controls.autoRotate = false;
      push = null;
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
      stopListening();
      observer.disconnect();
      controls.dispose();
      for (const texture of swapped) texture.dispose();
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
