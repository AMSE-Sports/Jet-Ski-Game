import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.min.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const isTouch = matchMedia("(pointer: coarse)").matches;

const ui = {
  game: $("#game"),
  setup: $("#raceSetup"),
  start: $("#startScreen"),
  loading: $("#loadingScreen"),
  loadingBar: $("#loadingBar"),
  loadingValue: $("#loadingValue"),
  hud: $("#hud"),
  touch: $("#touchControls"),
  countdown: $("#countdown"),
  pauseScreen: $("#pauseScreen"),
  result: $("#resultScreen"),
  speed: $("#speed"),
  position: $("#position"),
  timer: $("#timer"),
  distance: $("#distanceLabel"),
  mode: $("#modeLabel"),
  courseBar: $("#courseBar"),
  nitroBar: $("#nitroBar"),
  nitroValue: $("#nitroValue"),
  callout: $("#callout"),
  finalTime: $("#finalTime"),
  topSpeed: $("#topSpeed"),
  gateScore: $("#gateScore"),
  finalPosition: $("#finalPosition"),
  webglNotice: $("#webglNotice"),
};

const config = {
  time: { label: "TIME ATTACK", cruise: 126, max: 176, gates: 1, hazards: 1 },
  sprint: { label: "SPRINT", cruise: 148, max: 202, gates: .7, hazards: .65 },
  precision: { label: "PRECISION", cruise: 112, max: 162, gates: 1.35, hazards: 1.4 },
};

const state = {
  phase: "menu",
  mode: "time",
  courseLength: 3000,
  distance: 0,
  elapsed: 0,
  speed: 0,
  topSpeed: 0,
  nitro: 70,
  steer: 0,
  x: 0,
  vx: 0,
  score: 0,
  gates: 0,
  totalGates: 0,
  collisions: 0,
  paused: false,
  highQuality: true,
  keys: { left: false, right: false, brake: false, nitro: false },
};

let renderer;
let scene;
let camera;
let clock;
let player;
let water;
let oceanUniforms;
let sun;
let trackRoot;
let wakeRoot;
let rivalRoot;
let sceneryRoot;
let trackObjects = [];
let rivals = [];
let wakes = [];
let wakeTexture;
let animFrame = 0;
let calloutTimer = 0;
let nextWake = 0;

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && canvas.getContext("webgl2"))
      || !!canvas.getContext("webgl");
  } catch {
    return false;
  }
}

function mat(color, roughness = .42, metalness = .12) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function mesh(geometry, material, cast = true, receive = true) {
  const item = new THREE.Mesh(geometry, material);
  item.castShadow = cast;
  item.receiveShadow = receive;
  return item;
}

function makeSky() {
  const geometry = new THREE.SphereGeometry(600, 24, 16);
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color("#138dcc") },
      horizonColor: { value: new THREE.Color("#c6eaf2") },
      bottomColor: { value: new THREE.Color("#eef0d4") },
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 bottomColor;
      varying vec3 vWorld;
      void main() {
        float h = normalize(vWorld).y;
        vec3 c = mix(bottomColor, horizonColor, smoothstep(-0.2, 0.10, h));
        c = mix(c, topColor, smoothstep(0.05, 0.75, h));
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(geometry, material));

  const sunCanvas = document.createElement("canvas");
  sunCanvas.width = sunCanvas.height = 128;
  const ctx = sunCanvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,238,1)");
  gradient.addColorStop(.16, "rgba(255,238,170,.95)");
  gradient.addColorStop(.42, "rgba(255,185,80,.28)");
  gradient.addColorStop(1, "rgba(255,150,30,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  sprite.position.set(-80, 62, -220);
  sprite.scale.set(55, 55, 1);
  scene.add(sprite);
}

