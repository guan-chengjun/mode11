/* ============================================================
 * 海盗船 3D 交互拆解 —— 主入口 main.js
 * 技术栈：Three.js r160（CDN importmap）+ OrbitControls + GLTFLoader
 * 架构：在线 GLB 尝试加载 → 失败自动降级到内置程序化海盗船
 * ============================================================ */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------
 * 1. 在线模型配置（加载失败会自动兜底，可自行替换为你的 GLB）
 *    要求：模型所在服务器允许跨域（CORS），单文件 .glb 最佳。
 * ---------------------------------------------------------- */
const MODEL_URLS = [
  // 地址一：Khronos 官方 glTF 示例资产新仓库（jsDelivr CDN，自带 CORS，已实测可用）
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/BoomBox/glTF-Binary/BoomBox.glb',
  // 地址二：Khronos 旧仓库（默认分支为 master），作为备用镜像
  'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/BoomBox/glTF-Binary/BoomBox.glb',
];
const MODEL_TIMEOUT = 6000; // 单个地址超时时间(ms)

/* ------------------------------------------------------------
 * 2. 十大部件知识库（id 同时用于程序化模型的 group.userData.partId）
 * ---------------------------------------------------------- */
const PART_INFO = {
  figurehead: {
    name: '船首像 Figurehead',
    structure: '安装在船首最前端的木雕装饰，通常雕刻成女神、海怪或猛兽形态，通过榫接固定在船首柱顶端。',
    function: '兼具标识与象征意义：彰显船名与船长身份，船员相信它能镇住海神、趋吉避凶，同时也能在靠岸碰撞时缓冲保护船首。',
  },
  mast: {
    name: '船桅 Mast',
    structure: '由整根巨木或多段松木拼接而成的垂直桅杆，分前桅、主桅、后桅，底部贯穿甲板插入桅座，四周以桅牵索（支索）拉紧固定。',
    function: '全船的“骨架支柱”，用来悬挂帆桁与风帆，把风对帆的推力传导到船体，是风帆动力的承重核心。',
  },
  sail: {
    name: '帆 Sail',
    structure: '由厚重帆布缝制的大面积织物，用绳索系挂在横向帆桁上；大型帆船每根桅杆挂 3–4 面方帆，另配三角帆与顶帆。',
    function: '捕捉风力并转化为推进力。帆面受风产生压强差推动船只前进，通过收帆、转帆可控制航速与航向，本项目中模拟了帆面随风鼓荡。',
  },
  rigging: {
    name: '索具 Rigging',
    structure: '由数百根麻缆组成的绳索网络，分“固定索具”（侧支索、前后支索，用于拉紧桅杆）与“活动索具”（升降索、转桁索，用于操控帆桁）。',
    function: '像肌肉与筋腱一样维持桅杆直立、调节帆桁角度，并供水手攀爬至桅顶作业，是帆船操控系统的神经脉络。',
  },
  gunport: {
    name: '炮门 Gunport',
    structure: '在船舷两侧开出的方形开口，平时用可向上翻开的炮门盖封闭，内部架设炮架与铸铁加农炮，沿两舷分层排列。',
    function: '战时打开炮门推出火炮进行舷侧齐射，平时关闭炮门防止海浪灌入；这种设计让重型火炮能布置在较低层甲板，降低重心并保持稳性。',
  },
  deck: {
    name: '甲板 Deck',
    structure: '铺设在船体横梁之上的厚木板层，板间以麻丝与沥青捻缝防水，四周设舷墙（防浪挡板），并开有通往底舱的舱口。',
    function: '船员作业、操舵与作战的主要平台，同时把船体上部封闭成坚固的“箱形结构”，显著增强船体的整体抗扭强度。',
  },
  cabin: {
    name: '船舱 / 船壳 Cabin & Hull',
    structure: '甲板以下由弧形船壳板围成的内部空间，以横隔舱壁分隔成货舱、弹药库、淡水舱与军官住舱；船尾高架的艉楼为船长室。',
    function: '船壳提供浮力并抵御海浪冲击，隔舱在局部破损进水时限制蔓延（水密隔舱思想），内部舱室则承担载货、住人与储存补给的功能。',
  },
  rudder: {
    name: '船舵 Rudder',
    structure: '铰接在船尾柱上的垂直木板（舵叶），通过舵杆与甲板上的船舵轮（舵轮）以绳索联动，转动舵轮即可偏转舵叶。',
    function: '控制航向的核心部件：偏转的舵叶在水流中产生侧向力矩，使船头左右转向；本项目中舵轮与舵叶会联动转动。',
  },
  anchor: {
    name: '锚 Anchor',
    structure: '带锚环、锚杆与两只弯钩锚爪的铸铁重件，用粗大的锚缆（锚链）经船首锚机收放，停泊时挂在船首两侧。',
    function: '停泊时抛入水底，锚爪抓入泥沙、锚链卧底产生摩擦力，把船牢牢固定防止漂流；紧急情况下也可辅助减速或掉头。',
  },
  keel: {
    name: '龙骨 Keel',
    structure: '沿船底中线从头到尾贯通的一根最粗壮的主梁，横向肋骨（隔舱板）全部架设在龙骨之上，外壳板再钉接在肋骨外侧。',
    function: '整艘船的“脊椎”，承受总纵弯曲强度并把全船结构连成一体；突出的底龙骨同时提供侧向抗漂力，抑制船只迎风横移（横漂）。',
  },
};
const PART_ORDER = ['figurehead', 'mast', 'sail', 'rigging', 'gunport', 'deck', 'cabin', 'rudder', 'anchor', 'keel'];

