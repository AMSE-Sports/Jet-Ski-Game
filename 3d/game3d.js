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
  positionTotal: $("#positionTotal"),
  positionPanel: $("#positionPanel"),
  positionBadge: $("#positionBadge"),
  standings: $("#standingsList"),
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
  cinematicFx: $("#cinematicFx"),
};

const config = {
  time: { label: "TIME ATTACK", cruise: 132, max: 184, gates: 1, hazards: 1 },
  sprint: { label: "SPRINT", cruise: 152, max: 208, gates: .7, hazards: .65 },
  precision: { label: "PRECISION", cruise: 116, max: 168, gates: 1.35, hazards: 1.4 },
};

const riderProfiles = {
  blaze: {
    name: "BLAZE RYU",
    primary: "#ff5b21",
    secondary: "#111722",
    suit: "#eef1f4",
    accent: "#ffc444",
    skin: "#d9a073",
    handling: .96,
    boost: 1.1,
    stability: .94,
  },
  nova: {
    name: "NOVA KAI",
    primary: "#1ecbe8",
    secondary: "#071929",
    suit: "#e9f3f5",
    accent: "#ffffff",
    skin: "#b97954",
    handling: 1.08,
    boost: 1,
    stability: 1,
  },
  tide: {
    name: "TIDE VEGA",
    primary: "#f3ca22",
    secondary: "#20223a",
    suit: "#172033",
    accent: "#657bff",
    skin: "#e3b894",
    handling: 1.02,
    boost: .95,
    stability: 1.12,
  },
};

const aiLevels = {
  sport: { label: "SPORT", pace: .94, reaction: .82, attack: .72 },
  pro: { label: "PRO", pace: 1.015, reaction: 1, attack: 1 },
  elite: { label: "WORLD CLASS", pace: 1.06, reaction: 1.16, attack: 1.18 },
};

const rivalProfiles = [
  { name: "MIRA STORM", primary: "#1769e8", secondary: "#f5f7f9", suit: "#16263f", accent: "#5be8ff", skin: "#c88762", skill: .99, aggression: .72 },
  { name: "RYO VOLT", primary: "#ffd21a", secondary: "#15191f", suit: "#222630", accent: "#fff1a6", skin: "#d1a17c", skill: 1.035, aggression: .82 },
  { name: "LUCA WAVE", primary: "#e82947", secondary: "#f1f2f4", suit: "#253044", accent: "#ff8b9e", skin: "#b97855", skill: 1.01, aggression: .68 },
  { name: "KAI PHANTOM", primary: "#915cff", secondary: "#151422", suit: "#e8e6f2", accent: "#c6a8ff", skin: "#e0ad82", skill: 1.055, aggression: .9 },
  { name: "AYA SURGE", primary: "#19d592", secondary: "#08231d", suit: "#152d2a", accent: "#a6ffe0", skin: "#c98b66", skill: 1.025, aggression: .77 },
];

const WORLD_SCALE = .3312;

const state = {
  phase: "menu",
  mode: "time",
  rider: "blaze",
  difficulty: "pro",
  playerName: "WGP RIDER",
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
  position: 1,
  previousPosition: 1,
  shake: 0,
  impact: 0,
  splash: 0,
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
let cloudRoot;
let trackObjects = [];
let rivals = [];
let wakes = [];
let spray;
let sprayPositions;
let sprayVelocities = [];
let sprayLife = [];
let sprayCursor = 0;
let wakeTexture;
let animFrame = 0;
let calloutTimer = 0;
let nextWake = 0;
let nextRivalWake = 0;
let standingsTimer = 0;
let positionFxTimer = 0;
let menuTime = 0;

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
      topColor: { value: new THREE.Color("#087ec4") },
      horizonColor: { value: new THREE.Color("#bde9f3") },
      bottomColor: { value: new THREE.Color("#fff0cf") },
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

  const cloudCanvas = document.createElement("canvas");
  cloudCanvas.width = 256;
  cloudCanvas.height = 128;
  const cloudContext = cloudCanvas.getContext("2d");
  const cloudGradient = cloudContext.createRadialGradient(128, 70, 10, 128, 70, 105);
  cloudGradient.addColorStop(0, "rgba(255,255,255,.82)");
  cloudGradient.addColorStop(.42, "rgba(245,252,255,.52)");
  cloudGradient.addColorStop(1, "rgba(232,248,255,0)");
  cloudContext.fillStyle = cloudGradient;
  cloudContext.fillRect(0, 0, 256, 128);
  const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
  cloudRoot = new THREE.Group();
  for (let i = 0; i < (state.highQuality ? 24 : 12); i += 1) {
    const cloud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: .18 + Math.random() * .24,
      depthWrite: false,
      fog: true,
    }));
    const depth = -80 - Math.random() * 430;
    cloud.position.set((Math.random() - .5) * 530, 32 + Math.random() * 58, depth);
    const size = 35 + Math.random() * 85;
    cloud.scale.set(size * 2.2, size, 1);
    cloud.userData.drift = .12 + Math.random() * .28;
    cloudRoot.add(cloud);
  }
  scene.add(cloudRoot);
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
      varying float vSlope;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 p = position;
        float phaseA = p.x * .095 + uTime * 1.55;
        float phaseB = p.y * .052 - uTime * 1.05 + p.x * .018;
        float phaseC = (p.x + p.y) * .16 + uTime * 2.2;
        float a = sin(phaseA) * .20;
        float b = sin(phaseB) * .29;
        float c = sin(phaseC) * .07;
        p.z += a + b + c;
        float dx = cos(phaseA) * .019 + cos(phaseB) * .00522 + cos(phaseC) * .0112;
        float dy = cos(phaseB) * .01508 + cos(phaseC) * .0112;
        vec3 localNormal = normalize(vec3(-dx, -dy, 1.0));
        vWave = p.z;
        vSlope = length(vec2(dx, dy));
        vec4 world = modelMatrix * vec4(p, 1.0);
        vWorld = world.xyz;
        vNormal = normalize(normalMatrix * localNormal);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSun;
      uniform float uTime;
      varying float vWave;
      varying float vSlope;
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vWorld);
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(vec3(-.36, .88, .31));
        float crestA = max(0.0, sin(vWorld.x * .17 + vWorld.z * .065 + uTime * 1.45));
        float crestB = max(0.0, sin(vWorld.x * -.11 + vWorld.z * .14 - uTime * 1.1));
        float line = pow(crestA, 18.0) * pow(crestB, 4.0);
        float sparkle = pow(max(0.0,
          sin(vWorld.x * 1.35 + uTime * 1.7) *
          sin(vWorld.z * 1.72 - uTime * 1.2)
        ), 26.0);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
        float diffuse = max(dot(normal, lightDir), 0.0);
        float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 88.0);
        float depthMix = smoothstep(-.42, .42, vWave) * .56 + diffuse * .18;
        vec3 color = mix(uDeep, uShallow, depthMix);
        color = mix(color, vec3(.42, .78, .88), fresnel * .32);
        float foam = smoothstep(.030, .055, vSlope) * smoothstep(.02, .24, vWave);
        color += uSun * (specular * 1.35 + line * .1 + sparkle * .15);
        color = mix(color, vec3(.83, .98, 1.0), foam * .2);
        float fog = smoothstep(70.0, 430.0, -vWorld.z);
        color = mix(color, vec3(.52, .75, .8), fog * .5);
        gl_FragColor = vec4(color, .99);
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

