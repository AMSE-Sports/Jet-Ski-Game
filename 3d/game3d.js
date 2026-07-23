import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

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
  grip: $("#gripValue"),
  gForce: $("#gForceValue"),
  surface: $("#surfaceValue"),
  turnCue: $("#turnCue"),
  turnArrow: $("#turnArrow"),
  turnLabel: $("#turnLabel"),
  radar: $("#radarRivals"),
  sound: $("#soundToggle"),
};

const config = {
  time: {
    label: "TIME ATTACK", cruise: 118, max: 154, acceleration: 1.02, gates: 1, hazards: .95,
  },
  sprint: {
    label: "SPRINT", cruise: 132, max: 170, acceleration: 1.08, gates: .75, hazards: .72,
  },
  precision: {
    label: "PRECISION", cruise: 101, max: 138, acceleration: .96, gates: 1.35, hazards: 1.35,
  },
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
    boost: 1.05,
    stability: .96,
    acceleration: 1.06,
    topSpeed: 1.012,
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
    acceleration: 1,
    topSpeed: 1,
  },
  tide: {
    name: "TIDE VEGA",
    primary: "#f3ca22",
    secondary: "#20223a",
    suit: "#172033",
    accent: "#657bff",
    skin: "#e3b894",
    handling: 1.02,
    boost: .97,
    stability: 1.08,
    acceleration: .97,
    topSpeed: .992,
  },
};

const aiLevels = {
  sport: {
    label: "SPORT", pace: .945, reaction: .76, attack: .72, consistency: .91, errorRate: .052,
  },
  pro: {
    label: "PRO", pace: .995, reaction: 1, attack: 1, consistency: .965, errorRate: .02,
  },
  elite: {
    label: "WORLD CLASS", pace: 1.025, reaction: 1.18, attack: 1.12, consistency: .992, errorRate: .005,
  },
};

const rivalProfiles = [
  {
    name: "MIRA STORM", primary: "#1769e8", secondary: "#f5f7f9", suit: "#16263f", accent: "#5be8ff", skin: "#c88762",
    skill: .995, aggression: .72, cornering: 1.04, launch: .98, boost: .97, defense: .88,
  },
  {
    name: "RYO VOLT", primary: "#ffd21a", secondary: "#15191f", suit: "#222630", accent: "#fff1a6", skin: "#d1a17c",
    skill: 1.012, aggression: .84, cornering: .97, launch: 1.06, boost: 1.04, defense: .96,
  },
  {
    name: "LUCA WAVE", primary: "#e82947", secondary: "#f1f2f4", suit: "#253044", accent: "#ff8b9e", skin: "#b97855",
    skill: 1.002, aggression: .66, cornering: 1.02, launch: 1, boost: 1, defense: .84,
  },
  {
    name: "KAI PHANTOM", primary: "#915cff", secondary: "#151422", suit: "#e8e6f2", accent: "#c6a8ff", skin: "#e0ad82",
    skill: 1.022, aggression: .91, cornering: 1.01, launch: 1.02, boost: 1.06, defense: 1.06,
  },
  {
    name: "AYA SURGE", primary: "#19d592", secondary: "#08231d", suit: "#152d2a", accent: "#a6ffe0", skin: "#c98b66",
    skill: 1.008, aggression: .77, cornering: 1.06, launch: .97, boost: .98, defense: .94,
  },
];

const WORLD_SCALE = .3312;
const TRACK_HALF_WIDTH = 8.35;
const GRAVITY = 9.81;

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
  yaw: 0,
  grip: 1,
  gForce: 0,
  vertical: .17,
  verticalVelocity: 0,
  airborne: false,
  landingCooldown: 0,
  throttleLoad: 0,
  slipstream: 0,
  curve: 0,
  surfaceChop: 0,
  raceSeed: 108,
  score: 0,
  gates: 0,
  totalGates: 0,
  collisions: 0,
  position: 1,
  previousPosition: 1,
  shake: 0,
  impact: 0,
  splash: 0,
  muted: false,
  paused: false,
  highQuality: true,
  keys: { left: false, right: false, brake: false, nitro: false },
};

let renderer;
let composer;
let bloomPass;
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
let audioEngine;
let radarDots = [];

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

function hash(value) {
  return Math.abs(Math.sin(value * 12.9898 + state.raceSeed * 0.731) * 43758.5453) % 1;
}

function courseCenter(distance) {
  const d = Math.max(0, distance);
  return Math.sin(d / 104) * 3.55
    + Math.sin(d / 247 + .82) * 2.25
    + Math.sin(d / 49 + .3) * .72;
}

function courseHeading(distance) {
  return (courseCenter(distance + 3) - courseCenter(distance - 3)) / 6;
}

function courseTurn(distance) {
  const before = courseHeading(distance - 14);
  const after = courseHeading(distance + 14);
  return clamp((after - before) * 25, -1, 1);
}

function racingLine(distance, skill = 1) {
  const approach = courseTurn(distance + 24);
  const apex = courseTurn(distance + 7);
  return clamp((-approach * 1.45 + apex * 2.65) * skill, -3.85, 3.85);
}

function waterSample(x, distance, time = state.elapsed) {
  const longWave = Math.sin(distance * .071 - time * 2.05 + x * .055) * .105;
  const crossWave = Math.sin(distance * .127 + time * 2.75 - x * .21) * .052;
  const chop = Math.sin(distance * .31 - time * 4.1 + x * .43) * .024;
  const swell = Math.sin(distance * .024 + time * .72) * .07;
  return longWave + crossWave + chop + swell;
}

function waterSlope(x, distance) {
  const sample = .42;
  return (waterSample(x, distance + sample) - waterSample(x, distance - sample)) / (sample * 2);
}