/* ------------------------------------------------------------
 * 3. 全局状态
 * ---------------------------------------------------------- */
let scene, camera, renderer, controls, raycaster, pointer;
let shipRoot = null;          // 当前船模型根节点（GLB 或程序化船）
let seaMesh = null;
let mixer = null;             // GLB 自带动画（若有）
let selectedPartId = null;
let hoveredPartId = null;
let rudderGroupRef = null;       // 程序化船的舵组（GLB 无此引用则不播舵动画）

const state = {
  playing: true,
  speed: 1.0,
  xray: false,
  wireframe: false,
  animTime: 0,
};

// 可交互对象缓存 & 材质备份
const clickableMeshes = [];          // 所有可被射线拾取的 Mesh/Line
const materialBackup = new Map();    // mesh -> { material, baseEmissive, baseEmissiveIntensity, transparent, opacity }
const animatedSails = [];            // { mesh, basePositions, amp, phase }
const highlightColor = new THREE.Color(0xffb020);

/* ============================================================
 * 4. 场景初始化
 * ============================================================ */
function initScene() {
  const app = document.getElementById('app');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9fc8e8);
  scene.fog = new THREE.Fog(0x9fc8e8, 60, 180);

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(22, 12, 26);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  // 轨道控制器：左键旋转 / 滚轮缩放 / 右键平移
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 90;
  controls.maxPolarAngle = Math.PI * 0.52;
  controls.target.set(0, 2.5, 0);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  setupLights();
  setupSea();

  window.addEventListener('resize', onResize);
}

function setupLights() {
  // 环境光：均匀补光，避免阴影面死黑
  const ambient = new THREE.AmbientLight(0xbcd6f0, 0.65);
  scene.add(ambient);

  // 半球光：天空蓝 / 海面青，让色彩更自然
  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x2a5066, 0.45);
  scene.add(hemi);

  // 方向光：模拟太阳，投射阴影
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.0);
  sun.position.set(28, 38, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 120;
  sun.shadow.camera.left = -32;
  sun.shadow.camera.right = 32;
  sun.shadow.camera.top = 32;
  sun.shadow.camera.bottom = -32;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
}

function setupSea() {
  const geo = new THREE.PlaneGeometry(400, 400, 80, 80);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x1d6f8e,
    roughness: 0.35,
    metalness: 0.25,
    transparent: true,
    opacity: 0.92,
  });
  seaMesh = new THREE.Mesh(geo, mat);
  seaMesh.receiveShadow = true;
  seaMesh.position.y = -2.4;
  scene.add(seaMesh);
}

/* ============================================================
 * 5. 程序化海盗船（兜底模型，含完整十大部件）
 * ============================================================ */
function makeMat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.08,
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
  });
}