function createJetSki(
  primary = "#f25822",
  secondary = "#111722",
  riderColor = "#f7f7f7",
  accent = "#ffc444",
  skin = "#d9a073",
  raceNumber = "1",
) {
  const group = new THREE.Group();
  const hull = mesh(hullGeometry(), new THREE.MeshPhysicalMaterial({
    color: primary, metalness: .32, roughness: .22, clearcoat: 1, clearcoatRoughness: .13,
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

  [-1, 1].forEach((side) => {
    const rail = mesh(new THREE.CapsuleGeometry(.045, 2.65, 3, 8), mat(accent, .26, .5));
    rail.rotation.x = Math.PI / 2;
    rail.position.set(side * .63, .03, .02);
    rail.scale.z = .72;
    group.add(rail);
  });

  const intake = mesh(new THREE.BoxGeometry(.42, .18, .62), mat("#080b10", .5, .35));
  intake.position.set(0, .46, -1.22);
  intake.rotation.x = -.16;
  group.add(intake);

  const seat = mesh(new THREE.CapsuleGeometry(.34, .74, 4, 10), mat("#171a1e", .8, .05));
  seat.rotation.x = Math.PI / 2;
  seat.position.set(0, .58, .52);
  seat.scale.set(1, .48, 1);
  group.add(seat);

  const seatTail = mesh(new THREE.BoxGeometry(.58, .22, .54), mat(primary, .3, .16));
  seatTail.position.set(0, .55, 1.08);
  seatTail.rotation.x = -.08;
  group.add(seatTail);

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
  const torso = mesh(new THREE.CapsuleGeometry(.24, .6, 7, 14), mat(riderColor, .43, .05));
  torso.rotation.x = -.32;
  rider.add(torso);
  const vest = mesh(new THREE.BoxGeometry(.53, .57, .25), new THREE.MeshPhysicalMaterial({
    color: primary, roughness: .38, metalness: .08, clearcoat: .36,
  }));
  vest.position.set(0, .06, -.11);
  vest.rotation.x = -.32;
  rider.add(vest);

  const vestPanel = mesh(new THREE.BoxGeometry(.19, .49, .018), mat(accent, .35, .08));
  vestPanel.position.set(0, .09, -.244);
  vestPanel.rotation.x = -.32;
  rider.add(vestPanel);

  const waist = mesh(new THREE.CylinderGeometry(.2, .24, .22, 12), mat(secondary, .55, .05));
  waist.position.set(0, -.42, .08);
  waist.rotation.x = -.25;
  rider.add(waist);

  [-1, 1].forEach((side) => {
    const thigh = mesh(new THREE.CapsuleGeometry(.095, .54, 5, 10), mat(riderColor, .5, .03));
    thigh.position.set(side * .17, -.55, .13);
    thigh.rotation.x = 1.02;
    thigh.rotation.z = side * .08;
    rider.add(thigh);

    const shin = mesh(new THREE.CapsuleGeometry(.075, .48, 5, 9), mat(secondary, .48, .08));
    shin.position.set(side * .25, -.64, .52);
    shin.rotation.x = -.72;
    shin.rotation.z = side * -.08;
    rider.add(shin);

    const boot = mesh(new THREE.BoxGeometry(.18, .14, .34), mat("#0a0d12", .65, .12));
    boot.position.set(side * .27, -.48, .77);
    boot.rotation.x = -.18;
    rider.add(boot);
  });

  const neck = mesh(new THREE.CylinderGeometry(.09, .1, .14, 10), mat(skin, .7, 0));
  neck.position.set(0, .56, -.08);
  rider.add(neck);

  const helmet = new THREE.Group();
  const head = mesh(new THREE.SphereGeometry(.235, 24, 16), new THREE.MeshPhysicalMaterial({
    color: secondary, roughness: .16, metalness: .32, clearcoat: 1, clearcoatRoughness: .08,
  }));
  helmet.add(head);

  const helmetStripe = mesh(new THREE.BoxGeometry(.085, .46, .03), mat(accent, .25, .2));
  helmetStripe.position.set(0, .04, -.22);
  helmetStripe.rotation.x = .16;
  helmet.add(helmetStripe);

  const chin = mesh(new THREE.BoxGeometry(.29, .13, .18), mat(primary, .24, .2));
  chin.position.set(0, -.12, -.18);
  chin.rotation.x = -.2;
  helmet.add(chin);

  const visor = mesh(new THREE.SphereGeometry(.19, 20, 10, 0, Math.PI), new THREE.MeshPhysicalMaterial({
    color: "#4bd9f5", metalness: .72, roughness: .08, transparent: true, opacity: .9,
  }));
  visor.rotation.y = Math.PI;
  visor.scale.set(1.08, .52, .48);
  visor.position.set(0, .035, -.185);
  helmet.add(visor);

  const fin = mesh(new THREE.BoxGeometry(.065, .22, .2), mat(primary, .25, .3));
  fin.position.set(0, .19, .06);
  fin.rotation.x = -.38;
  helmet.add(fin);
  helmet.position.set(0, .73, -.17);
  rider.add(helmet);

  [-1, 1].forEach((side) => {
    const shoulder = mesh(new THREE.SphereGeometry(.115, 12, 9), mat(primary, .38, .08));
    shoulder.position.set(side * .3, .28, -.05);
    shoulder.scale.set(1.05, .8, 1);
    rider.add(shoulder);

    const arm = mesh(new THREE.CapsuleGeometry(.075, .54, 5, 10), mat(riderColor, .5, .02));
    arm.position.set(side * .27, .18, -.23);
    arm.rotation.z = side * -.43;
    arm.rotation.x = .64;
    rider.add(arm);

    const glove = mesh(new THREE.SphereGeometry(.085, 12, 8), mat(secondary, .55, .12));
    glove.position.set(side * .43, .02, -.47);
    glove.scale.set(1, .78, 1.25);
    rider.add(glove);
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

  const numberCanvas = document.createElement("canvas");
  numberCanvas.width = numberCanvas.height = 128;
  const numberContext = numberCanvas.getContext("2d");
  numberContext.fillStyle = secondary;
  numberContext.beginPath();
  numberContext.arc(64, 64, 54, 0, Math.PI * 2);
  numberContext.fill();
  numberContext.strokeStyle = accent;
  numberContext.lineWidth = 8;
  numberContext.stroke();
  numberContext.fillStyle = "#fff";
  numberContext.font = "900 italic 64px Arial";
  numberContext.textAlign = "center";
  numberContext.textBaseline = "middle";
  numberContext.fillText(String(raceNumber), 61, 69);
  const numberPlate = mesh(new THREE.PlaneGeometry(.52, .52), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(numberCanvas), transparent: true, side: THREE.DoubleSide,
  }), false, false);
  numberPlate.position.set(-.7, .22, -.62);
  numberPlate.rotation.y = -Math.PI / 2;
  group.add(numberPlate);

  const boostFx = new THREE.Group();
  [-.24, .24].forEach((x) => {
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: x < 0 ? "#77ecff" : "#fff6c4",
      transparent: true,
      opacity: .72,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const jet = mesh(new THREE.ConeGeometry(.12, 1.18, 10), glowMaterial, false, false);
    jet.rotation.x = -Math.PI / 2;
    jet.position.set(x, -.12, 2.4);
    boostFx.add(jet);
  });
  boostFx.visible = false;
  group.add(boostFx);

  group.scale.setScalar(.92);
  group.userData.rider = rider;
  group.userData.helmet = helmet;
  group.userData.boostFx = boostFx;
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
    if (type === "buoy" && i % 2 === 0) createTrackObject("buoy", -lane || 5.2, z - 5);
  }
}

function createPalm(scale = 1) {
  const palm = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(.16, .26, 5.2, 9), mat("#8a6240", .88, 0), false, true);
  trunk.position.y = 2.4;
  trunk.rotation.z = -.08;
  palm.add(trunk);
  for (let i = 0; i < 7; i += 1) {
    const frond = mesh(new THREE.ConeGeometry(.42, 3.5, 5), mat(i % 2 ? "#2e8152" : "#3f9960", .84, 0), false, true);
    frond.scale.set(.27, 1, .1);
    frond.position.y = 5;
    frond.rotation.z = Math.PI / 2.25;
    frond.rotation.y = i / 7 * Math.PI * 2;
    palm.add(frond);
  }
  palm.scale.setScalar(scale);
  return palm;
}

function createRaceBoat() {
  const boat = new THREE.Group();
  const hull = mesh(new THREE.BoxGeometry(4.8, .65, 1.65), mat("#f0f3f5", .34, .22));
  hull.position.y = .12;
  hull.rotation.y = Math.PI / 2;
  boat.add(hull);
  const cabin = mesh(new THREE.BoxGeometry(1.8, 1.15, 1.25), new THREE.MeshPhysicalMaterial({
    color: "#152a3b", roughness: .18, metalness: .3, clearcoat: .7,
  }));
  cabin.position.y = .88;
  cabin.rotation.y = Math.PI / 2;
  boat.add(cabin);
  const mast = mesh(new THREE.CylinderGeometry(.03, .04, 2.2, 7), mat("#d8e1e6", .3, .7));
  mast.position.y = 2.1;
  boat.add(mast);
  const flag = mesh(new THREE.PlaneGeometry(.85, .45), new THREE.MeshBasicMaterial({
    color: "#ff5b21", side: THREE.DoubleSide,
  }), false, false);
  flag.position.set(.42, 2.65, 0);
  boat.add(flag);
  return boat;
}

function createVenueArch() {
  const arch = new THREE.Group();
  const archMaterial = new THREE.MeshPhysicalMaterial({
    color: "#ff5b21", roughness: .3, metalness: .08, clearcoat: .6,
  });
  [-8.5, 8.5].forEach((x) => {
    const post = mesh(new THREE.CylinderGeometry(.38, .55, 5.6, 14), archMaterial);
    post.position.set(x, 2.25, 0);
    arch.add(post);
  });
  const beam = mesh(new THREE.BoxGeometry(18, .85, .8), archMaterial);
  beam.position.y = 5.1;
  arch.add(beam);
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = "#07111c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#fff";
  context.font = "900 italic 72px Arial";
  context.textAlign = "center";
  context.fillText("WGP#1  WORLD SERIES", canvas.width / 2, 90);
  const board = mesh(new THREE.PlaneGeometry(15.5, 1.65), new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas), side: THREE.DoubleSide,
  }), false, false);
  board.position.set(0, 5.1, .43);
  arch.add(board);
  return arch;
}