function createEnvironmentMap() {
  const faces = Array.from({ length: 6 }, (_, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    if (index === 2) {
      gradient.addColorStop(0, "#176fa6");
      gradient.addColorStop(.72, "#7cc9df");
      gradient.addColorStop(1, "#e8d5a7");
    } else if (index === 3) {
      gradient.addColorStop(0, "#073d58");
      gradient.addColorStop(1, "#0c7891");
    } else {
      gradient.addColorStop(0, "#0d6f9f");
      gradient.addColorStop(.53, "#79c6dd");
      gradient.addColorStop(.58, "#f4d8a4");
      gradient.addColorStop(1, "#0b627b");
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    if (index !== 3) {
      const glow = context.createRadialGradient(62, 54, 1, 62, 54, 54);
      glow.addColorStop(0, "rgba(255,255,232,.92)");
      glow.addColorStop(.12, "rgba(255,225,154,.66)");
      glow.addColorStop(1, "rgba(255,190,83,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, 256, 256);
    }
    return canvas;
  });
  const environment = new THREE.CubeTexture(faces);
  environment.colorSpace = THREE.SRGBColorSpace;
  environment.needsUpdate = true;
  scene.environment = environment;
}

function initializeAudio() {
  if (audioEngine) {
    if (audioEngine.context.state === "suspended") audioEngine.context.resume();
    return;
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = .006;
  compressor.release.value = .18;
  master.gain.value = state.muted ? 0 : .58;
  master.connect(compressor).connect(context.destination);

  const engineFilter = context.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 1050;
  engineFilter.Q.value = 1.4;
  const engineGain = context.createGain();
  engineGain.gain.value = .0001;
  engineFilter.connect(engineGain).connect(master);

  const low = context.createOscillator();
  low.type = "sawtooth";
  low.frequency.value = 45;
  const high = context.createOscillator();
  high.type = "triangle";
  high.frequency.value = 92;
  const lowGain = context.createGain();
  const highGain = context.createGain();
  lowGain.gain.value = .68;
  highGain.gain.value = .34;
  low.connect(lowGain).connect(engineFilter);
  high.connect(highGain).connect(engineFilter);
  low.start();
  high.start();

  const seconds = 2;
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let previous = 0;
  for (let i = 0; i < channel.length; i += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * .91 + white * .09;
    channel[i] = previous;
  }
  const wind = context.createBufferSource();
  wind.buffer = buffer;
  wind.loop = true;
  const windFilter = context.createBiquadFilter();
  windFilter.type = "bandpass";
  windFilter.frequency.value = 850;
  windFilter.Q.value = .55;
  const windGain = context.createGain();
  windGain.gain.value = .0001;
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start();

  audioEngine = {
    context, master, engineGain, engineFilter, low, high, windFilter, windGain,
  };
}

function updateAudio() {
  if (!audioEngine) return;
  const {
    context, engineGain, engineFilter, low, high, windFilter, windGain,
  } = audioEngine;
  const now = context.currentTime;
  const speedRatio = clamp(state.speed / config[state.mode].max, 0, 1.12);
  const load = state.phase === "racing" ? .42 + speedRatio * .58 : .06;
  low.frequency.setTargetAtTime(42 + speedRatio * 118 + state.throttleLoad * 18, now, .045);
  high.frequency.setTargetAtTime(86 + speedRatio * 244 + (state.boosting ? 52 : 0), now, .04);
  engineFilter.frequency.setTargetAtTime(640 + speedRatio * 1900, now, .055);
  engineGain.gain.setTargetAtTime(load * (state.muted ? 0 : .14), now, .06);
  windFilter.frequency.setTargetAtTime(520 + speedRatio * 1550, now, .08);
  windGain.gain.setTargetAtTime(speedRatio * speedRatio * (state.muted ? 0 : .11), now, .1);
}

function playImpact(intensity = 1) {
  if (!audioEngine || state.muted) return;
  const { context, master } = audioEngine;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(115 + intensity * 45, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(36, context.currentTime + .18);
  gain.gain.setValueAtTime(.16 * intensity, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + .24);
  oscillator.connect(gain).connect(master);
  oscillator.start();
  oscillator.stop(context.currentTime + .26);
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
    uDeep: { value: new THREE.Color("#012f48") },
    uShallow: { value: new THREE.Color("#0d8ea5") },
    uSun: { value: new THREE.Color("#fff0b8") },
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
        float phaseD = p.x * -.31 + p.y * .23 + uTime * 3.4;
        float a = sin(phaseA) * .20;
        float b = sin(phaseB) * .29;
        float c = sin(phaseC) * .07;
        float d = sin(phaseD) * .026;
        p.z += a + b + c + d;
        float dx = cos(phaseA) * .019 + cos(phaseB) * .00522 + cos(phaseC) * .0112 - cos(phaseD) * .00806;
        float dy = cos(phaseB) * .01508 + cos(phaseC) * .0112 + cos(phaseD) * .00598;
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
        float microX = sin(vWorld.x * .82 + vWorld.z * .51 + uTime * 2.9) * .035;
        float microZ = cos(vWorld.x * .63 - vWorld.z * .91 - uTime * 2.25) * .031;
        vec3 normal = normalize(vNormal + vec3(microX, 0.0, microZ));
        vec3 lightDir = normalize(vec3(-.36, .88, .31));
        float crestA = max(0.0, sin(vWorld.x * .14 + vWorld.z * .058 + uTime * 1.4));
        float crestB = max(0.0, sin(vWorld.x * -.095 + vWorld.z * .125 - uTime * 1.05));
        float line = pow(crestA, 15.0) * pow(crestB, 3.0);
        float glitterMask =
          .5 + .5 * sin(vWorld.x * 2.35 + uTime * 3.1) *
          sin(vWorld.z * 1.84 - uTime * 2.35);
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.4);
        float diffuse = max(dot(normal, lightDir), 0.0);
        float reflectedSun = max(dot(reflect(-lightDir, normal), viewDir), 0.0);
        float specular = pow(reflectedSun, 118.0) * 1.8
          + pow(reflectedSun, 28.0) * glitterMask * .24;
        float depthMix = smoothstep(-.45, .4, vWave) * .48 + diffuse * .17;
        vec3 color = mix(uDeep, uShallow, depthMix);
        vec3 skyReflection = mix(vec3(.38, .73, .86), vec3(.79, .91, .94), clamp(viewDir.y * 1.8, 0.0, 1.0));
        color = mix(color, skyReflection, fresnel * .48);
        float foam = smoothstep(.028, .058, vSlope) * smoothstep(.015, .25, vWave);
        color += uSun * specular;
        color = mix(color, vec3(.82, .97, 1.0), clamp(foam * .28 + line * .11, 0.0, .34));
        float fog = smoothstep(70.0, 430.0, -vWorld.z);
        color = mix(color, vec3(.56, .76, .81), fog * .52);
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
    color: primary,
    metalness: .28,
    roughness: .16,
    clearcoat: 1,
    clearcoatRoughness: .08,
    envMapIntensity: 1.42,
  }));
  hull.rotation.y = Math.PI;
  group.add(hull);

  const lower = mesh(new THREE.CapsuleGeometry(.62, 2.1, 6, 14), new THREE.MeshPhysicalMaterial({
    color: "#0b1118",
    roughness: .28,
    metalness: .26,
    clearcoat: .62,
    envMapIntensity: 1.1,
  }));
  lower.rotation.x = Math.PI / 2;
  lower.scale.set(1, .43, 1);
  lower.position.set(0, -.28, .15);
  group.add(lower);

  const deck = mesh(new THREE.CapsuleGeometry(.53, 1.6, 6, 16), new THREE.MeshPhysicalMaterial({
    color: secondary,
    roughness: .2,
    metalness: .16,
    clearcoat: .9,
    clearcoatRoughness: .1,
    envMapIntensity: 1.32,
  }));
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

    const sponson = mesh(new THREE.BoxGeometry(.19, .13, 1.18), new THREE.MeshPhysicalMaterial({
      color: secondary,
      roughness: .25,
      metalness: .28,
      clearcoat: .7,
    }));
    sponson.position.set(side * .71, -.12, .58);
    sponson.rotation.x = -.05;
    sponson.rotation.y = side * -.035;
    group.add(sponson);
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
  const windscreen = mesh(
    new THREE.SphereGeometry(.42, 24, 12, 0, Math.PI * 2, 0, Math.PI * .52),
    new THREE.MeshPhysicalMaterial({
      color: "#74cde1",
      metalness: .12,
      roughness: .06,
      transmission: .3,
      transparent: true,
      opacity: .72,
      thickness: .18,
      clearcoat: 1,
      envMapIntensity: 1.7,
      side: THREE.DoubleSide,
    }),
  );
  windscreen.scale.set(.76, .58, .38);
  windscreen.rotation.x = -.35;
  windscreen.position.set(0, .88, -1.03);
  group.add(windscreen);
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
  const nozzle = mesh(new THREE.CylinderGeometry(.13, .18, .42, 12), mat("#10171d", .27, .58));
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.set(0, -.18, 2.05);
  group.add(nozzle);

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
    color: secondary,
    roughness: .12,
    metalness: .3,
    clearcoat: 1,
    clearcoatRoughness: .055,
    envMapIntensity: 1.6,
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

  const contactShadow = mesh(
    new THREE.CircleGeometry(1, 32),
    new THREE.MeshBasicMaterial({
      color: "#00131c",
      transparent: true,
      opacity: .18,
      depthWrite: false,
    }),
    false,
    false,
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.set(.72, 2.65, 1);
  contactShadow.position.set(0, -.39, .22);
  contactShadow.renderOrder = -1;
  group.add(contactShadow);

  group.scale.setScalar(.88);
  group.userData.rider = rider;
  group.userData.helmet = helmet;
  group.userData.boostFx = boostFx;
  group.userData.contactShadow = contactShadow;
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

function createTrackObject(type, lane, courseDistance, options = {}) {
  const object = new THREE.Group();
  let visual;
  if (type === "gate") visual = createGate();
  if (type === "buoy") {
    visual = createBuoy(hash(courseDistance) > .5 ? "#ff5b21" : "#ffe144", .88);
  }
  if (type === "ramp") visual = createRamp();
  if (type === "marker") {
    visual = createBuoy(options.side < 0 ? "#ff5b21" : "#ffe144", .54);
    visual.scale.y *= .86;
  }
  object.add(visual);
  object.userData = {
    type,
    hit: false,
    lane,
    courseDistance,
    side: options.side || 0,
    collidable: type !== "marker",
  };
  trackRoot.add(object);
  trackObjects.push(object);
  return object;
}

function createCourse() {
  trackObjects.forEach((item) => trackRoot.remove(item));
  trackObjects = [];
  const spacing = state.mode === "precision" ? 28 : state.mode === "sprint" ? 42 : 36;
  const visibleSpan = state.highQuality ? 880 : 610;
  const count = Math.ceil(visibleSpan / spacing);
  const lanes = [-4.9, 0, 4.9];
  for (let i = 0; i < count; i += 1) {
    const distance = 42 + i * spacing;
    const lane = lanes[(i * 7 + 1) % 3];
    let type = i % 6 === 1 ? "gate" : i % 10 === 6 ? "ramp" : "buoy";
    if (state.mode === "sprint" && i % 5 === 1) type = "gate";
    createTrackObject(type, lane, distance);
    if (type === "buoy" && i % 2 === 0) {
      createTrackObject("buoy", -lane || 4.9, distance + 5.5);
    }
  }

  const markerSpacing = state.highQuality ? 42 : 56;
  for (let distance = 24; distance < visibleSpan; distance += markerSpacing) {
    createTrackObject("marker", -(TRACK_HALF_WIDTH + 1.35), distance, { side: -1 });
    createTrackObject("marker", TRACK_HALF_WIDTH + 1.35, distance + markerSpacing * .5, { side: 1 });
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

function createCoastStrip(side, innerDistance, outerDistance, material, height = 0) {
  const segments = state.highQuality ? 72 : 40;
  const length = 920;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segments; i += 1) {
    const ratio = i / segments;
    const z = 34 - ratio * length;
    const irregular = Math.sin(i * .72 + side) * 1.9 + Math.sin(i * .21) * 2.6;
    const innerX = side * (innerDistance + irregular);
    const outerX = side * outerDistance;
    const innerY = -.54 + Math.sin(i * .43) * .08 + height;
    const outerY = .12 + Math.sin(i * .17 + side) * .28 + height;
    positions.push(innerX, innerY, z, outerX, outerY, z);
    uvs.push(0, ratio * 12, 1, ratio * 12);
    if (i < segments) {
      const a = i * 2;
      const b = a + 2;
      if (side < 0) {
        indices.push(a, a + 1, b + 1, a, b + 1, b);
      } else {
        indices.push(a, b + 1, a + 1, a, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(geometry, material, false, true);
}

function createScenery() {
  const sandMaterial = new THREE.MeshStandardMaterial({
    color: "#cdb47a",
    roughness: .96,
    metalness: 0,
    vertexColors: false,
  });
  const grassMaterial = new THREE.MeshStandardMaterial({
    color: "#496f50",
    roughness: .98,
    metalness: 0,
  });
  [-1, 1].forEach((side) => {
    sceneryRoot.add(createCoastStrip(side, 17.5, 104, sandMaterial));
    sceneryRoot.add(createCoastStrip(side, 31, 112, grassMaterial, .24));
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
  const laneStarts = [-3.9, 1.35, 4.25, -1.35, 3.1];
  // A real closed-course start is nearly abreast. Tiny offsets keep the
  // silhouettes readable without handing every rival an artificial head start.
  const gridOffsets = [1.6, .8, 0, -.8, -1.6];
  rivalProfiles.forEach((profile, index) => {
    const group = createJetSki(
      profile.primary,
      profile.secondary,
      profile.suit,
      profile.accent,
      profile.skin,
      String(index + 2),
    );
    group.scale.multiplyScalar(.9);
    const initialProgress = gridOffsets[index];
    group.position.set(laneStarts[index], .15, -initialProgress * WORLD_SCALE);
    const label = createRiderLabel(profile.name, profile.primary);
    group.add(label);
    rivalRoot.add(group);
    rivals.push({
      group,
      label,
      profile,
      speed: 0,
      targetSpeed: 0,
      lineX: laneStarts[index],
      targetLine: laneStarts[index],
      lateralVelocity: 0,
      phase: hash(index + 31) * Math.PI * 2,
      progress: initialProgress,
      decisionTimer: .45 + hash(index + 2) * 1.1,
      boostTimer: 2.5 + hash(index + 41) * 5,
      boosting: false,
      nitro: 58 + hash(index + 51) * 30,
      mistakeTimer: 5 + hash(index + 7) * 9,
      mistakeOffset: 0,
      paceNoise: .985 + hash(index + 12) * .03,
      behavior: "racing",
      wakePenalty: 0,
      obstacleCooldown: 0,
      obstacleHits: 0,
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
  createEnvironmentMap();
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

  composer = null;
  bloomPass = null;
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpuName = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : gl.getParameter(gl.RENDERER);
  const softwareRenderer = /swiftshader|llvmpipe|software/i.test(String(gpuName));
  if (state.highQuality && !softwareRenderer) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    composer.setSize(innerWidth, innerHeight);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(innerWidth, innerHeight),
      .31,
      .34,
      .9,
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

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
  radarDots = [];
  ui.radar.replaceChildren();
  rivalProfiles.forEach((profile) => {
    const dot = document.createElement("i");
    dot.style.setProperty("--radar-color", profile.primary);
    ui.radar.append(dot);
    radarDots.push(dot);
  });
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
  state.yaw = 0;
  state.grip = 1;
  state.gForce = 0;
  state.vertical = .17;
  state.verticalVelocity = 0;
  state.airborne = false;
  state.landingCooldown = 0;
  state.throttleLoad = 0;
  state.slipstream = 0;
  state.curve = 0;
  state.surfaceChop = 0;
  state.raceSeed = 108 + state.courseLength * .01 + ["time", "sprint", "precision"].indexOf(state.mode) * 37;
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
  if (ui.grip) ui.grip.textContent = "100%";
  if (ui.gForce) ui.gForce.textContent = "0.0 G";
  if (ui.surface) ui.surface.textContent = "CALM";
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
  ui.grip.textContent = `${Math.round(state.grip * 100)}%`;
  ui.gForce.textContent = `${state.gForce.toFixed(1)} G`;
  ui.surface.textContent = state.surfaceChop > .78
    ? "ROUGH"
    : state.surfaceChop > .42
      ? "CHOP"
      : "CALM";

  const turn = courseTurn(state.distance + 42);
  const turnStrength = Math.abs(turn);
  ui.turnCue.classList.toggle("hard", turnStrength > .54);
  ui.turnCue.classList.toggle("straight", turnStrength < .14);
  if (turnStrength < .14) {
    ui.turnArrow.textContent = "↑";
    ui.turnLabel.textContent = "STRAIGHT";
  } else {
    const right = turn > 0;
    ui.turnArrow.textContent = right ? "↗" : "↖";
    ui.turnLabel.textContent = `${turnStrength > .54 ? "HARD" : "FAST"} ${right ? "RIGHT" : "LEFT"}`;
  }

  radarDots.forEach((dot, index) => {
    const rival = rivals[index];
    if (!rival) return;
    const relative = rival.progress - state.distance;
    const nearby = relative > -24 && relative < 64;
    dot.style.display = nearby ? "block" : "none";
    if (!nearby) return;
    dot.style.left = `${clamp((rival.lineX / (TRACK_HALF_WIDTH * 2) + .5) * 100, 5, 95)}%`;
    dot.style.bottom = `${clamp((relative + 24) / 88 * 100, 2, 98)}%`;
  });

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

function updateTrack() {
  const recycleMetres = state.highQuality ? 880 : 610;
  const currentCenter = courseCenter(state.distance);
  trackObjects.forEach((object) => {
    while (object.userData.courseDistance < state.distance - 34) {
      object.userData.courseDistance += recycleMetres;
      object.userData.hit = false;
    }
    const ahead = object.userData.courseDistance - state.distance;
    const curveOffset = courseCenter(object.userData.courseDistance) - currentCenter;
    object.position.x = object.userData.lane + curveOffset;
    object.position.z = -ahead * WORLD_SCALE;
    object.position.y = waterSample(
      object.userData.lane,
      object.userData.courseDistance,
    ) * (object.userData.type === "marker" ? .48 : .16);
    object.rotation.y = Math.atan(courseHeading(object.userData.courseDistance));
    object.visible = ahead > -36 && ahead < recycleMetres + 30;
    if (!object.userData.collidable) {
      object.rotation.z = Math.sin(state.elapsed * 1.6 + object.userData.courseDistance) * .025;
      return;
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
      state.grip = Math.max(.42, state.grip - .25);
      ui.cinematicFx.classList.remove("splash");
      void ui.cinematicFx.offsetWidth;
      ui.cinematicFx.classList.add("splash");
      playImpact(.9);
      showCallout("BUOY HIT · SPEED LOST", "#ff7257");
    }
    if (object.userData.type === "ramp" && dx < 1.45) {
      state.airborne = true;
      state.verticalVelocity = 5.4 + state.speed * .012;
      state.vertical = Math.max(state.vertical, .28);
      state.score += 300;
      state.shake = Math.max(state.shake, .24);
      showCallout("AIRBORNE +300", "#fff0a8");
    }
  });
}

function updateRivals(dt) {
  const mode = config[state.mode];
  const level = aiLevels[state.difficulty];
  const playerCenter = courseCenter(state.distance);

  rivals.forEach((rival, index) => {
    const { profile } = rival;
    const gapToPlayer = state.distance - rival.progress;
    const turnAhead = courseTurn(rival.progress + 34);
    const cornerSeverity = Math.abs(turnAhead);
    const ideal = racingLine(rival.progress, profile.cornering);

    const field = [
      {
        progress: state.distance,
        lineX: state.x,
        player: true,
      },
      ...rivals
        .filter((entry) => entry !== rival)
        .map((entry) => ({
          progress: entry.progress,
          lineX: entry.lineX,
          player: false,
        })),
    ];
    const ahead = field
      .map((entry) => ({ ...entry, gap: entry.progress - rival.progress }))
      .filter((entry) => entry.gap > 0 && entry.gap < 30)
      .sort((a, b) => a.gap - b.gap)[0];
    const behind = field
      .map((entry) => ({ ...entry, gap: rival.progress - entry.progress }))
      .filter((entry) => entry.gap > 0 && entry.gap < 13)
      .sort((a, b) => a.gap - b.gap)[0];

    rival.decisionTimer -= dt;
    rival.mistakeTimer -= dt;
    if (rival.mistakeTimer <= 0) {
      const makesError = hash(state.elapsed * .17 + index * 9.1) < level.errorRate;
      rival.mistakeOffset = makesError
        ? (hash(state.elapsed + index * 3.7) - .5) * (3.1 - level.consistency)
        : 0;
      rival.mistakeTimer = 4.5 + hash(state.elapsed + index * 11) * (9 + level.consistency * 5);
    }
    rival.mistakeOffset = lerp(rival.mistakeOffset, 0, 1 - Math.exp(-dt * .42));

    if (rival.decisionTimer <= 0) {
      let target = ideal + rival.mistakeOffset;
      rival.behavior = "racing";

      if (ahead && Math.abs(ahead.lineX - target) < 2.15) {
        const roomLeft = ahead.lineX + TRACK_HALF_WIDTH;
        const roomRight = TRACK_HALF_WIDTH - ahead.lineX;
        const preferredSide = roomRight > roomLeft ? 1 : -1;
        const attackSide = hash(index * 17 + state.elapsed * .13) < profile.aggression
          ? preferredSide
          : -preferredSide;
        target = ahead.lineX + attackSide * (2.05 + profile.aggression * .55);
        rival.behavior = "attacking";
      } else if (behind?.player && behind.gap < 9 && profile.defense > .92) {
        target = lerp(target, behind.lineX, .42 * profile.defense);
        rival.behavior = "defending";
      }

      const obstacle = trackObjects
        .filter((object) => (
          object.userData.type === "buoy"
          && object.userData.courseDistance > rival.progress + 4
          && object.userData.courseDistance < rival.progress + 31
          && Math.abs(object.userData.lane - target) < 1.25
        ))
        .sort((a, b) => a.userData.courseDistance - b.userData.courseDistance)[0];
      if (obstacle) {
        const direction = obstacle.userData.lane > 0 ? -1 : 1;
        target = obstacle.userData.lane + direction * (1.75 + level.reaction * .22);
        rival.behavior = "avoiding";
      }

      rival.targetLine = clamp(target, -TRACK_HALF_WIDTH + .55, TRACK_HALF_WIDTH - .55);
      rival.decisionTimer = .24 + (1.22 - level.reaction * .58)
        + hash(index + state.elapsed) * .32;
    }

    rival.boostTimer -= dt;
    rival.boostLeft = Math.max(0, (rival.boostLeft || 0) - dt);
    if (
      rival.boostTimer <= 0
      && rival.nitro > 22
      && state.elapsed > 1.5
      && cornerSeverity < .38
      && (!ahead || ahead.gap < 24 || rival.progress < state.distance)
    ) {
      rival.boostLeft = (.58 + hash(state.elapsed + index) * .68)
        * profile.boost
        * level.attack;
      rival.boostTimer = 3.5 + hash(index * 4 + state.elapsed) * (4.9 - profile.aggression);
    }
    rival.boosting = rival.boostLeft > 0;
    const racePace = mode.cruise * level.pace * profile.skill * rival.paceNoise;
    const physicalTop = mode.max * (1 + (profile.skill - 1) * .35);
    const cornerLoss = cornerSeverity * (17.5 / (profile.cornering * level.consistency));
    const lineError = Math.abs(rival.lineX - ideal);
    const linePenalty = clamp(lineError * 1.45, 0, 7.2);
    const draft = ahead && ahead.gap > 5 && ahead.gap < 19 && Math.abs(ahead.lineX - rival.lineX) < 1.35
      ? 3.1 + level.reaction * 1.2
      : 0;
    const boostPace = rival.boosting ? 15.5 * profile.boost : 0;
    const fairFieldCompression = clamp(gapToPlayer / 420, -.018, .018) * racePace;
    const launchLimit = lerp(
      72,
      physicalTop,
      clamp(state.elapsed / (3.1 / profile.launch), 0, 1),
    );
    const cornerLimit = racePace - cornerLoss - linePenalty;
    rival.targetSpeed = clamp(
      Math.min(
        launchLimit,
        cornerLimit + boostPace + draft + fairFieldCompression,
      ),
      62,
      physicalTop,
    );
    rival.speed = lerp(
      rival.speed,
      rival.targetSpeed,
      1 - Math.exp(-dt * (1.02 + level.reaction * .42 + profile.launch * .2)),
    );
    if (rival.boosting) rival.nitro = Math.max(0, rival.nitro - dt * 23);
    else rival.nitro = Math.min(100, rival.nitro + dt * 1.9);
    rival.progress += rival.speed / 3.6 * dt;

    const lateralAcceleration = (rival.targetLine - rival.lineX)
      * (2.25 + level.reaction * .82)
      - rival.lateralVelocity * (2.55 + level.consistency);
    rival.lateralVelocity += lateralAcceleration * dt;
    const maxLateral = 5.2 + level.reaction * 1.7;
    rival.lateralVelocity = clamp(rival.lateralVelocity, -maxLateral, maxLateral);
    rival.lineX = clamp(
      rival.lineX + rival.lateralVelocity * dt,
      -TRACK_HALF_WIDTH + .38,
      TRACK_HALF_WIDTH - .38,
    );

    // Rivals obey the same buoy collision rules as the player. Better AI avoids
    // most impacts, while a late decision or forced line still costs momentum.
    rival.obstacleCooldown = Math.max(0, rival.obstacleCooldown - dt);
    const buoyHit = rival.obstacleCooldown <= 0 && trackObjects.find((object) => (
      object.userData.type === "buoy"
      && Math.abs(object.userData.courseDistance - rival.progress) < .72
      && Math.abs(object.userData.lane - rival.lineX) < .82
    ));
    if (buoyHit) {
      const escapeDirection = Math.sign(
        rival.lineX - buoyHit.userData.lane || (index % 2 ? 1 : -1),
      );
      rival.speed *= .76;
      rival.lateralVelocity += escapeDirection * 2.25;
      rival.targetLine = clamp(
        rival.lineX + escapeDirection * 2.1,
        -TRACK_HALF_WIDTH + .5,
        TRACK_HALF_WIDTH - .5,
      );
      rival.obstacleCooldown = 1.3;
      rival.obstacleHits += 1;
      rival.behavior = "recovering";
    }

    const relativeMetres = rival.progress - state.distance;
    const targetZ = -relativeMetres * WORLD_SCALE;
    rival.group.visible = targetZ > -145 && targetZ < 24;
    rival.label.visible = rival.group.visible && targetZ < -7 && targetZ > -95;
    rival.group.position.z = lerp(rival.group.position.z, targetZ, 1 - Math.exp(-dt * 9));
    const curveOffset = courseCenter(rival.progress) - playerCenter;
    const targetWorldX = rival.lineX + curveOffset;
    rival.group.position.x = lerp(
      rival.group.position.x,
      targetWorldX,
      1 - Math.exp(-dt * (7.5 + level.reaction)),
    );
    const waterBob = waterSample(rival.lineX, rival.progress, state.elapsed + rival.phase * .12);
    rival.group.position.y = .14 + waterBob * .78;
    const relativeHeading = Math.atan(courseHeading(rival.progress))
      - Math.atan(courseHeading(state.distance));
    const steeringYaw = clamp(rival.lateralVelocity * -.035, -.12, .12);
    rival.group.rotation.y = lerp(
      rival.group.rotation.y,
      relativeHeading + steeringYaw,
      1 - Math.exp(-dt * 5.5),
    );
    rival.group.rotation.z = lerp(
      rival.group.rotation.z,
      clamp(-rival.lateralVelocity * .045 - turnAhead * .08, -.32, .32),
      1 - Math.exp(-dt * 5),
    );
    rival.group.rotation.x = lerp(
      rival.group.rotation.x,
      -waterSlope(rival.lineX, rival.progress) * 1.6,
      1 - Math.exp(-dt * 6),
    );

    if (rival.group.userData.rider) {
      rival.group.userData.rider.rotation.z = lerp(
        rival.group.userData.rider.rotation.z,
        clamp(-rival.lateralVelocity * .032 - turnAhead * .09, -.2, .2),
        1 - Math.exp(-dt * 7),
      );
      rival.group.userData.rider.rotation.x = -.22 - (rival.boosting ? .055 : 0);
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
      const impact = clamp(Math.abs(state.speed - rival.speed) / 45 + .35, .35, 1);
      state.speed *= 1 - impact * .08;
      rival.speed *= 1 - impact * .05;
      state.vx += direction * (1.5 + impact * 1.15);
      rival.lateralVelocity -= direction * (1.2 + impact);
      state.shake = Math.max(state.shake, .58);
      state.impact = Math.max(state.impact, .72);
      rival.collisionCooldown = 1.2;
      rival.targetLine = clamp(
        rival.targetLine - direction * 1.7,
        -TRACK_HALF_WIDTH + .5,
        TRACK_HALF_WIDTH - .5,
      );
      playImpact(impact * .65);
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
  const speedRatio = clamp(state.speed / mode.max, 0, 1.1);
  state.curve = courseTurn(state.distance + 25);
  state.surfaceChop = clamp(
    Math.abs(waterSlope(state.x, state.distance)) * 7.5 + speedRatio * .11,
    0,
    1,
  );
  state.steer = lerp(
    state.steer,
    input,
    1 - Math.exp(-dt * (6.4 + profile.handling * 2.9)),
  );

  const requestedGrip = clamp(
    profile.stability
      - Math.abs(state.steer) * speedRatio * .17
      - state.surfaceChop * .13
      - Math.abs(state.vx) * .015,
    .42,
    1,
  );
  state.grip = lerp(
    state.grip,
    state.airborne ? .12 : requestedGrip,
    1 - Math.exp(-dt * (state.airborne ? 5 : 2.8)),
  );
  const steeringForce = state.steer
    * (6.8 + speedRatio * 11.8)
    * profile.handling
    * (.38 + state.grip * .62);
  const centrifugalForce = -state.curve * speedRatio * speedRatio * 8.4;
  state.vx += (steeringForce + centrifugalForce) * dt;
  const lateralDamping = 2.8 + state.grip * 3.7 + (state.keys.brake ? 1.8 : 0);
  state.vx *= Math.exp(-dt * lateralDamping);
  state.x += state.vx * dt;
  if (Math.abs(state.x) > TRACK_HALF_WIDTH) {
    state.x = clamp(state.x, -TRACK_HALF_WIDTH, TRACK_HALF_WIDTH);
    state.vx *= -.16;
    state.speed *= 1 - dt * (.48 / profile.stability);
    state.grip = Math.max(.38, state.grip - dt * .45);
  }

  const boosting = state.keys.nitro && state.nitro > .2;
  const draftRival = rivals
    .map((rival) => ({
      gap: rival.progress - state.distance,
      lateral: Math.abs(rival.lineX - state.x),
    }))
    .filter((entry) => entry.gap > 5 && entry.gap < 19 && entry.lateral < 1.35)
    .sort((a, b) => a.gap - b.gap)[0];
  state.slipstream = lerp(
    state.slipstream,
    draftRival ? 1 : 0,
    1 - Math.exp(-dt * (draftRival ? 2.2 : 1.4)),
  );

  const naturalTop = mode.max * profile.topSpeed;
  const boostTop = naturalTop + 13.5 * profile.boost;
  const cornerDrag = Math.abs(state.curve) * speedRatio * speedRatio * 10.5
    + Math.abs(state.vx) * 1.65
    + Math.abs(state.steer) * speedRatio * 4.2
    + state.surfaceChop * 2.1;
  const requestedSpeed = state.keys.brake
    ? 58 + (1 - Math.abs(state.steer)) * 8
    : mode.cruise
      + state.slipstream * 4.2
      + (boosting ? boostTop - mode.cruise : 0);
  const targetSpeed = clamp(
    requestedSpeed - cornerDrag,
    state.keys.brake ? 52 : 72,
    boosting ? boostTop : naturalTop,
  );
  const acceleration = targetSpeed > state.speed
    ? (.74 + profile.acceleration * .52) * mode.acceleration
    : state.keys.brake
      ? 4.1
      : 2.15;
  state.speed = lerp(state.speed, targetSpeed, 1 - Math.exp(-dt * acceleration));
  state.throttleLoad = lerp(
    state.throttleLoad,
    clamp((targetSpeed - state.speed) / 32, 0, 1) + (boosting ? .42 : 0),
    1 - Math.exp(-dt * 4),
  );
  if (boosting) state.nitro = Math.max(0, state.nitro - dt * (18 / profile.boost));
  else state.nitro = Math.min(100, state.nitro + dt * (1.72 + state.slipstream * .5));
  state.topSpeed = Math.max(state.topSpeed, state.speed);
  state.distance += state.speed / 3.6 * dt;
  state.elapsed += dt;

  const waveHeight = .17 + waterSample(state.x, state.distance) * .92;
  const slope = waterSlope(state.x, state.distance);
  state.landingCooldown = Math.max(0, state.landingCooldown - dt);
  if (state.airborne) {
    state.verticalVelocity -= GRAVITY * dt;
    state.vertical += state.verticalVelocity * dt;
    if (state.vertical <= waveHeight && state.verticalVelocity < 0) {
      const landingSpeed = Math.abs(state.verticalVelocity);
      state.vertical = waveHeight;
      state.airborne = false;
      state.verticalVelocity = Math.max(-.55, state.verticalVelocity * -.12);
      state.speed *= 1 - clamp((landingSpeed - 2.2) * .018, 0, .13) / profile.stability;
      state.shake = Math.max(state.shake, clamp(landingSpeed * .12, .25, .95));
      state.splash = 1.25;
      state.landingCooldown = .7;
      emitSpray(state.x, .05, .15, clamp(landingSpeed * .22, .8, 1.8), state.steer);
      ui.cinematicFx.classList.remove("splash");
      void ui.cinematicFx.offsetWidth;
      ui.cinematicFx.classList.add("splash");
      if (landingSpeed > 4.8) {
        playImpact(clamp(landingSpeed / 8, .4, .9));
        showCallout("HARD LANDING · MOMENTUM LOST", "#ffd08a");
      }
    }
  } else {
    const spring = (waveHeight - state.vertical) * (32 + profile.stability * 8);
    const damping = state.verticalVelocity * (6.2 + profile.stability * 1.3);
    state.verticalVelocity += (spring - damping) * dt;
    state.vertical += state.verticalVelocity * dt;
    const launchWave = Math.max(0, slope) * speedRatio;
    if (
      state.landingCooldown <= 0
      && state.speed > mode.cruise * 1.04
      && launchWave > .105
    ) {
      state.airborne = true;
      state.verticalVelocity = 1.45 + launchWave * 4.2;
    }
  }

  const lateralAcceleration = Math.abs(steeringForce + centrifugalForce);
  state.gForce = clamp(
    .45 + lateralAcceleration / GRAVITY * 1.55 + state.surfaceChop * speedRatio * .7,
    0,
    6.8,
  );
  state.yaw = lerp(
    state.yaw,
    state.steer * (.075 + speedRatio * .075) - state.vx * .018,
    1 - Math.exp(-dt * 4.8),
  );

  player.position.x = lerp(player.position.x, state.x, 1 - Math.exp(-dt * 12));
  player.position.y = state.vertical;
  player.rotation.z = lerp(
    player.rotation.z,
    -state.steer * .22 - state.vx * .036 - state.curve * .075,
    1 - Math.exp(-dt * 7),
  );
  player.rotation.x = lerp(
    player.rotation.x,
    -slope * 1.7 - state.verticalVelocity * .018 + (state.airborne ? -.045 : 0),
    1 - Math.exp(-dt * 6),
  );
  player.rotation.y = lerp(player.rotation.y, state.yaw, 1 - Math.exp(-dt * 6));

  if (player.userData.rider) {
    player.userData.rider.rotation.z = lerp(
      player.userData.rider.rotation.z,
      -state.steer * .18 - state.curve * .08,
      1 - Math.exp(-dt * 8),
    );
    player.userData.rider.rotation.x = lerp(
      player.userData.rider.rotation.x,
      -.22 - (boosting ? .065 : 0) + (state.keys.brake ? .055 : 0),
      1 - Math.exp(-dt * 6),
    );
    player.userData.rider.position.y = 1.02 + state.verticalVelocity * .006;
  }
  if (player.userData.helmet) {
    player.userData.helmet.rotation.y = lerp(
      player.userData.helmet.rotation.y,
      state.steer * .08,
      1 - Math.exp(-dt * 5),
    );
  }
  if (player.userData.contactShadow) {
    player.userData.contactShadow.material.opacity = clamp(.2 - Math.max(0, state.vertical - waveHeight) * .055, .02, .2);
    const shadowScale = 1 + Math.max(0, state.vertical - waveHeight) * .08;
    player.userData.contactShadow.scale.set(.72 * shadowScale, 2.65 * shadowScale, 1);
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
  updateAudio();
  return state.speed * .092;
}

function updateCamera(dt, boosting) {
  state.shake = Math.max(0, state.shake - dt * 1.9);
  state.impact = Math.max(0, state.impact - dt * 2.7);
  state.splash = Math.max(0, state.splash - dt);
  const shakeX = (Math.random() - .5) * state.shake * .42;
  const shakeY = (Math.random() - .5) * state.shake * .24;
  const lookAheadOffset = courseCenter(state.distance + 46) - courseCenter(state.distance);
  const desired = new THREE.Vector3(
    state.x * .34 - state.steer * .58 - lookAheadOffset * .05 + shakeX,
    3.7 + Math.sin(state.elapsed * 2.5) * .045 + shakeY + Math.max(0, state.vertical - .17) * .12,
    9.45 + (boosting ? .85 : 0),
  );
  camera.position.lerp(desired, 1 - Math.exp(-dt * 4.2));
  const target = new THREE.Vector3(
    state.x * .48 + lookAheadOffset * .78 + shakeX * .3,
    .68 + shakeY * .2,
    -13.4,
  );
  camera.lookAt(target);
  camera.rotation.z += state.steer * -.009 + state.curve * -.006 + shakeX * .006;
  camera.fov = lerp(camera.fov, boosting ? 72 : 64, 1 - Math.exp(-dt * 3));
  camera.updateProjectionMatrix();
  const boostVisual = boosting ? clamp((state.speed - config[state.mode].cruise) / 38, .18, 1) : 0;
  document.documentElement.style.setProperty("--boost", boostVisual.toFixed(3));
  document.documentElement.style.setProperty("--impact", state.impact.toFixed(3));
  if (bloomPass) {
    bloomPass.strength = .27 + boostVisual * .13 + state.impact * .04;
  }
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
  state.throttleLoad = 0;
  document.documentElement.style.setProperty("--boost", "0");
  updateAudio();
}

function render() {
  const rawDt = Math.min(clock.getDelta(), .05);
  animFrame += 1;
  if (state.phase !== "racing" && animFrame % 3 !== 0) return;
  if (!scene || state.paused) {
    if (renderer && scene && camera) {
      if (composer && state.phase === "racing") composer.render();
      else renderer.render(scene, camera);
    }
    return;
  }
  oceanUniforms.uTime.value += rawDt;

  if (state.phase === "racing") {
    const worldSpeed = updatePlayer(rawDt);
    updateTrack();
    updateRivals(rawDt);
    updateWake(rawDt);
    updateCamera(rawDt, state.keys.nitro && state.nitro > 0);
    sceneryRoot.position.z = (sceneryRoot.position.z + worldSpeed * rawDt * .13) % 57;
    sceneryRoot.position.x = lerp(
      sceneryRoot.position.x,
      -courseCenter(state.distance) * .14,
      1 - Math.exp(-rawDt * .35),
    );
    sceneryRoot.rotation.y = lerp(
      sceneryRoot.rotation.y,
      -Math.atan(courseHeading(state.distance)) * .08,
      1 - Math.exp(-rawDt * .45),
    );
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
    updateAudio();
  }

  if (calloutTimer > 0) {
    calloutTimer -= rawDt;
    if (calloutTimer <= 0) ui.callout.classList.remove("show");
  }
  if (positionFxTimer > 0) {
    positionFxTimer -= rawDt;
    if (positionFxTimer <= 0) ui.positionPanel.classList.remove("position-gained", "position-lost");
  }
  if (composer && state.phase === "racing") composer.render();
  else renderer.render(scene, camera);
}

async function fakeLoad() {
  ui.start.classList.add("hidden");
  ui.loading.classList.remove("hidden");
  for (const progress of [0, 28, 57, 82, 100]) {
    ui.loadingBar.style.width = `${progress}%`;
    ui.loadingValue.textContent = `${progress}%`;
    await new Promise((resolve) => setTimeout(resolve, progress < 82 ? 28 : 42));
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
  initializeAudio();
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
  if (audioEngine) {
    audioEngine.master.gain.setTargetAtTime(
      value || state.muted ? 0 : .58,
      audioEngine.context.currentTime,
      .08,
    );
  }
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
  state.speed = 0;
  state.throttleLoad = 0;
  updateAudio();
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
  if (composer) composer.setSize(innerWidth, innerHeight);
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
ui.sound.addEventListener("click", () => {
  state.muted = !state.muted;
  ui.sound.setAttribute("aria-pressed", String(state.muted));
  ui.sound.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
  ui.sound.textContent = state.muted ? "♩" : "♫";
  initializeAudio();
  if (audioEngine) {
    audioEngine.master.gain.setTargetAtTime(
      state.muted ? 0 : .58,
      audioEngine.context.currentTime,
      .05,
    );
  }
});
$("#fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch {
    // Fullscreen can be unavailable inside an embedded preview.
  }
});

if (!supportsWebGL()) ui.webglNotice.hidden = false;
window.__WGP_DEBUG__ = {
  snapshot: () => ({
    phase: state.phase,
    mode: state.mode,
    difficulty: state.difficulty,
    distance: state.distance,
    elapsed: state.elapsed,
    speed: state.speed,
    position: state.position,
    nitro: state.nitro,
    collisions: state.collisions,
    grip: state.grip,
    gForce: state.gForce,
    x: state.x,
    airborne: state.airborne,
    rivals: rivals.map((rival) => ({
      name: rival.profile.name,
      progress: rival.progress,
      speed: rival.speed,
      lineX: rival.lineX,
      behavior: rival.behavior,
      boosting: rival.boosting,
      obstacleHits: rival.obstacleHits,
    })),
  }),
};
if (location.hostname === "wgp.local") {
  window.__WGP_DEBUG__.resetScenario = ({
    mode = "sprint",
    difficulty = "pro",
    rider = "nova",
    distance = 1000,
  } = {}) => {
    state.mode = mode;
    state.difficulty = difficulty;
    state.rider = rider;
    state.courseLength = distance;
    resetRace();
    state.phase = "racing";
    return window.__WGP_DEBUG__.snapshot();
  };
  window.__WGP_DEBUG__.advanceRace = (seconds, autopilot = false) => {
    const dt = 1 / 60;
    const steps = Math.ceil(seconds / dt);
    for (let step = 0; step < steps && state.phase === "racing"; step += 1) {
      if (autopilot) {
        const idealTarget = racingLine(state.distance + 8, riderProfiles[state.rider].handling);
        let target = idealTarget;
        const obstacles = trackObjects
          .filter((object) => (
            object.userData.type === "buoy"
            && object.userData.courseDistance > state.distance + 5
            && object.userData.courseDistance < state.distance + 42
          ));
        if (obstacles.length) {
          const candidates = [-6.2, -3.1, 0, 3.1, 6.2];
          target = candidates
            .map((candidate) => {
              const lineCost = Math.abs(candidate - idealTarget) * .42;
              const obstacleCost = obstacles.reduce((cost, object) => {
                const lateral = Math.abs(candidate - object.userData.lane);
                const proximity = 1 - clamp(
                  (object.userData.courseDistance - state.distance - 5) / 37,
                  0,
                  1,
                );
                return cost + Math.max(0, 2.05 - lateral) * proximity * 12;
              }, 0);
              return { candidate, cost: lineCost + obstacleCost };
            })
            .sort((a, b) => a.cost - b.cost)[0].candidate;
        }
        const error = target - state.x - state.vx * .22;
        state.keys.left = error < -.16;
        state.keys.right = error > .16;
        const severity = Math.abs(courseTurn(state.distance + 34));
        state.keys.brake = severity > .7 && state.speed > config[state.mode].cruise * .9;
        state.keys.nitro = severity < .31 && state.nitro > 4;
      }
      updatePlayer(dt);
      updateTrack();
      updateRivals(dt);
      updateWake(dt);
      updateHud(dt);
      if (state.distance >= state.courseLength) finishRace();
    }
    return window.__WGP_DEBUG__.snapshot();
  };
}
document.documentElement.dataset.gameReady = "true";