// 船体几何：以 BoxGeometry 为基础，把两端收成船首 / 船尾弧线
function buildHullGeometry() {
  const L = 22, H = 5.2, W = 5.4;
  const geo = new THREE.BoxGeometry(L, H, W, 24, 6, 8);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const t = Math.abs(x) / (L / 2);           // 0 船中 → 1 船端
    const taper = 1 - 0.78 * Math.pow(t, 2.2); // 端部收窄
    z *= taper;
    // 底部收窄，形成 V 形船底
    const bottomFactor = (y < 0) ? 1 - 0.35 * (-y / (H / 2)) : 1;
    z *= bottomFactor;
    // 船首略微上翘
    if (x > 0 && y < 0) y += 1.1 * Math.pow(t, 2.4) * (Math.abs(y) / (H / 2));
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildProceduralShip() {
  const ship = new THREE.Group();
  ship.name = 'ProceduralPirateShip';

  const woodDark = makeMat(0x5a3a22);
  const wood = makeMat(0x8a5a33);
  const woodLight = makeMat(0xa9784a);
  const cloth = makeMat(0xf2e6c8, { side: THREE.DoubleSide, roughness: 0.95 });
  const iron = makeMat(0x3a3f45, { metalness: 0.7, roughness: 0.4 });
  const black = makeMat(0x14161a);
  const goldMat = makeMat(0xd9a83c, { metalness: 0.6, roughness: 0.35 });
  const ropeMat = makeMat(0x6b5136, { roughness: 1 });

  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (rt, rb, h, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  /* ---------- 7-1 船舱 / 船壳 ---------- */
  const gCabin = new THREE.Group();
  gCabin.userData.partId = 'cabin';
  const hull = new THREE.Mesh(buildHullGeometry(), woodDark.clone());
  hull.material.side = THREE.DoubleSide;
  hull.position.y = 0.4;
  gCabin.add(hull);
  // 艉楼（船长室）
  const stern = box(3.4, 2.2, 3.6, wood);
  stern.position.set(-8.6, 3.1, 0);
  gCabin.add(stern);
  for (let z of [-1.1, 0, 1.1]) {
    const win = box(0.15, 0.7, 0.7, goldMat);
    win.position.set(-10.32, 3.4, z);
    gCabin.add(win);
  }
  ship.add(gCabin);

  /* ---------- 7-2 龙骨（含内部肋骨 / 隔舱，透视模式可见） ---------- */
  const gKeel = new THREE.Group();
  gKeel.userData.partId = 'keel';
  const keel = box(19.5, 0.55, 0.55, woodDark);
  keel.position.set(0, -2.35, 0);
  gKeel.add(keel);
  // 横向隔舱板（肋骨）——透视模式重点展示
  for (let x = -7.5; x <= 7.5; x += 2.5) {
    const rib = box(0.28, 3.4, 4.0, woodLight);
    rib.position.set(x, -0.6, 0);
    gKeel.add(rib);
  }
  ship.add(gKeel);

  /* ---------- 7-3 甲板 ---------- */
  const gDeck = new THREE.Group();
  gDeck.userData.partId = 'deck';
  const deck = box(19, 0.35, 4.7, woodLight);
  deck.position.set(-0.3, 2.95, 0);
  gDeck.add(deck);
  // 甲板木板条纹
  for (let z = -2; z <= 2; z += 0.66) {
    const stripe = box(18.6, 0.06, 0.05, woodDark);
    stripe.position.set(-0.3, 3.16, z);
    gDeck.add(stripe);
  }
  // 左右舷墙
  for (let s of [-1, 1]) {
    const wall = box(18.4, 1.0, 0.22, wood);
    wall.position.set(-0.3, 3.7, s * 2.45);
    gDeck.add(wall);
  }
  // 货舱口
  const hatch = box(2.4, 0.12, 1.6, black);
  hatch.position.set(0, 3.2, 0);
  gDeck.add(hatch);
  ship.add(gDeck);

  /* ---------- 7-4 炮门（两舷各 5 门） ---------- */
  const gGun = new THREE.Group();
  gGun.userData.partId = 'gunport';
  for (let s of [-1, 1]) {
    for (let x = -6; x <= 6; x += 3) {
      const port = box(1.0, 1.05, 0.12, black);
      port.position.set(x, 1.45, s * 2.5);
      gGun.add(port);
      const lid = box(1.05, 0.9, 0.1, wood);
      lid.position.set(x, 2.15, s * 2.52);
      lid.rotation.x = -0.5;
      gGun.add(lid);
      const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 12), iron);
      muzzle.rotation.x = Math.PI / 2;
      muzzle.position.set(x, 1.5, s * 2.7);
      gGun.add(muzzle);
    }
  }
  ship.add(gGun);

  /* ---------- 7-5 船桅（前 / 主 / 后）+ 帆桁 ---------- */
  const gMast = new THREE.Group();
  gMast.userData.partId = 'mast';
  const mastXs = [-5.5, 0, 5.5];
  const mastHeights = [11, 13.5, 10];
  mastXs.forEach((mx, i) => {
    const h = mastHeights[i];
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, h, 12), wood);
    mast.position.set(mx, 3 + h / 2, 0);
    gMast.add(mast);
    // 瞭望台
    const crow = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.18, 14), woodDark);
    crow.position.set(mx, 3 + h - 2.2, 0);
    gMast.add(crow);
    // 两道横帆桁
    for (let k = 0; k < 2; k++) {
      const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 5.6 - k, 10), woodLight);
      yard.rotation.x = Math.PI / 2;
      yard.position.set(mx, 3 + h - (k ? 5.6 : 3.2), 0);
      gMast.add(yard);
    }
  });
  // 船首斜桅
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 5.5, 10), wood);
  bowsprit.rotation.z = -Math.PI / 2 + 0.25;
  bowsprit.position.set(12.4, 3.4, 0);
  gMast.add(bowsprit);
  ship.add(gMast);

  /* ---------- 7-6 帆（可随风摆动，顶点动画） ---------- */
  const gSail = new THREE.Group();
  gSail.userData.partId = 'sail';
  mastXs.forEach((mx, i) => {
    const h = mastHeights[i];
    for (let k = 0; k < 2; k++) {
      const w = 5.2 - k, sh = 2.6;
      const sailGeo = new THREE.PlaneGeometry(w, sh, 14, 8);
      const sail = new THREE.Mesh(sailGeo, cloth.clone());
      const yYard = 3 + h - (k ? 5.6 : 3.2);
      sail.position.set(mx, yYard - sh / 2 - 0.15, 0);
      gSail.add(sail);
      animatedSails.push({
        mesh: sail,
        base: sailGeo.attributes.position.array.slice(),
        amp: 0.22 + 0.06 * i,
        phase: i * 1.3 + k,
      });
    }
  });
  // 船首三角帆
  const jibGeo = new THREE.BufferGeometry();
  jibGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    8.2, 11.5, 0,   13.6, 4.6, 0,   8.2, 6.2, 0,
  ], 3));
  jibGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 0, 0, 0], 2));
  jibGeo.computeVertexNormals();
  const jib = new THREE.Mesh(jibGeo, cloth.clone());
  gSail.add(jib);
  // 主桅骷髅旗
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), makeFlagMaterial());
  flag.position.set(0.85, 17.4, 0);
  gSail.add(flag);
  ship.add(gSail);

  /* ---------- 7-7 索具（Line 绳索网络） ---------- */
  const gRig = new THREE.Group();
  gRig.userData.partId = 'rigging';
  const ropePts = [];
  const topOf = (i) => new THREE.Vector3(mastXs[i], 3 + mastHeights[i] - 0.4, 0);
  // 桅杆侧支索 → 舷边
  mastXs.forEach((mx, i) => {
    for (let s of [-1, 1]) {
      ropePts.push(topOf(i), new THREE.Vector3(mx, 3.1, s * 2.4));
      ropePts.push(new THREE.Vector3(mx, 3 + mastHeights[i] * 0.55, 0), new THREE.Vector3(mx + 1.6, 3.1, s * 2.4));
    }
  });
  // 桅间前后支索
  ropePts.push(topOf(0), topOf(1), topOf(1), topOf(2));
  // 前桅顶 → 船首斜桅端
  ropePts.push(topOf(2), new THREE.Vector3(14.6, 4.7, 0));
  // 帆桁吊索
  mastXs.forEach((mx, i) => {
    ropePts.push(new THREE.Vector3(mx, 3 + mastHeights[i] - 3.2, 2.6), new THREE.Vector3(mx, 3 + mastHeights[i] - 3.2, -2.6));
  });
  const rigGeo = new THREE.BufferGeometry().setFromPoints(ropePts);
  const rigLine = new THREE.LineSegments(rigGeo, new THREE.LineBasicMaterial({ color: 0x4a3722 }));
  gRig.add(rigLine);
  ship.add(gRig);

  /* ---------- 7-8 船舵 + 舵轮（联动转动） ---------- */
  const gRud = new THREE.Group();
  gRud.userData.partId = 'rudder';
  const blade = box(0.3, 2.6, 1.5, woodDark);
  blade.position.set(-10.9, 0.4, 0);
  gRud.add(blade);
  const rudPost = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.4, 10), iron);
  rudPost.position.set(-10.85, 1.6, 0);
  gRud.add(rudPost);
  // 甲板舵轮
  const wheel = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 10, 24), woodLight);
  wheel.add(ring);
  for (let a = 0; a < 8; a++) {
    const spoke = box(1.45, 0.07, 0.07, woodLight);
    spoke.rotation.z = (a / 8) * Math.PI * 2;
    wheel.add(spoke);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), woodDark);
    knob.position.set(Math.cos(a / 8 * Math.PI * 2) * 0.75, Math.sin(a / 8 * Math.PI * 2) * 0.75, 0);
    wheel.add(knob);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 10), iron);
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  wheel.position.set(-7.2, 4.2, 0);
  gRud.add(wheel);
  gRud.userData.wheel = wheel;
  gRud.userData.blade = blade;
  rudderGroupRef = gRud;
  ship.add(gRud);

  /* ---------- 7-9 锚（船首两侧） ---------- */
  const gAnchor = new THREE.Group();
  gAnchor.userData.partId = 'anchor';
  for (let s of [-1, 1]) {
    const anchor = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 8), iron);
    anchor.add(shank);
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), iron);
    ringA.position.y = 0.95;
    anchor.add(ringA);
    const cross = box(1.3, 0.12, 0.12, iron);
    cross.position.y = -0.75;
    anchor.add(cross);
    for (let cs of [-1, 1]) {
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), iron);
      fluke.position.set(cs * 0.62, -0.95, 0);
      fluke.rotation.z = cs * 0.6;
      anchor.add(fluke);
    }
    anchor.position.set(8.6, 1.7, s * 2.7);
    anchor.rotation.z = 0.25;
    gAnchor.add(anchor);
  }
  ship.add(gAnchor);

  /* ---------- 7-10 船首像 ---------- */
  const gFig = new THREE.Group();
  gFig.userData.partId = 'figurehead';
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.6, 10), goldMat);
  body.rotation.z = Math.PI / 2;
  body.position.set(11.6, 3.1, 0);
  gFig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 12), goldMat);
  head.position.set(12.4, 3.45, 0);
  gFig.add(head);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 8), goldMat);
  crown.position.set(12.4, 3.95, 0);
  gFig.add(crown);
  ship.add(gFig);

  // 阴影开关
  ship.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return ship;
}