function createScenery() {
  const sandMaterial = mat("#d9c184", .98, 0);
  [-1, 1].forEach((side) => {
    const shore = mesh(new THREE.BoxGeometry(46, 1.6, 820), sandMaterial, false, true);
    shore.position.set(side * 58, -1, -310);
    shore.rotation.z = side * -.015;
    sceneryRoot.add(shore);
  });

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
  for (let i = 0; i < 22; i += 1) {
    const side = i % 2 ? -1 : 1;
    const palm = createPalm(.74 + Math.random() * .52);
    palm.position.set(side * (39 + Math.random() * 34), -.28, -28 - i * 24 - Math.random() * 18);
    palm.rotation.y = Math.random() * Math.PI * 2;
    sceneryRoot.add(palm);
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

  if (state.highQuality) {
    const crowdGeometry = new THREE.BoxGeometry(.22, .48, .2);
    const crowdMaterial = mat("#f1c47e", .8, 0);
    const crowd = new THREE.InstancedMesh(crowdGeometry, crowdMaterial, 140);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 140; i += 1) {
      const side = i % 2 ? -1 : 1;
      const standIndex = Math.floor(i / 18);
      dummy.position.set(
        side * (42.7 + Math.random() * 5.5),
        1.95 + Math.floor(Math.random() * 3) * .38,
        -69 - standIndex * 57 + (Math.random() - .5) * 4,
      );
      dummy.rotation.y = side * Math.PI / 2;
      dummy.scale.setScalar(.75 + Math.random() * .6);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);
      const crowdColors = ["#ff784e", "#3ed2e7", "#f2d35b", "#f2f4f5", "#3b66d9"];
      crowd.setColorAt(i, new THREE.Color(crowdColors[i % crowdColors.length]));
    }
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    sceneryRoot.add(crowd);
  }

  for (let i = 0; i < 8; i += 1) {
    const boat = createRaceBoat();
    boat.position.set((i % 2 ? -1 : 1) * (24 + (i % 3) * 4), -.15, -80 - i * 63);
    boat.rotation.y = i % 2 ? -.08 : .08;
    sceneryRoot.add(boat);
  }

  for (let i = 0; i < 24; i += 1) {
    const side = i % 2 ? -1 : 1;
    const pole = mesh(new THREE.CylinderGeometry(.025, .035, 3.5, 6), mat("#dce7ec", .3, .6), false, false);
    pole.position.set(side * 29, 1.1, -32 - i * 22);
    sceneryRoot.add(pole);
    const flag = mesh(new THREE.PlaneGeometry(1.1, .58), new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? "#ff5b21" : i % 3 === 1 ? "#07111c" : "#f4f6f7",
      side: THREE.DoubleSide,
    }), false, false);
    flag.position.set(side * 29 + side * .52, 2.45, -32 - i * 22);
    flag.rotation.y = Math.PI / 2;
    sceneryRoot.add(flag);
  }

  const arch = createVenueArch();
  arch.position.set(0, 0, -42);
  sceneryRoot.add(arch);

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

