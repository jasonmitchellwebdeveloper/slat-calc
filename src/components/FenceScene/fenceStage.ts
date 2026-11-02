import {
  BoxGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  Spherical,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Box, FenceModel } from "./fenceModel";

const FIELD_OF_VIEW = 30;
const MAX_PIXEL_RATIO = 2;
const STRIPE_ROWS = 128;
const DEFAULT_AZIMUTH = -0.55;
const DEFAULT_POLAR = 1.32;
const MIN_POLAR = 0.5;
const MAX_POLAR = Math.PI / 2 - 0.02; // stays above the ground
const FRAME_MARGIN = 1.3;
const GROUND_SIZE_MM = 2_000_000; // runs past the horizon in every view
const GROUND_COLOUR = 0x8d9a8a;
const HINGE_COLOUR = 0x1d1f21;
const SEE_THROUGH = 0.3;

// One slat and one gap, tiled up a panel. Gaps are often thinner than a pixel,
// and drawing them as geometry aliases into speckle. Mipmaps average them into
// a smooth tone instead, while wide gaps still show as lines.
function createStripeTexture(faceFraction: number): DataTexture {
  const data = new Uint8Array(STRIPE_ROWS * 4);
  for (let row = 0; row < STRIPE_ROWS; row++) {
    const value = (row + 0.5) / STRIPE_ROWS < faceFraction ? 255 : 0;
    data.fill(value, row * 4, row * 4 + 4);
  }
  const texture = new DataTexture(data, 1, STRIPE_ROWS);
  texture.wrapT = RepeatWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export interface FenceStage {
  setModel: (model: FenceModel, colourHex: string) => void;
  setLabel: (label: string) => void;
  rotate: (radians: number) => void;
  resetView: () => void;
  dispose: () => void;
}

// Everything three.js. Renders only when something changes, with no loop.
// Throws if the browser can't create a WebGL context.
export function createFenceStage(
  container: HTMLElement,
  onContextLost: () => void,
): FenceStage {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  const canvas = renderer.domElement;
  canvas.setAttribute("role", "img");
  container.append(canvas);

  const scene = new Scene();
  const backdrop = getComputedStyle(document.documentElement)
    .getPropertyValue("--colour-preview-backdrop")
    .trim();
  scene.background = new Color(backdrop);

  scene.add(new HemisphereLight(0xffffff, 0x6b7268, 2.2));
  const sun = new DirectionalLight(0xffffff, 2);
  sun.position.set(-2, 3, 4);
  scene.add(sun);

  const groundMaterial = new MeshStandardMaterial({
    color: GROUND_COLOUR,
    transparent: true,
    opacity: 0.6,
    depthWrite: false, // lets in-ground posts show through
  });
  const groundGeometry = new PlaneGeometry(1, 1);
  const ground = new Mesh(groundGeometry, groundMaterial);
  ground.renderOrder = -1; // behind the panels, so it shows through their gaps
  ground.rotation.x = -Math.PI / 2;
  ground.scale.set(GROUND_SIZE_MM, GROUND_SIZE_MM, 1);
  scene.add(ground);

  const fence = new Group();
  scene.add(fence);

  const unitBox = new BoxGeometry(1, 1, 1);
  const solid = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.2 });
  const slatted = new MeshStandardMaterial({
    roughness: 0.55,
    metalness: 0.2,
    transparent: true,
  });
  let stripes: DataTexture | null = null;
  let stripesFraction = 0;
  const seeThrough = new MeshStandardMaterial({
    transparent: true,
    opacity: SEE_THROUGH,
    depthWrite: false,
  });
  const hingeMaterial = new MeshStandardMaterial({ color: HINGE_COLOUR });
  const materials = [groundMaterial, solid, slatted, seeThrough, hingeMaterial];

  const camera = new PerspectiveCamera(FIELD_OF_VIEW);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableZoom = false; // the wheel keeps scrolling the page
  controls.minPolarAngle = MIN_POLAR;
  controls.maxPolarAngle = MAX_POLAR;
  // OrbitControls claims every touch, which would trap anyone scrolling past.
  canvas.style.touchAction = "pan-y";

  let current: FenceModel | null = null;

  function render() {
    renderer.render(scene, camera);
  }
  controls.addEventListener("change", render);

  // Moves the camera along its current direction until the fence fits.
  function frame() {
    if (!current) return;
    const lowest = Math.min(...current.posts.map((p) => p.y - p.height / 2));
    const verticalMm = current.heightMm - lowest;
    const target = new Vector3(0, lowest + verticalMm / 2, 0);

    const tanVertical = Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
    const tanHorizontal = tanVertical * camera.aspect;
    const distance =
      FRAME_MARGIN *
      Math.max(
        verticalMm / 2 / tanVertical,
        current.spanMm / 2 / tanHorizontal,
      );

    const direction = camera.position.clone().sub(controls.target).normalize();
    controls.target.copy(target);
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.near = distance / 100;
    camera.far = GROUND_SIZE_MM;
    camera.updateProjectionMatrix();
    controls.update();
    render();
  }

  function setDirection(azimuth: number, polar: number) {
    const direction = new Vector3().setFromSpherical(
      new Spherical(1, polar, azimuth),
    );
    camera.position.copy(controls.target).add(direction);
  }
  setDirection(DEFAULT_AZIMUTH, DEFAULT_POLAR);

  const observer = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    if (width === 0 || height === 0) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    frame();
  });
  observer.observe(container);

  function handleContextLost(event: Event) {
    event.preventDefault();
    onContextLost();
  }
  canvas.addEventListener("webglcontextlost", handleContextLost);

  function addBoxes(boxes: Box[], material: MeshStandardMaterial) {
    if (boxes.length === 0) return;
    const mesh = new InstancedMesh(unitBox, material, boxes.length);
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    boxes.forEach((box, i) => {
      matrix.compose(
        new Vector3(box.x, box.y, box.z),
        rotation,
        new Vector3(box.width, box.height, box.depth),
      );
      mesh.setMatrixAt(i, matrix);
    });
    fence.add(mesh);
  }

  function setStripes(model: FenceModel) {
    if (!stripes || stripesFraction !== model.slatFaceFraction) {
      stripes?.dispose();
      stripes = createStripeTexture(model.slatFaceFraction);
      stripes.anisotropy = renderer.capabilities.getMaxAnisotropy();
      stripesFraction = model.slatFaceFraction;
      slatted.alphaMap = stripes;
      slatted.needsUpdate = true;
    }
    stripes.repeat.set(1, model.panels[0].height / model.slatPeriodMm);
  }

  function clearFence() {
    for (const mesh of fence.children as InstancedMesh[]) mesh.dispose();
    fence.clear();
  }

  return {
    setModel(model, colourHex) {
      const resized =
        current?.spanMm !== model.spanMm ||
        current?.heightMm !== model.heightMm ||
        current?.basePlates.length !== model.basePlates.length;
      current = model;

      solid.color.set(colourHex);
      slatted.color.set(colourHex);
      seeThrough.color.set(colourHex);
      clearFence();
      setStripes(model);
      addBoxes(model.panels, slatted);
      addBoxes(
        model.posts.filter((p) => !p.shared),
        solid,
      );
      addBoxes(
        model.posts.filter((p) => p.shared),
        seeThrough,
      );
      addBoxes(model.basePlates, solid);
      if (model.gate) {
        addBoxes(model.gate.frame, solid);
        addBoxes([model.gate.leaf], seeThrough);
        addBoxes(model.gate.hinges, hingeMaterial);
      }

      if (resized) frame();
      else render();
    },
    setLabel(label) {
      canvas.setAttribute("aria-label", label);
    },
    rotate(radians) {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new Spherical().setFromVector3(offset);
      spherical.theta += radians;
      camera.position
        .copy(controls.target)
        .add(offset.setFromSpherical(spherical));
      controls.update();
      render();
    },
    resetView() {
      setDirection(DEFAULT_AZIMUTH, DEFAULT_POLAR);
      frame();
    },
    dispose() {
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      controls.removeEventListener("change", render);
      controls.dispose();
      clearFence();
      unitBox.dispose();
      groundGeometry.dispose();
      stripes?.dispose();
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.forceContextLoss(); // browsers allow only a few live contexts
      canvas.remove();
    },
  };
}