// 骷髅旗贴图（Canvas 程序化生成，无需外部图片）
function makeFlagMaterial() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 80;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141414';
  ctx.fillRect(0, 0, 128, 80);
  ctx.fillStyle = '#f5f5f5';
  // 骷髅头
  ctx.beginPath();
  ctx.arc(64, 30, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#141414';
  ctx.beginPath(); ctx.arc(59, 28, 3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(69, 28, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(61, 38, 6, 6);
  // 交叉骨头
  ctx.save();
  ctx.translate(64, 56);
  ctx.rotate(0.5);
  ctx.fillRect(-16, -2.5, 32, 5);
  ctx.restore();
  ctx.save();
  ctx.translate(64, 56);
  ctx.rotate(-0.5);
  ctx.fillRect(-16, -2.5, 32, 5);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.9 });
}

/* ============================================================
 * 6. GLB 在线加载 & 降级
 * ============================================================ */
function loadWithTimeout(url, ms) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const timer = setTimeout(() => reject(new Error('加载超时')), ms);
    loader.load(
      url,
      (gltf) => { clearTimeout(timer); resolve(gltf); },
      undefined,
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

async function loadShip() {
  const setText = (t) => { document.getElementById('loading-text').textContent = t; };
  const statusEl = document.getElementById('model-status');

  for (let i = 0; i < MODEL_URLS.length; i++) {
    const url = MODEL_URLS[i];
    try {
      setText(`正在尝试在线模型 (${i + 1}/${MODEL_URLS.length})…`);
      const gltf = await loadWithTimeout(url, MODEL_TIMEOUT);
      const model = gltf.scene;
      normalizeGLB(model);
      classifyGLBParts(model);
      fitAndCenter(model, 26);
      model.traverse((o) => {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
      }
      shipRoot = model;
      scene.add(model);
      registerShip(model);
      statusEl.innerHTML = `模型来源：在线 GLB <span class="ok">✔ 加载成功</span>`;
      finishLoading();
      return;
    } catch (e) {
      console.warn(`[模型加载失败] ${url}`, e?.message || e);
    }
  }

  // 全部失败 → 程序化兜底
  setText('在线模型不可用，正在生成内置海盗船…');
  const fallback = buildProceduralShip();
  shipRoot = fallback;
  scene.add(fallback);
  registerShip(fallback);
  statusEl.innerHTML = `模型来源：内置程序化海盗船 <span class="fb">（在线 GLB 加载失败，已自动兜底）</span>`;
  finishLoading();
}

// 统一 GLB 材质为 Standard，便于改色 / 线框 / 透视
function normalizeGLB(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (Array.isArray(o.material)) {
      o.material = o.material.map((m) => m && m.isMeshStandardMaterial ? m : new THREE.MeshStandardMaterial().copy(m));
    } else if (o.material && !o.material.isMeshStandardMaterial) {
      o.material = new THREE.MeshStandardMaterial().copy(o.material);
    }
  });
}