function emitWakeAt(x, z, intensity = 1, steer = 0) {
  const particle = wakes.find((item) => !item.visible);
  if (!particle) return;
  particle.visible = true;
  particle.material.opacity = .35 + intensity * .35;
  particle.scale.set(1, 1, 1);
  particle.position.set(x + (Math.random() - .5) * .72, .03, z + 1.25 + Math.random() * .35);
  particle.userData.life = 1;
  particle.userData.vx = (Math.random() - .5) * .55 - steer * .35;
}

function emitWake(intensity = 1) {
  emitWakeAt(state.x, 0, intensity, state.steer);
}

function createSpraySystem() {
  const count = state.highQuality ? 210 : 80;
  sprayPositions = new Float32Array(count * 3);
  sprayVelocities = Array.from({ length: count }, () => new THREE.Vector3());
  sprayLife = new Float32Array(count);
  for (let i = 0; i < count; i += 1) sprayPositions[i * 3 + 1] = -100;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(sprayPositions, 3));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(.2, "rgba(223,250,255,.96)");
  gradient.addColorStop(.62, "rgba(115,220,244,.4)");
  gradient.addColorStop(1, "rgba(85,205,235,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const particleTexture = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({
    color: "#dffaff",
    size: state.highQuality ? .13 : .18,
    map: particleTexture,
    alphaMap: particleTexture,
    transparent: true,
    opacity: .82,
    alphaTest: .015,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  spray = new THREE.Points(geometry, material);
  spray.frustumCulled = false;
  wakeRoot.add(spray);
}