function makeOcean() {
  const segments = state.highQuality ? 150 : 70;
  const geometry = new THREE.PlaneGeometry(900, 1100, segments, segments);
  oceanUniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color("#024568") },
    uShallow: { value: new THREE.Color("#17a6bb") },
    uSun: { value: new THREE.Color("#fff1b0") },
  };
  const material = new THREE.ShaderMaterial({
    uniforms: oceanUniforms,
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        vec3 p = position;
        float a = sin(p.x * .095 + uTime * 1.55) * .20;
        float b = sin(p.y * .052 - uTime * 1.05 + p.x * .018) * .29;
        float c = sin((p.x + p.y) * .16 + uTime * 2.2) * .07;
        p.z += a + b + c;
        vWave = p.z;
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      uniform float uTime;
      varying float vWave;
      varying vec3 vWorld;
      void main() {
        float crestA = max(0.0, sin(vWorld.x * .17 + vWorld.z * .065 + uTime * 1.45));
        float crestB = max(0.0, sin(vWorld.x * -.11 + vWorld.z * .14 - uTime * 1.1));
        float line = pow(crestA, 24.0) * pow(crestB, 5.0);
        float sparkle = pow(max(0.0,
          sin(vWorld.x * 1.35 + uTime * 1.7) *
          sin(vWorld.z * 1.72 - uTime * 1.2)
        ), 22.0);
        float fresnel = smoothstep(-.35, .45, vWave);
        vec3 color = mix(uDeep, uShallow, fresnel);
        color += uSun * (line * .07 + sparkle * .09);
        float fog = smoothstep(70.0, 430.0, -vWorld.z);
        color = mix(color, vec3(.48, .72, .78), fog * .48);
        gl_FragColor = vec4(color, .98);
      }
    `,
  });
  water = new THREE.Mesh(geometry, material);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -.45, -280);
  water.receiveShadow = true;
  scene.add(water);
}

function hullGeometry() {
  const positions = [];
  const indices = [];
  const rings = [
    { z: -2.6, y: .22, w: .08, h: .12 },
    { z: -2.0, y: .17, w: .48, h: .32 },
    { z: -.65, y: .08, w: .82, h: .45 },
    { z: 1.15, y: .12, w: .66, h: .42 },
    { z: 2.0, y: .21, w: .28, h: .28 },
  ];
  rings.forEach((ring) => {
    positions.push(-ring.w, ring.y, ring.z, ring.w, ring.y, ring.z);
    positions.push(-ring.w * .62, ring.y - ring.h, ring.z, ring.w * .62, ring.y - ring.h, ring.z);
  });
  for (let r = 0; r < rings.length - 1; r += 1) {
    const a = r * 4;
    const b = a + 4;
    indices.push(a, b, b + 1, a, b + 1, a + 1);
    indices.push(a + 1, b + 1, b + 3, a + 1, b + 3, a + 3);
    indices.push(a + 3, b + 3, b + 2, a + 3, b + 2, a + 2);
    indices.push(a + 2, b + 2, b, a + 2, b, a);
  }
  indices.push(0, 1, 3, 0, 3, 2);
  const last = (rings.length - 1) * 4;
  indices.push(last, last + 2, last + 3, last, last + 3, last + 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createJetSki(primary = "#f25822", secondary = "#111722", riderColor = "#f7f7f7") {
  const group = new THREE.Group();
  const hull = mesh(hullGeometry(), new THREE.MeshPhysicalMaterial({
    color: primary, metalness: .25, roughness: .28, clearcoat: 1, clearcoatRoughness: .2,
  }));
  hull.rotation.y = Math.PI;
  group.add(hull);

  const lower = mesh(new THREE.CapsuleGeometry(.62, 2.1, 5, 10), mat("#111820", .24, .3));
  lower.rotation.x = Math.PI / 2;
  lower.scale.set(1, .43, 1);
  lower.position.set(0, -.28, .15);
  group.add(lower);

  const deck = mesh(new THREE.CapsuleGeometry(.53, 1.6, 5, 12), mat(secondary, .24, .12));
  deck.rotation.x = Math.PI / 2;
  deck.scale.set(1, .34, 1);
  deck.position.set(0, .23, .2);
  group.add(deck);

  const nose = mesh(new THREE.ConeGeometry(.52, 1.5, 12), mat(primary, .28, .2));
  nose.rotation.x = -Math.PI / 2;
  nose.position.set(0, .35, -1.64);
  nose.scale.set(1, .55, 1);
  group.add(nose);

  const intake = mesh(new THREE.BoxGeometry(.42, .18, .62), mat("#080b10", .5, .35));
  intake.position.set(0, .46, -1.22);
  intake.rotation.x = -.16;
  group.add(intake);

  const seat = mesh(new THREE.CapsuleGeometry(.34, .74, 4, 10), mat("#171a1e", .8, .05));
  seat.rotation.x = Math.PI / 2;
  seat.position.set(0, .58, .52);
  seat.scale.set(1, .48, 1);
  group.add(seat);

  const consoleBase = mesh(new THREE.CylinderGeometry(.17, .28, .76, 10), mat(secondary, .35, .15));
  consoleBase.position.set(0, .72, -.64);
  consoleBase.rotation.x = -.22;
  group.add(consoleBase);
  const bar = mesh(new THREE.CylinderGeometry(.035, .035, 1.05, 8), mat("#202a32", .2, .65));
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 1.05, -.78);
  group.add(bar);
  [-.52, .52].forEach((x) => {
    const grip = mesh(new THREE.CylinderGeometry(.06, .06, .27, 8), mat("#090b0d", .9, 0));
    grip.rotation.z = Math.PI / 2;
    grip.position.set(x, 1.05, -.78);
    group.add(grip);
  });

  const rider = new THREE.Group();
  const torso = mesh(new THREE.CapsuleGeometry(.23, .56, 5, 10), mat(riderColor, .56, .04));
  torso.rotation.x = -.32;
  rider.add(torso);
  const vest = mesh(new THREE.BoxGeometry(.51, .55, .24), mat(primary, .52, .08));
  vest.position.set(0, .06, -.11);
  vest.rotation.x = -.32;
  rider.add(vest);
  const head = mesh(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshPhysicalMaterial({
    color: "#151d28", roughness: .2, metalness: .25, clearcoat: .9,
  }));
  head.position.set(0, .73, -.17);
  rider.add(head);
  const visor = mesh(new THREE.SphereGeometry(.175, 16, 8, 0, Math.PI), new THREE.MeshPhysicalMaterial({
    color: "#65dffa", metalness: .65, roughness: .12, transparent: true, opacity: .86,
  }));
  visor.rotation.y = Math.PI;
  visor.scale.set(1.05, .55, .5);
  visor.position.set(0, .76, -.35);
  rider.add(visor);
  [-1, 1].forEach((side) => {
    const arm = mesh(new THREE.CapsuleGeometry(.07, .55, 4, 8), mat(riderColor, .65, 0));
    arm.position.set(side * .27, .18, -.23);
    arm.rotation.z = side * -.43;
    arm.rotation.x = .64;
    rider.add(arm);
  });
  rider.position.set(0, 1.02, .34);
  rider.rotation.x = -.22;
  group.add(rider);

  const decalCanvas = document.createElement("canvas");
  decalCanvas.width = 256;
  decalCanvas.height = 64;
  const dctx = decalCanvas.getContext("2d");
  dctx.fillStyle = "white";
  dctx.font = "900 italic 40px Arial";
  dctx.textAlign = "center";
  dctx.fillText("WGP#1", 128, 45);
  const decal = mesh(new THREE.PlaneGeometry(1.45, .36), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(decalCanvas), transparent: true, side: THREE.DoubleSide,
  }), false, false);
  decal.position.set(.69, .12, .2);
  decal.rotation.y = Math.PI / 2;
  group.add(decal);

  group.scale.setScalar(.92);
  return group;
}

function createBuoy(color = "#ff5b21", scale = 1) {
  const group = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(.38, .62, 1.35, 14), new THREE.MeshPhysicalMaterial({
    color, roughness: .32, metalness: .12, clearcoat: .6,
  }));
  body.position.y = .22;
  group.add(body);
  const cap = mesh(new THREE.SphereGeometry(.38, 14, 8), mat(color, .3, .1));
  cap.position.y = .88;
  cap.scale.y = .7;
  group.add(cap);
  const stripe = mesh(new THREE.CylinderGeometry(.43, .5, .18, 14), mat("#f6f7f8", .45, .05));
  stripe.position.y = .36;
  group.add(stripe);
  group.scale.setScalar(scale);
  return group;
}

function createGate() {
  const group = new THREE.Group();
  const gateMat = new THREE.MeshStandardMaterial({
    color: "#57e8ff", emissive: "#0a92ae", emissiveIntensity: 1.8, roughness: .18, metalness: .65,
  });
  [-2.15, 2.15].forEach((x) => {
    const post = mesh(new THREE.CylinderGeometry(.13, .18, 3.2, 10), gateMat);
    post.position.set(x, 1.25, 0);
    group.add(post);
  });
  const top = mesh(new THREE.BoxGeometry(4.55, .28, .28), gateMat);
  top.position.y = 2.82;
  group.add(top);
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 512;
  signCanvas.height = 96;
  const ctx = signCanvas.getContext("2d");
  ctx.fillStyle = "#07111c";
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = "#fff";
  ctx.font = "900 italic 46px Arial";
  ctx.textAlign = "center";
  ctx.fillText("WGP#1  BOOST", 256, 64);
  const sign = mesh(new THREE.PlaneGeometry(4.1, .77), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(signCanvas), transparent: true, side: THREE.DoubleSide,
  }), false, false);
  sign.position.set(0, 2.82, .16);
  group.add(sign);
  return group;
}

function createRamp() {
  const group = new THREE.Group();
  const ramp = mesh(new THREE.BoxGeometry(2.5, .18, 4.2), mat("#181d25", .32, .52));
  ramp.rotation.x = .17;
  ramp.position.y = .2;
  group.add(ramp);
  for (let i = -2; i <= 2; i += 1) {
    const stripe = mesh(new THREE.BoxGeometry(.25, .02, 4), mat(i % 2 ? "#ff5b21" : "#f2f2f2", .45, .2));
    stripe.position.set(i * .45, .31, 0);
    stripe.rotation.x = .17;
    group.add(stripe);
  }
  return group;
}

function createTrackObject(type, x, z) {
  const object = new THREE.Group();
  let visual;
  if (type === "gate") visual = createGate();
  if (type === "buoy") visual = createBuoy(Math.random() > .5 ? "#ff5b21" : "#ffe144", .88);
  if (type === "ramp") visual = createRamp();
  object.add(visual);
  object.position.set(x, 0, z);
  object.userData = { type, hit: false, baseX: x };
  trackRoot.add(object);
  trackObjects.push(object);
  return object;
}

function createCourse() {
  trackObjects.forEach((item) => trackRoot.remove(item));
  trackObjects = [];
  const spacing = state.mode === "precision" ? 26 : 36;
  const count = state.highQuality ? 19 : 13;
  const lanes = [-5.2, 0, 5.2];
  for (let i = 0; i < count; i += 1) {
    const z = -38 - i * spacing;
    const lane = lanes[(i * 7 + 1) % 3];
    let type = i % 5 === 1 ? "gate" : i % 7 === 4 ? "ramp" : "buoy";
    if (state.mode === "sprint" && i % 3 !== 1) type = "gate";
    createTrackObject(type, lane, z);
    if (type === "gate") state.totalGates += 1;
    if (type === "buoy" && i % 2 === 0) createTrackObject("buoy", -lane || 5.2, z - 5);
  }
}

function createScenery() {
  const islandMat = mat("#718a5c", .96, 0);
  const rockMat = mat("#6c6f66", .9, 0);
  for (let side of [-1, 1]) {
    for (let i = 0; i < 18; i += 1) {
      const rock = mesh(new THREE.IcosahedronGeometry(3 + Math.random() * 4, 1), i % 3 ? islandMat : rockMat, false, true);
      rock.position.set(side * (32 + Math.random() * 60), -1 + Math.random() * 2, -25 - i * 26 - Math.random() * 30);
      rock.scale.y = .45 + Math.random() * 1.2;
      sceneryRoot.add(rock);
    }
  }
  for (let i = 0; i < 16; i += 1) {
    const stand = new THREE.Group();
    const base = mesh(new THREE.BoxGeometry(14, 2.5, 5), mat("#c8ced1", .72, .15), false, true);
    stand.add(base);
    const roof = mesh(new THREE.BoxGeometry(15, .3, 6), mat(i % 2 ? "#ff5b21" : "#101722", .4, .2));
    roof.position.y = 3;
    stand.add(roof);
    stand.position.set((i % 2 ? -1 : 1) * 47, 1.5, -70 - Math.floor(i / 2) * 57);
    stand.rotation.y = i % 2 ? -.08 : .08;
    sceneryRoot.add(stand);
  }
  const mountains = mesh(new THREE.IcosahedronGeometry(62, 2), mat("#587b79", .98, 0), false, true);
  mountains.scale.set(3.8, .58, 1);
  mountains.position.set(15, 8, -420);
  sceneryRoot.add(mountains);
}

function createWakeParticle() {
  if (!wakeTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const glow = ctx.createRadialGradient(64, 120, 4, 64, 128, 62);
    glow.addColorStop(0, "rgba(255,255,255,.92)");
    glow.addColorStop(.28, "rgba(199,246,255,.54)");
    glow.addColorStop(.68, "rgba(103,220,245,.14)");
    glow.addColorStop(1, "rgba(80,200,230,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 18; i += 1) {
      const x = 20 + Math.random() * 88;
      const y = 50 + Math.random() * 150;
      const r = 1 + Math.random() * 5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${.15 + Math.random() * .45})`;
      ctx.fill();
    }
    wakeTexture = new THREE.CanvasTexture(canvas);
  }
  const geometry = new THREE.PlaneGeometry(.28 + Math.random() * .45, 1.4 + Math.random() * 1.6);
  const material = new THREE.MeshBasicMaterial({
    color: Math.random() > .35 ? "#eafcff" : "#68dcf5",
    map: wakeTexture,
    transparent: true,
    opacity: .55,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const particle = new THREE.Mesh(geometry, material);
  particle.rotation.x = -Math.PI / 2;
  particle.visible = false;
  wakeRoot.add(particle);
  wakes.push(particle);
}

function emitWake(intensity = 1) {
  const particle = wakes.find((item) => !item.visible);
  if (!particle) return;
  particle.visible = true;
  particle.material.opacity = .35 + intensity * .35;
  particle.scale.set(1, 1, 1);
  particle.position.set(state.x + (Math.random() - .5) * .72, .03, 1.25 + Math.random() * .35);
  particle.userData.life = 1;
  particle.userData.vx = (Math.random() - .5) * .55 - state.steer * .35;
}

function createRivals() {
  rivals.forEach((item) => rivalRoot.remove(item.group));
  rivals = [];
  const colors = [
    ["#1769e8", "#f5f7f9"],
    ["#ffd21a", "#15191f"],
    ["#ea2039", "#f1f2f4"],
  ];
  colors.forEach((colorset, index) => {
    const group = createJetSki(colorset[0], colorset[1], "#242c39");
    group.scale.multiplyScalar(.93);
    group.position.set((index - 1) * 5, 0, -10 - index * 9);
    rivalRoot.add(group);
    rivals.push({
      group,
      speed: config[state.mode].cruise * (.91 + index * .045 + Math.random() * .04),
      xBase: (index - 1) * 5,
      phase: Math.random() * Math.PI * 2,
      progress: 15 + index * 22,
    });
  });
}

function initialize3D() {
  const selection = $("#quality").value;
  state.highQuality = selection === "high"
    || (selection === "auto" && devicePixelRatio <= 2.4 && navigator.hardwareConcurrency >= 6);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2("#8dbbc5", state.highQuality ? .0042 : .0055);
  camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, .1, 750);
  camera.position.set(0, 4.4, 8.5);

  renderer = new THREE.WebGLRenderer({
    antialias: state.highQuality,
    powerPreference: "high-performance",
    alpha: false,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, state.highQuality ? 2 : 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = state.highQuality;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  ui.game.replaceChildren(renderer.domElement);

  clock = new THREE.Clock();
  makeSky();
  makeOcean();

  const hemi = new THREE.HemisphereLight("#d8f4ff", "#0a3140", 2.35);
  scene.add(hemi);
  sun = new THREE.DirectionalLight("#fff2c6", 3.5);
  sun.position.set(-34, 55, 22);
  sun.castShadow = state.highQuality;
  sun.shadow.mapSize.set(state.highQuality ? 2048 : 512, state.highQuality ? 2048 : 512);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  scene.add(sun, sun.target);

  trackRoot = new THREE.Group();
  wakeRoot = new THREE.Group();
  rivalRoot = new THREE.Group();
  sceneryRoot = new THREE.Group();
  scene.add(trackRoot, wakeRoot, rivalRoot, sceneryRoot);

  player = createJetSki();
  player.position.set(0, .18, 0);
  scene.add(player);

  createScenery();
  const wakeCount = state.highQuality ? 90 : 38;
  for (let i = 0; i < wakeCount; i += 1) createWakeParticle();
  createCourse();
  createRivals();
  renderer.setAnimationLoop(render);
}

function resetRace() {
  state.distance = 0;
  state.elapsed = 0;
  state.speed = 0;
  state.topSpeed = 0;
  state.nitro = 70;
  state.x = 0;
  state.vx = 0;
  state.score = 0;
  state.gates = 0;
  state.totalGates = 0;
  state.collisions = 0;
  state.paused = false;
  state.keys = { left: false, right: false, brake: false, nitro: false };
  if (player) player.position.set(0, .18, 0);
  if (trackRoot) createCourse();
  if (rivalRoot) createRivals();
}

function showCallout(message, color = "#fff") {
  ui.callout.textContent = message;
  ui.callout.style.color = color;
  ui.callout.classList.add("show");
  calloutTimer = 1.15;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function updateHud() {
  ui.speed.textContent = Math.round(state.speed);
  ui.timer.textContent = formatTime(state.elapsed);
  ui.distance.textContent = `${(state.distance / 1000).toFixed(2)} / ${(state.courseLength / 1000).toFixed(2)} KM`;
  ui.mode.textContent = config[state.mode].label;
  ui.courseBar.style.width = `${clamp(state.distance / state.courseLength * 100, 0, 100)}%`;
  ui.nitroBar.style.width = `${state.nitro}%`;
  ui.nitroValue.textContent = `${Math.round(state.nitro)}%`;
  const ahead = rivals.filter((rival) => rival.progress > state.distance).length;
  ui.position.textContent = Math.min(4, ahead + 1);
}

function updateTrack(dt, worldSpeed) {
  const recycleDistance = state.highQuality ? 720 : 490;
  trackObjects.forEach((object) => {
    object.position.z += worldSpeed * dt;
    if (object.position.z > 14) {
      object.position.z -= recycleDistance;
      object.position.x = object.userData.baseX + Math.sin(state.distance * .003) * 1.4;
      object.userData.hit = false;
    }
    const dx = Math.abs(object.position.x - state.x);
    const near = object.position.z > -.65 && object.position.z < 2.1;
    if (!near || object.userData.hit) return;
    object.userData.hit = true;
    if (object.userData.type === "gate") {
      if (dx < 2.1) {
        state.gates += 1;
        state.nitro = clamp(state.nitro + 22, 0, 100);
        state.score += state.mode === "precision" ? 800 : 500;
        showCallout(state.mode === "precision" ? "PRECISION GATE +800" : "BOOST GATE +500", "#79efff");
      } else {
        showCallout("GATE MISSED", "#ffba64");
      }
    }
    if (object.userData.type === "buoy" && dx < .95) {
      state.speed *= .62;
      state.vx += Math.sign(state.x - object.position.x || 1) * 2.8;
      state.collisions += 1;
      camera.position.x += (Math.random() - .5) * .3;
      showCallout("BUOY HIT · SPEED LOST", "#ff7257");
    }
    if (object.userData.type === "ramp" && dx < 1.45) {
      player.userData.jump = 1;
      state.score += 300;
      showCallout("AIRBORNE +300", "#fff0a8");
    }
  });
}

function updateRivals(dt, worldSpeed) {
  rivals.forEach((rival, index) => {
    rival.progress += rival.speed / 3.6 * dt;
    rival.group.position.z += (worldSpeed - rival.speed * .092) * dt;
    if (rival.group.position.z > 18) rival.group.position.z = -72 - index * 18;
    if (rival.group.position.z < -95) rival.group.position.z = -18 - index * 15;
    const targetX = rival.xBase + Math.sin(state.elapsed * .7 + rival.phase) * 2.2;
    rival.group.position.x = lerp(rival.group.position.x, targetX, dt * .8);
    rival.group.position.y = .14 + Math.sin(state.elapsed * 5 + index) * .06;
    rival.group.rotation.z = lerp(rival.group.rotation.z, (targetX - rival.group.position.x) * -.08, dt * 5);
    if (Math.abs(rival.group.position.z) < 2.5 && Math.abs(rival.group.position.x - state.x) < 1.1) {
      state.speed *= .97;
      state.vx += Math.sign(state.x - rival.group.position.x || 1) * dt * 2.8;
    }
  });
}

function updateWake(dt) {
  wakes.forEach((particle) => {
    if (!particle.visible) return;
    particle.userData.life -= dt * 1.15;
    particle.position.z += dt * (7 + state.speed * .035);
    particle.position.x += particle.userData.vx * dt;
    particle.scale.x += dt * 2.1;
    particle.scale.y += dt * .6;
    particle.material.opacity = Math.max(0, particle.userData.life * .58);
    if (particle.userData.life <= 0) particle.visible = false;
  });
}

function updatePlayer(dt) {
  const mode = config[state.mode];
  const input = Number(state.keys.right) - Number(state.keys.left);
  state.steer = lerp(state.steer, input, 1 - Math.exp(-dt * 10));
  state.vx += state.steer * dt * (state.speed > 80 ? 19 : 12);
  state.vx *= Math.pow(.05, dt);
  state.x = clamp(state.x + state.vx * dt, -8.4, 8.4);
  if (Math.abs(state.x) > 7.5) state.speed *= 1 - dt * .28;

  const boosting = state.keys.nitro && state.nitro > .2;
  const target = state.keys.brake ? 66 : mode.cruise + (boosting ? mode.max - mode.cruise : 0);
  state.speed = lerp(state.speed, target, 1 - Math.exp(-dt * (state.keys.brake ? 5 : 1.3)));
  if (boosting) state.nitro = Math.max(0, state.nitro - dt * 17);
  else state.nitro = Math.min(100, state.nitro + dt * 2.15);
  state.topSpeed = Math.max(state.topSpeed, state.speed);
  state.distance += state.speed / 3.6 * dt;
  state.elapsed += dt;

  const wave = Math.sin(state.elapsed * 6.4) * .055 + Math.sin(state.elapsed * 11.2) * .022;
  const jump = player.userData.jump || 0;
  if (jump > 0) player.userData.jump = Math.max(0, jump - dt * .9);
  const jumpY = jump > 0 ? Math.sin((1 - jump) * Math.PI) * 1.85 : 0;
  player.position.x = lerp(player.position.x, state.x, 1 - Math.exp(-dt * 12));
  player.position.y = .17 + wave + jumpY;
  player.rotation.z = lerp(player.rotation.z, -state.steer * .28 - state.vx * .025, 1 - Math.exp(-dt * 7));
  player.rotation.x = lerp(player.rotation.x, -wave * .8 + (jumpY > .2 ? -.08 : 0), 1 - Math.exp(-dt * 6));
  player.rotation.y = lerp(player.rotation.y, state.steer * .08, 1 - Math.exp(-dt * 6));

  nextWake -= dt;
  if (nextWake <= 0) {
    emitWake(boosting ? 1 : .55);
    if (boosting && state.highQuality) emitWake(1);
    nextWake = state.highQuality ? .026 : .065;
  }
  return state.speed * .092;
}

function updateCamera(dt, boosting) {
  const desired = new THREE.Vector3(
    state.x * .38 - state.steer * .65,
    4.15 + Math.sin(state.elapsed * 2.5) * .045,
    8.6 + (boosting ? .8 : 0),
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
  const target = new THREE.Vector3(state.x * .72, .78, -10.8);
  camera.lookAt(target);
  camera.fov = lerp(camera.fov, boosting ? 69 : 62, 1 - Math.exp(-dt * 3));
  camera.updateProjectionMatrix();
}

function finishRace() {
  state.phase = "result";
  ui.hud.classList.add("hidden");
  ui.touch.classList.add("hidden");
  ui.result.classList.remove("hidden");
  ui.finalTime.textContent = formatTime(state.elapsed);
  ui.topSpeed.textContent = Math.round(state.topSpeed);
  ui.gateScore.textContent = `${state.gates} / ${state.totalGates}`;
  const ahead = rivals.filter((rival) => rival.progress > state.courseLength).length;
  ui.finalPosition.textContent = `${Math.min(4, ahead + 1)} / 4`;
  state.speed = 0;
}

function render() {
  const rawDt = Math.min(clock.getDelta(), .05);
  if (!scene || state.paused) {
    if (renderer && scene && camera) renderer.render(scene, camera);
    return;
  }
  oceanUniforms.uTime.value += rawDt;

  if (state.phase === "racing") {
    const worldSpeed = updatePlayer(rawDt);
    updateTrack(rawDt, worldSpeed);
    updateRivals(rawDt, worldSpeed);
    updateWake(rawDt);
    updateCamera(rawDt, state.keys.nitro && state.nitro > 0);
    sceneryRoot.position.z = (sceneryRoot.position.z + worldSpeed * rawDt * .13) % 57;
    sun.target.position.set(state.x, 0, -20);
    updateHud();
    if (state.distance >= state.courseLength) finishRace();
  } else if (player) {
    player.position.y = .17 + Math.sin(performance.now() * .002) * .05;
    camera.position.x = Math.sin(performance.now() * .00018) * 1.2;
    camera.lookAt(0, .75, -8);
  }

  if (calloutTimer > 0) {
    calloutTimer -= rawDt;
    if (calloutTimer <= 0) ui.callout.classList.remove("show");
  }
  renderer.render(scene, camera);
}

async function fakeLoad() {
  ui.start.classList.add("hidden");
  ui.loading.classList.remove("hidden");
  for (let progress = 0; progress <= 100; progress += 4) {
    ui.loadingBar.style.width = `${progress}%`;
    ui.loadingValue.textContent = `${progress}%`;
    await new Promise((resolve) => setTimeout(resolve, progress < 72 ? 18 : 28));
  }
  ui.loading.classList.add("hidden");
}

async function countdown() {
  ui.countdown.classList.remove("hidden");
  for (const label of ["3", "2", "1", "GO!"]) {
    ui.countdown.textContent = label;
    ui.countdown.style.color = label === "GO!" ? "#ff5b21" : "#fff";
    await new Promise((resolve) => setTimeout(resolve, label === "GO!" ? 550 : 680));
  }
  ui.countdown.classList.add("hidden");
}

async function startRace() {
  state.phase = "loading";
  resetRace();
  if (!renderer) initialize3D();
  await fakeLoad();
  ui.hud.classList.remove("hidden");
  if (isTouch) ui.touch.classList.remove("hidden");
  state.phase = "countdown";
  await countdown();
  state.phase = "racing";
  clock.getDelta();
}

function setPaused(value) {
  if (state.phase !== "racing" && !state.paused) return;
  state.paused = value;
  ui.pauseScreen.classList.toggle("hidden", !value);
  if (!value) clock.getDelta();
}

function backToMenu() {
  state.phase = "menu";
  state.paused = false;
  ui.pauseScreen.classList.add("hidden");
  ui.result.classList.add("hidden");
  ui.hud.classList.add("hidden");
  ui.touch.classList.add("hidden");
  ui.start.classList.remove("hidden");
}

function bindControl(button) {
  const control = button.dataset.control;
  const set = (value, event) => {
    event.preventDefault();
    state.keys[control] = value;
    button.classList.toggle("active", value);
    if (value && button.setPointerCapture) button.setPointerCapture(event.pointerId);
  };
  button.addEventListener("pointerdown", (event) => set(true, event));
  button.addEventListener("pointerup", (event) => set(false, event));
  button.addEventListener("pointercancel", (event) => set(false, event));
  button.addEventListener("lostpointercapture", () => {
    state.keys[control] = false;
    button.classList.remove("active");
  });
}

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "brake",
  KeyS: "brake",
  ShiftLeft: "nitro",
  ShiftRight: "nitro",
  Space: "nitro",
};

addEventListener("keydown", (event) => {
  if (keyMap[event.code]) {
    state.keys[keyMap[event.code]] = true;
    event.preventDefault();
  }
  if (event.code === "Escape" || event.code === "KeyP") setPaused(!state.paused);
});
addEventListener("keyup", (event) => {
  if (keyMap[event.code]) {
    state.keys[keyMap[event.code]] = false;
    event.preventDefault();
  }
});
addEventListener("resize", () => {
  if (!camera || !renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.phase === "racing") setPaused(true);
});

ui.setup.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!supportsWebGL()) {
    ui.webglNotice.hidden = false;
    return;
  }
  state.mode = new FormData(ui.setup).get("mode");
  state.courseLength = Number(new FormData(ui.setup).get("distance"));
  startRace();
});
$$("[data-control]").forEach(bindControl);
$("#pause").addEventListener("click", () => setPaused(true));
$("#resume").addEventListener("click", () => setPaused(false));
$("#restartFromPause").addEventListener("click", () => {
  setPaused(false);
  startRace();
});
$("#exitRace").addEventListener("click", backToMenu);
$("#raceAgain").addEventListener("click", startRace);
$("#backToMenu").addEventListener("click", backToMenu);
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    // Fullscreen can be unavailable inside an embedded preview.
  }
});

if (!supportsWebGL()) ui.webglNotice.hidden = false;