// 按名称关键字把 GLB 网格归类到十大部件
const KEYWORD_MAP = [
  ['figurehead', ['figure', 'head', 'statue', 'ornament']],
  ['mast', ['mast', 'pole', 'spar']],
  ['sail', ['sail', 'canvas', 'cloth', 'flag', 'jib']],
  ['rigging', ['rig', 'rope', 'line', 'cable', 'shroud']],
  ['gunport', ['gun', 'cannon', 'port']],
  ['deck', ['deck', 'floor', 'plank']],
  ['cabin', ['cabin', 'hull', 'body', 'wall', 'stern', 'room']],
  ['rudder', ['rudder', 'wheel', 'helm', 'steer']],
  ['anchor', ['anchor']],
  ['keel', ['keel', 'rib', 'frame', 'beam', 'bulkhead']],
];
function classifyGLBParts(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const hay = `${o.name || ''} ${o.parent?.name || ''}`.toLowerCase();
    let matched = null;
    for (const [id, keys] of KEYWORD_MAP) {
      if (keys.some((k) => hay.includes(k))) { matched = id; break; }
    }
    o.userData.partId = matched; // 未命中为 null，点击时显示通用说明
  });
}

// 把任意尺寸的 GLB 归一化到与程序化船相近的尺度并落到海面
function fitAndCenter(obj, targetSize) {
  const box3 = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box3.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / maxDim;
  obj.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(obj);
  const center = new THREE.Vector3();
  box2.getCenter(center);
  obj.position.sub(center);
  const box3b = new THREE.Box3().setFromObject(obj);
  obj.position.y += -2.2 - box3b.min.y; // 船底贴近海面
}