function emitSpray(x, y, z, intensity = 1, steer = 0) {
  if (!spray) return;
  const amount = state.highQuality ? Math.ceil(3 * intensity) : Math.ceil(1.5 * intensity);
  for (let n = 0; n < amount; n += 1) {
    const index = sprayCursor++ % sprayLife.length;
    const offset = index * 3;
    sprayPositions[offset] = x + (Math.random() - .5) * .58;
    sprayPositions[offset + 1] = y + Math.random() * .2;
    sprayPositions[offset + 2] = z + .95 + Math.random() * .5;
    sprayVelocities[index].set(
      (Math.random() - .5) * 1.8 - steer * 1.4,
      1.6 + Math.random() * 3.2 * intensity,
      3.5 + Math.random() * 4.5,
    );
    sprayLife[index] = .38 + Math.random() * .45;
  }
  spray.geometry.attributes.position.needsUpdate = true;
}

function createRiderLabel(name, color) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 112;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const label = new THREE.Sprite(material);
  label.position.set(0, 3.45, 0);
  label.scale.set(2.85, .63, 1);
  label.renderOrder = 10;
  label.userData = { canvas, context, texture, name, color, rank: 0 };
  return label;
}

function redrawRiderLabel(label, rank) {
  if (!label || label.userData.rank === rank) return;
  const {
    canvas, context, texture, name, color,
  } = label.userData;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(3,11,20,.76)";
  context.beginPath();
  context.roundRect(16, 12, 480, 84, 18);
  context.fill();
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(16, 12, 16, 84, 8);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 italic 44px Arial";
  context.textAlign = "left";
  context.fillText(`P${rank}`, 52, 67);
  context.font = "800 27px Arial";
  context.fillStyle = "rgba(255,255,255,.86)";
  context.fillText(name, 138, 64);
  texture.needsUpdate = true;
  label.userData.rank = rank;
}

function buildPlayer() {
  const profile = riderProfiles[state.rider];
  if (player) scene.remove(player);
  player = createJetSki(
    profile.primary,
    profile.secondary,
    profile.suit,
    profile.accent,
    profile.skin,
    "1",
  );
  player.position.set(0, .18, 0);
  scene.add(player);
}