function finishLoading() {
  document.getElementById('loading').classList.add('hidden');
}

/* ============================================================
 * 7. 材质注册、渲染模式（透视 / 线框）与高亮
 * ============================================================ */
function registerShip(root) {
  clickableMeshes.length = 0;
  materialBackup.clear();
  root.traverse((o) => {
    if (o.isMesh || o.isLine) {
      clickableMeshes.push(o);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m || materialBackup.has(m)) return;
        materialBackup.set(m, {
          transparent: m.transparent,
          opacity: m.opacity,
          wireframe: m.wireframe,
          color: m.color ? m.color.getHex() : 0xffffff,
          emissive: m.emissive ? m.emissive.getHex() : 0x000000,
          emissiveIntensity: m.emissiveIntensity ?? 1,
          depthWrite: m.depthWrite,
        });
      });
    }
  });
  applyRenderMode();
  refreshHighlight();
}

function forEachMaterial(mesh, fn) {
  if (!mesh.material) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  mats.forEach(fn);
}

// 透视模式：船壳类部件半透明，露出内部龙骨 / 隔舱
const XRAY_SEMI = new Set(['cabin', 'deck', 'gunport']);
function applyRenderMode() {
  if (!shipRoot) return;
  shipRoot.traverse((o) => {
    if (!(o.isMesh || o.isLine)) return;
    forEachMaterial(o, (m) => {
      const backup = materialBackup.get(m);
      if (!backup) return;
      // 线框优先级最高
      m.wireframe = state.wireframe ? true : backup.wireframe;
      if (state.xray) {
        const pid = findPartId(o);
        const semi = XRAY_SEMI.has(pid);
        m.transparent = true;
        m.opacity = semi ? 0.22 : (o.isLine ? 0.85 : 0.92);
        m.depthWrite = !semi;
      } else {
        m.transparent = backup.transparent;
        m.opacity = backup.opacity;
        m.depthWrite = backup.depthWrite;
      }
      m.needsUpdate = true;
    });
  });
  refreshHighlight();
}

function findPartId(obj) {
  let cur = obj;
  while (cur) {
    if (cur.userData && cur.userData.partId) return cur.userData.partId;
    cur = cur.parent;
  }
  return null;
}

function refreshHighlight() {
  if (!shipRoot) return;
  shipRoot.traverse((o) => {
    if (!(o.isMesh || o.isLine)) return;
    const pid = findPartId(o);
    const active = pid && (pid === selectedPartId || pid === hoveredPartId);
    forEachMaterial(o, (m) => {
      const backup = materialBackup.get(m);
      if (!backup) return;
      if (active) {
        // 标准材质用自发光；线 / 基础材质无 emissive，直接改颜色
        if (m.emissive) {
          m.emissive.copy(highlightColor);
          m.emissiveIntensity = pid === selectedPartId ? 0.85 : 0.4;
        } else if (m.color) {
          m.color.copy(highlightColor);
        }
      } else {
        if (m.emissive) {
          m.emissive.setHex(backup.emissive);
          m.emissiveIntensity = backup.emissiveIntensity;
        }
        if (m.color) m.color.setHex(backup.color);
      }
    });
  });
  // 同步左侧导览高亮
  document.querySelectorAll('#parts-ul li').forEach((li) => {
    li.classList.toggle('active', li.dataset.partId === selectedPartId);
  });
}

/* ============================================================
 * 8. 射线拾取：点击 / 悬停
 * ============================================================ */
function pickPart(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickableMeshes, false);
  return hits.length ? hits[0].object : null;
}

let downX = 0, downY = 0;
function setupPicking() {
  const dom = renderer.domElement;
  dom.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; });
  dom.addEventListener('pointerup', (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // 拖拽不触发
    const obj = pickPart(e);
    if (obj) selectObject(obj);
    else closeInfo();
  });
  dom.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    const obj = pickPart(e);
    const pid = obj ? findPartId(obj) : null;
    if (pid !== hoveredPartId) {
      hoveredPartId = pid;
      dom.style.cursor = pid ? 'pointer' : 'grab';
      refreshHighlight();
    }
  });
}

function selectObject(obj) {
  const pid = findPartId(obj);
  selectedPartId = pid;
  refreshHighlight();
  if (pid && PART_INFO[pid]) {
    openInfo(PART_INFO[pid]);
  } else {
    openInfo({
      name: obj.name || '未命名部件',
      structure: '该网格来自在线 GLB 模型，未在部件关键字表中匹配到标准分类，因此显示通用说明。可在 main.js 的 KEYWORD_MAP 中补充该模型的命名关键字以精确归类。',
      function: '它仍是模型的有效组成部分，已支持高亮、透视与线框查看。',
    });
  }
}

function openInfo(info) {
  document.getElementById('info-title').textContent = info.name;
  document.getElementById('info-body').innerHTML =
    `<h3>结构</h3><p>${info.structure}</p><h3>功能</h3><p>${info.function}</p>`;
  document.getElementById('info').classList.add('open');
}
function closeInfo() {
  selectedPartId = null;
  refreshHighlight();
  document.getElementById('info').classList.remove('open');
}