function createRivals() {
  rivals.forEach((item) => rivalRoot.remove(item.group));
  rivals = [];
  const laneStarts = [-5.4, 0, 5.4, -2.7, 2.7];
  const gridOffsets = [-4, -14, -6, -10, -12];
  rivalProfiles.forEach((profile, index) => {
    const group = createJetSki(
      profile.primary,
      profile.secondary,
      profile.suit,
      profile.accent,
      profile.skin,
      String(index + 2),
    );
    group.scale.multiplyScalar(.96);
    const initialProgress = gridOffsets[index];
    group.position.set(laneStarts[index], 0, -initialProgress * WORLD_SCALE);
    const label = createRiderLabel(profile.name, profile.primary);
    group.add(label);
    rivalRoot.add(group);
    rivals.push({
      group,
      label,
      profile,
      speed: 0,
      targetSpeed: 0,
      xBase: laneStarts[index],
      targetX: laneStarts[index],
      phase: Math.random() * Math.PI * 2,
      progress: initialProgress,
      laneTimer: .8 + Math.random() * 1.8,
      boostTimer: 2.5 + Math.random() * 5,
      boosting: false,
      nitro: 58 + Math.random() * 30,
      rank: index + 2,
      visible: true,
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
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = state.highQuality;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor("#6fc1df");
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
  sun.shadow.bias = -.00016;
  sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);

  trackRoot = new THREE.Group();
  wakeRoot = new THREE.Group();
  rivalRoot = new THREE.Group();
  sceneryRoot = new THREE.Group();
  scene.add(trackRoot, wakeRoot, rivalRoot, sceneryRoot);

  buildPlayer();

  createScenery();
  const wakeCount = state.highQuality ? 90 : 38;
  for (let i = 0; i < wakeCount; i += 1) createWakeParticle();
  createSpraySystem();
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
  state.position = 1;
  state.previousPosition = 1;
  state.shake = 0;
  state.impact = 0;
  state.splash = 0;
  state.paused = false;
  state.keys = { left: false, right: false, brake: false, nitro: false };
  nextWake = 0;
  nextRivalWake = 0;
  standingsTimer = 0;
  if (scene) buildPlayer();
  if (trackRoot) createCourse();
  if (rivalRoot) createRivals();
  if (sceneryRoot) sceneryRoot.position.z = 0;
  ui.positionPanel.classList.remove("position-gained", "position-lost");
  ui.cinematicFx.classList.remove("splash");
  document.documentElement.style.setProperty("--boost", "0");
  document.documentElement.style.setProperty("--impact", "0");
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

function getStandings() {
  const profile = riderProfiles[state.rider];
  return [
    {
      id: "player",
      name: state.playerName,
      progress: state.distance,
      color: profile.primary,
      player: true,
    },
    ...rivals.map((rival, index) => ({
      id: `rival-${index}`,
      name: rival.profile.name,
      progress: rival.progress,
      color: rival.profile.primary,
      player: false,
      rival,
    })),
  ].sort((a, b) => b.progress - a.progress);
}

function renderStandings(order) {
  const leaderProgress = order[0]?.progress || 0;
  const fragment = document.createDocumentFragment();
  order.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = `${entry.player ? "player " : ""}${index === 0 ? "leader" : ""}`.trim();
    item.style.setProperty("--rider-color", entry.color);

    const rank = document.createElement("span");
    rank.className = "rank";
    rank.textContent = index + 1;
    const dot = document.createElement("i");
    dot.className = "dot";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = entry.name;
    const gap = document.createElement("span");
    gap.className = "gap";
    const metres = Math.max(0, leaderProgress - entry.progress);
    gap.textContent = index === 0 ? "LEADER" : `+${metres < 100 ? metres.toFixed(1) : Math.round(metres)} M`;
    item.append(rank, dot, name, gap);
    fragment.append(item);

    if (entry.rival) {
      entry.rival.rank = index + 1;
      redrawRiderLabel(entry.rival.label, index + 1);
    }
  });
  ui.standings.replaceChildren(fragment);
}

function handlePositionChange(position) {
  if (position === state.previousPosition || state.elapsed < 1.4) {
    state.previousPosition = position;
    return;
  }
  const gained = position < state.previousPosition;
  ui.positionPanel.classList.remove("position-gained", "position-lost");
  void ui.positionPanel.offsetWidth;
  ui.positionPanel.classList.add(gained ? "position-gained" : "position-lost");
  positionFxTimer = 1;
  if (gained) showCallout(`OVERTAKE · NOW P${position}`, "#74ffb4");
  state.previousPosition = position;
}

function updateHud(dt) {
  ui.speed.textContent = Math.round(state.speed);
  ui.timer.textContent = formatTime(state.elapsed);
  ui.distance.textContent = `${(state.distance / 1000).toFixed(2)} / ${(state.courseLength / 1000).toFixed(2)} KM`;
  ui.mode.textContent = config[state.mode].label;
  ui.courseBar.style.width = `${clamp(state.distance / state.courseLength * 100, 0, 100)}%`;
  ui.nitroBar.style.width = `${state.nitro}%`;
  ui.nitroValue.textContent = `${Math.round(state.nitro)}%`;
  standingsTimer -= dt;
  if (standingsTimer <= 0) {
    const order = getStandings();
    const position = order.findIndex((entry) => entry.player) + 1;
    state.position = position;
    ui.position.textContent = position;
    ui.positionTotal.textContent = order.length;
    ui.positionBadge.textContent = `P${position}`;
    handlePositionChange(position);
    renderStandings(order);
    standingsTimer = .1;
  }
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
      state.totalGates += 1;
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
      state.shake = Math.max(state.shake, .8);
      state.impact = 1;
      state.splash = 1.4;
      ui.cinematicFx.classList.remove("splash");
      void ui.cinematicFx.offsetWidth;
      ui.cinematicFx.classList.add("splash");
      showCallout("BUOY HIT · SPEED LOST", "#ff7257");
    }
    if (object.userData.type === "ramp" && dx < 1.45) {
      player.userData.jump = 1;
      state.score += 300;
      showCallout("AIRBORNE +300", "#fff0a8");
    }
  });
}

function updateRivals(dt) {
  const mode = config[state.mode];
  const level = aiLevels[state.difficulty];
  const lanes = [-6.3, -3.15, 0, 3.15, 6.3];

  rivals.forEach((rival, index) => {
    const { profile } = rival;
    const gapToPlayer = state.distance - rival.progress;
    const basePace = mode.cruise * level.pace * (.91 + profile.skill * .1);
    const adaptivePace = clamp(gapToPlayer / 160, -1, 1) * 7.5 * level.attack * profile.aggression;

    rival.boostTimer -= dt;
    rival.boostLeft = Math.max(0, (rival.boostLeft || 0) - dt);
    if (
      rival.boostTimer <= 0
      && rival.nitro > 24
      && state.elapsed > 2
      && Math.abs(rival.group.position.x) < 7
    ) {
      rival.boostLeft = .72 + Math.random() * .72 * level.attack;
      rival.boostTimer = 3.2 + Math.random() * (5.5 - profile.aggression * 1.4);
    }
    rival.boosting = rival.boostLeft > 0;
    const boostPace = rival.boosting ? 25 + 15 * profile.skill : 0;
    const maxPace = mode.max * (state.difficulty === "elite" ? .985 : .94);
    rival.targetSpeed = clamp(basePace + adaptivePace + boostPace, 78, maxPace);
    rival.speed = lerp(
      rival.speed,
      rival.targetSpeed,
      1 - Math.exp(-dt * (1.12 + level.reaction * .55)),
    );
    if (rival.boosting) rival.nitro = Math.max(0, rival.nitro - dt * 23);
    else rival.nitro = Math.min(100, rival.nitro + dt * 2.4);
    rival.progress += rival.speed / 3.6 * dt;

    rival.laneTimer -= dt;
    const closeToPlayer = Math.abs(gapToPlayer) < 28;
    if (rival.laneTimer <= 0) {
      let laneIndex = Math.floor(Math.random() * lanes.length);
      if (closeToPlayer && Math.abs(lanes[laneIndex] - state.x) < 1.8) {
        laneIndex = (laneIndex + 2 + index) % lanes.length;
      }
      rival.targetX = lanes[laneIndex];
      rival.laneTimer = 1.25 + Math.random() * (3.4 - level.reaction * .6);
    }
    if (closeToPlayer && Math.abs(rival.targetX - state.x) < 1.35) {
      rival.targetX += rival.targetX <= state.x ? -1.6 : 1.6;
      rival.targetX = clamp(rival.targetX, -7.2, 7.2);
    }

    const raceLine = rival.targetX + Math.sin(state.elapsed * .68 + rival.phase) * .42;
    const previousX = rival.group.position.x;
    rival.group.position.x = lerp(
      rival.group.position.x,
      raceLine,
      1 - Math.exp(-dt * (1.2 + level.reaction * .7)),
    );
    const relativeMetres = rival.progress - state.distance;
    const targetZ = -relativeMetres * WORLD_SCALE;
    rival.group.visible = targetZ > -145 && targetZ < 24;
    rival.label.visible = rival.group.visible && targetZ < -3.2 && targetZ > -95;
    rival.group.position.z = lerp(rival.group.position.z, targetZ, 1 - Math.exp(-dt * 9));
    const waterBob = Math.sin(state.elapsed * 6.2 + rival.phase) * .055
      + Math.sin(state.elapsed * 10.4 + index) * .02;
    rival.group.position.y = .15 + waterBob;
    const lateralVelocity = (rival.group.position.x - previousX) / Math.max(dt, .001);
    rival.group.rotation.z = lerp(
      rival.group.rotation.z,
      clamp(-lateralVelocity * .055, -.3, .3),
      1 - Math.exp(-dt * 5),
    );
    rival.group.rotation.x = lerp(rival.group.rotation.x, -waterBob * .75, 1 - Math.exp(-dt * 5));

    if (rival.group.userData.rider) {
      rival.group.userData.rider.rotation.z = lerp(
        rival.group.userData.rider.rotation.z,
        clamp(-lateralVelocity * .028, -.16, .16),
        1 - Math.exp(-dt * 7),
      );
    }
    if (rival.group.userData.boostFx) {
      rival.group.userData.boostFx.visible = rival.boosting && rival.group.visible;
      const pulse = .8 + Math.sin(state.elapsed * 28 + index) * .18;
      rival.group.userData.boostFx.scale.set(1, pulse, 1 + Math.random() * .24);
    }

    rival.collisionCooldown = Math.max(0, (rival.collisionCooldown || 0) - dt);
    if (
      rival.group.visible
      && rival.collisionCooldown <= 0
      && Math.abs(rival.group.position.z) < 2.65
      && Math.abs(rival.group.position.x - state.x) < 1.12
    ) {
      const direction = Math.sign(state.x - rival.group.position.x || (index % 2 ? 1 : -1));
      state.speed *= .9;
      state.vx += direction * 2.35;
      state.shake = Math.max(state.shake, .58);
      state.impact = Math.max(state.impact, .72);
      rival.collisionCooldown = 1.2;
      rival.targetX = clamp(rival.targetX - direction * 2.2, -7, 7);
      showCallout("RIDER CONTACT · HOLD THE LINE", "#ffb070");
    }
  });

  nextRivalWake -= dt;
  if (nextRivalWake <= 0) {
    rivals
      .filter((rival) => rival.group.visible && rival.group.position.z > -70 && rival.group.position.z < 12)
      .forEach((rival) => {
        emitWakeAt(
          rival.group.position.x,
          rival.group.position.z,
          rival.boosting ? .82 : .38,
          rival.group.rotation.z * -2,
        );
        if (state.highQuality && rival.group.position.z > -36) {
          emitSpray(rival.group.position.x, .05, rival.group.position.z, rival.boosting ? .7 : .34);
        }
      });
    nextRivalWake = state.highQuality ? .095 : .2;
  }
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

  if (!spray) return;
  for (let index = 0; index < sprayLife.length; index += 1) {
    if (sprayLife[index] <= 0) continue;
    const offset = index * 3;
    const velocity = sprayVelocities[index];
    sprayLife[index] -= dt;
    velocity.y -= dt * 7.8;
    sprayPositions[offset] += velocity.x * dt;
    sprayPositions[offset + 1] += velocity.y * dt;
    sprayPositions[offset + 2] += (velocity.z + state.speed * .058) * dt;
    if (sprayLife[index] <= 0 || sprayPositions[offset + 1] < -.35) {
      sprayLife[index] = 0;
      sprayPositions[offset + 1] = -100;
    }
  }
  spray.geometry.attributes.position.needsUpdate = true;
}