/* ============================================================
 * 9. UI 绑定
 * ============================================================ */
function setupUI() {
  const btnPlay = document.getElementById('btn-play');
  btnPlay.addEventListener('click', () => {
    state.playing = !state.playing;
    btnPlay.textContent = state.playing ? '⏸ 暂停动画' : '▶ 播放动画';
    btnPlay.classList.toggle('paused', !state.playing);
  });

  const speed = document.getElementById('speed');
  const speedVal = document.getElementById('speed-val');
  speed.addEventListener('input', () => {
    state.speed = parseFloat(speed.value);
    speedVal.textContent = state.speed.toFixed(1) + '×';
  });

  document.getElementById('chk-xray').addEventListener('change', (e) => {
    state.xray = e.target.checked;
    applyRenderMode();
  });
  document.getElementById('chk-wire').addEventListener('change', (e) => {
    state.wireframe = e.target.checked;
    applyRenderMode();
  });

  document.getElementById('btn-reset').addEventListener('click', resetView);
  document.getElementById('info-close').addEventListener('click', closeInfo);

  // 部件导览列表
  const ul = document.getElementById('parts-ul');
  PART_ORDER.forEach((id) => {
    const li = document.createElement('li');
    li.textContent = PART_INFO[id].name;
    li.dataset.partId = id;
    li.addEventListener('click', () => {
      selectedPartId = id;
      refreshHighlight();
      openInfo(PART_INFO[id]);
      focusPart(id);
    });
    ul.appendChild(li);
  });
}

// 点击导览时把相机平滑推向该部件
function focusPart(partId) {
  if (!shipRoot) return;
  let target = null;
  shipRoot.traverse((o) => {
    if (!target && findPartId(o) === partId && (o.isMesh || o.isLine)) target = o;
  });
  if (!target) return;
  const p = new THREE.Vector3();
  target.getWorldPosition(p);
  controls.target.copy(p);
}

function resetView() {
  camera.position.set(22, 12, 26);
  controls.target.set(0, 2.5, 0);
  controls.update();
}

/* ============================================================
 * 10. 动画循环
 * ============================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const dt = state.playing ? delta * state.speed : 0;
  if (state.playing) state.animTime += dt;
  const t = state.animTime;

  if (shipRoot) {
    // 船身随海浪小幅摇晃（纵摇 + 横摇 + 升沉）
    shipRoot.rotation.z = Math.sin(t * 0.8) * 0.035;       // 横摇
    shipRoot.rotation.x = Math.sin(t * 0.55 + 1.2) * 0.025; // 纵摇
    shipRoot.position.y = Math.sin(t * 0.9) * 0.18;         // 升沉
  }

  // 风帆顶点鼓荡
  for (const s of animatedSails) {
    const attr = s.mesh.geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += 3) {
      const bx = s.base[i], by = s.base[i + 1];
      arr[i + 2] = s.base[i + 2]
        + Math.sin(t * 2.2 + bx * 1.4 + s.phase) * s.amp
        + Math.sin(t * 1.5 + by * 2.0) * s.amp * 0.4;
    }
    attr.needsUpdate = true;
    s.mesh.geometry.computeVertexNormals();
  }

  // 船舵 / 舵轮联动（仅程序化兜底船带绑定引用）
  if (rudderGroupRef && rudderGroupRef.userData.wheel) {
    const steer = Math.sin(t * 0.7) * 0.35;
    rudderGroupRef.userData.wheel.rotation.z = t * 0.8;
    rudderGroupRef.userData.blade.rotation.y = steer;
  }

  // 海浪顶点起伏
  if (seaMesh) {
    const attr = seaMesh.geometry.attributes.position;
    const arr = attr.array;
    for (let i = 0; i < arr.length; i += 3) {
      const x = arr[i], z = arr[i + 2];
      arr[i + 1] = Math.sin(x * 0.08 + t * 1.1) * 0.35
                 + Math.cos(z * 0.1 + t * 0.9) * 0.28;
    }
    attr.needsUpdate = true;
  }

  if (mixer && state.playing) mixer.update(dt);

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ============================================================
 * 11. 启动
 * ============================================================ */
initScene();
setupUI();
setupPicking();
animate();
loadShip();