function updatePlayer(dt) {
  const mode = config[state.mode];
  const profile = riderProfiles[state.rider];
  const input = Number(state.keys.right) - Number(state.keys.left);
  state.steer = lerp(state.steer, input, 1 - Math.exp(-dt * (8.5 + profile.handling * 2.2)));
  state.vx += state.steer * dt * (state.speed > 80 ? 18.5 : 12) * profile.handling;
  state.vx *= Math.pow(.045 + (profile.stability - 1) * .012, dt);
  state.x = clamp(state.x + state.vx * dt, -8.4, 8.4);
  if (Math.abs(state.x) > 7.5) state.speed *= 1 - dt * (.29 / profile.stability);

  const boosting = state.keys.nitro && state.nitro > .2;
  const boostTop = mode.max * (.96 + profile.boost * .04);
  const target = state.keys.brake ? 66 : mode.cruise + (boosting ? boostTop - mode.cruise : 0);
  state.speed = lerp(state.speed, target, 1 - Math.exp(-dt * (state.keys.brake ? 5 : 1.3)));
  if (boosting) state.nitro = Math.max(0, state.nitro - dt * (18 / profile.boost));
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

  if (player.userData.rider) {
    player.userData.rider.rotation.z = lerp(
      player.userData.rider.rotation.z,
      -state.steer * .16,
      1 - Math.exp(-dt * 8),
    );
    player.userData.rider.position.y = 1.02 + Math.sin(state.elapsed * 11) * .012;
  }
  if (player.userData.helmet) {
    player.userData.helmet.rotation.y = lerp(
      player.userData.helmet.rotation.y,
      state.steer * .08,
      1 - Math.exp(-dt * 5),
    );
  }
  if (player.userData.boostFx) {
    player.userData.boostFx.visible = boosting;
    const pulse = .86 + Math.sin(state.elapsed * 32) * .16;
    player.userData.boostFx.scale.set(1, pulse, 1 + Math.random() * .35);
  }

  nextWake -= dt;
  if (nextWake <= 0) {
    emitWake(boosting ? 1 : .55);
    if (boosting && state.highQuality) emitWake(1);
    emitSpray(state.x, .03, .1, boosting ? 1.35 : .58, state.steer);
    nextWake = state.highQuality ? .026 : .065;
  }
  state.boosting = boosting;
  return state.speed * .092;
}

function updateCamera(dt, boosting) {
  state.shake = Math.max(0, state.shake - dt * 1.9);
  state.impact = Math.max(0, state.impact - dt * 2.7);
  state.splash = Math.max(0, state.splash - dt);
  const shakeX = (Math.random() - .5) * state.shake * .42;
  const shakeY = (Math.random() - .5) * state.shake * .24;
  const desired = new THREE.Vector3(
    state.x * .38 - state.steer * .65 + shakeX,
    4.15 + Math.sin(state.elapsed * 2.5) * .045 + shakeY,
    8.6 + (boosting ? .8 : 0),
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
  const target = new THREE.Vector3(state.x * .72 + shakeX * .3, .78 + shakeY * .2, -10.8);
  camera.lookAt(target);
  camera.rotation.z += state.steer * -.009 + shakeX * .006;
  camera.fov = lerp(camera.fov, boosting ? 71 : 62, 1 - Math.exp(-dt * 3));
  camera.updateProjectionMatrix();
  const boostVisual = boosting ? clamp((state.speed - config[state.mode].cruise) / 38, .18, 1) : 0;
  document.documentElement.style.setProperty("--boost", boostVisual.toFixed(3));
  document.documentElement.style.setProperty("--impact", state.impact.toFixed(3));
}

function finishRace() {
  state.phase = "result";
  ui.hud.classList.add("hidden");
  ui.touch.classList.add("hidden");
  ui.result.classList.remove("hidden");
  ui.finalTime.textContent = formatTime(state.elapsed);
  ui.topSpeed.textContent = Math.round(state.topSpeed);
  ui.gateScore.textContent = `${state.gates} / ${state.totalGates}`;
  const order = getStandings();
  const finalPosition = order.findIndex((entry) => entry.player) + 1;
  ui.finalPosition.textContent = `${finalPosition} / ${order.length}`;
  $("#resultTitle").innerHTML = finalPosition <= 3
    ? `PODIUM<br>SECURED.`
    : `RACE<br>COMPLETE.`;
  state.speed = 0;
  document.documentElement.style.setProperty("--boost", "0");
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
    updateRivals(rawDt);
    updateWake(rawDt);
    updateCamera(rawDt, state.keys.nitro && state.nitro > 0);
    sceneryRoot.position.z = (sceneryRoot.position.z + worldSpeed * rawDt * .13) % 57;
    if (cloudRoot) {
      cloudRoot.children.forEach((cloud) => {
        cloud.position.x += cloud.userData.drift * rawDt;
        if (cloud.position.x > 290) cloud.position.x = -290;
      });
    }
    sun.target.position.set(state.x, 0, -20);
    updateHud(rawDt);
    if (state.distance >= state.courseLength) finishRace();
  } else if (player) {
    menuTime += rawDt;
    player.position.y = .17 + Math.sin(performance.now() * .002) * .05;
    camera.position.x = Math.sin(performance.now() * .00018) * 1.2;
    camera.lookAt(0, .75, -8);
  }

  if (calloutTimer > 0) {
    calloutTimer -= rawDt;
    if (calloutTimer <= 0) ui.callout.classList.remove("show");
  }
  if (positionFxTimer > 0) {
    positionFxTimer -= rawDt;
    if (positionFxTimer <= 0) ui.positionPanel.classList.remove("position-gained", "position-lost");
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
  document.documentElement.style.setProperty("--boost", "0");
  document.documentElement.style.setProperty("--impact", "0");
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
  const form = new FormData(ui.setup);
  state.mode = form.get("mode");
  state.rider = form.get("rider");
  state.difficulty = $("#difficulty").value;
  state.playerName = $("#playerName").value.trim().toUpperCase() || riderProfiles[state.rider].name;
  state.courseLength = Number(form.get("distance"));
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
document.documentElement.dataset.gameReady = "true";
