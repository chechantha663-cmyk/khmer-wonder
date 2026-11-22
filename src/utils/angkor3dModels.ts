import * as THREE from 'three';

export interface AngkorMaterialSet {
  sandstone: THREE.MeshStandardMaterial;
  sandstoneDark: THREE.MeshStandardMaterial;
  mossyStone: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  lotusPetal: THREE.MeshStandardMaterial;
  lotusCore: THREE.MeshStandardMaterial;
  rubyAccent: THREE.MeshStandardMaterial;
  jadeAccent: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  textures: THREE.Texture[];
}

export function createSandstoneTexture(
  renderer: THREE.WebGLRenderer,
  baseHex: string,
  grainHex: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = baseHex;
    ctx.fillRect(0, 0, 256, 256);

    // Carved Khmer sandstone ashlar masonry lines
    ctx.strokeStyle = 'rgba(42, 30, 18, 0.24)';
    ctx.lineWidth = 2;
    for (let row = 0; row < 8; row++) {
      const y = row * 32;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();

      const offset = (row % 2) * 32;
      for (let col = 0; col < 4; col++) {
        const x = (col * 64 + offset) % 256;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 32);
        ctx.stroke();
      }
    }

    // Fine mineral sandstone speckles
    ctx.fillStyle = grainHex;
    for (let i = 0; i < 650; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      const r = (i % 3) + 1;
      ctx.globalAlpha = 0.08 + ((i % 5) * 0.03);
      ctx.fillRect(x, y, r, r);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
    grad.addColorStop(0, 'rgba(15, 10, 5, 0.55)');
    grad.addColorStop(0.55, 'rgba(15, 10, 5, 0.22)');
    grad.addColorStop(1, 'rgba(15, 10, 5, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createAngkorMaterials(renderer: THREE.WebGLRenderer): AngkorMaterialSet {
  const stoneTex = createSandstoneTexture(renderer, '#c8a87e', '#6f5335');
  const darkStoneTex = createSandstoneTexture(renderer, '#8e7356', '#3d2f21');
  const shadowTex = createContactShadowTexture();

  const sandstone = new THREE.MeshStandardMaterial({
    map: stoneTex,
    roughness: 0.86,
    metalness: 0.05,
  });
  const sandstoneDark = new THREE.MeshStandardMaterial({
    map: darkStoneTex,
    roughness: 0.9,
    metalness: 0.08,
  });
  const mossyStone = new THREE.MeshStandardMaterial({
    color: 0x5c6e4e,
    roughness: 0.92,
    metalness: 0.04,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf4be49,
    roughness: 0.22,
    metalness: 0.92,
    emissive: 0x3b2202,
    emissiveIntensity: 0.25,
  });
  const lotusPetal = new THREE.MeshStandardMaterial({
    color: 0xf9a8d4,
    roughness: 0.34,
    metalness: 0.12,
    emissive: 0x9d174d,
    emissiveIntensity: 0.28,
  });
  const lotusCore = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    roughness: 0.18,
    metalness: 0.55,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.95,
  });
  const rubyAccent = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.24,
    metalness: 0.45,
    emissive: 0x991b1b,
    emissiveIntensity: 0.65,
  });
  const jadeAccent = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.3,
    metalness: 0.25,
    emissive: 0x065f46,
    emissiveIntensity: 0.45,
  });
  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });

  return {
    sandstone,
    sandstoneDark,
    mossyStone,
    gold,
    lotusPetal,
    lotusCore,
    rubyAccent,
    jadeAccent,
    contactShadow,
    textures: [stoneTex, darkStoneTex, shadowTex],
  };
}

/**
 * Composite 9-part Hero Actor: "សុភាទន្សាយមាស" (Golden Angkor Spirit Hare on Lotus Pedestal)
 * Pivoted at bottom-center (y = 0) flush with ground.
 */
export function buildGoldenHareHero(mats: AngkorMaterialSet): THREE.Group {
  const group = new THREE.Group();

  // 1. Ground contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), mats.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  group.add(shadow);

  // 2. Stepped lotus sled pedestal (LatheGeometry)
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.74, 0),
    new THREE.Vector2(0.84, 0.14),
    new THREE.Vector2(0.68, 0.26),
    new THREE.Vector2(0.56, 0.32),
    new THREE.Vector2(0, 0.32),
  ];
  const pedestal = new THREE.Mesh(new THREE.LatheGeometry(basePts, 20), mats.gold);
  pedestal.castShadow = true;
  pedestal.receiveShadow = true;
  group.add(pedestal);

  // 3. Jade ring collar accent
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.06, 10, 24), mats.jadeAccent);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.34;
  group.add(collar);

  // 4. Sculpted sandstone/ivory spirit hare torso (LatheGeometry)
  const bodyPts = [
    new THREE.Vector2(0, 0.32),
    new THREE.Vector2(0.46, 0.38),
    new THREE.Vector2(0.52, 0.72),
    new THREE.Vector2(0.38, 1.05),
    new THREE.Vector2(0.24, 1.18),
    new THREE.Vector2(0, 1.22),
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyPts, 18), mats.sandstone);
  body.castShadow = true;
  group.add(body);

  // 5. Head sphere-profile with Khmer golden crown band
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 18, 14), mats.sandstone);
  head.position.set(0, 1.38, 0.05);
  head.scale.set(0.95, 0.92, 1.05);
  head.castShadow = true;
  group.add(head);

  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 20), mats.gold);
  crown.rotation.x = Math.PI / 2 - 0.18;
  crown.position.set(0, 1.58, 0.04);
  group.add(crown);

  // 6 & 7. Twin sculpted golden-tipped hare ears
  const earGeo = new THREE.CapsuleGeometry(0.085, 0.42, 6, 10);
  const earL = new THREE.Mesh(earGeo, mats.gold);
  earL.position.set(-0.16, 1.9, -0.02);
  earL.rotation.z = 0.18;
  earL.rotation.x = -0.15;
  earL.castShadow = true;
  group.add(earL);

  const earR = new THREE.Mesh(earGeo, mats.gold);
  earR.position.set(0.16, 1.9, -0.02);
  earR.rotation.z = -0.18;
  earR.rotation.x = -0.15;
  earR.castShadow = true;
  group.add(earR);

  // 8. Glowing floating lantern orb in front chest
  const lantern = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.lotusCore);
  lantern.position.set(0, 0.85, -0.48);
  lantern.name = 'heroLantern';
  group.add(lantern);

  // 9. Flowing gold sash tail
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mats.gold);
  tail.position.set(0, 0.56, 0.5);
  group.add(tail);

  return group;
}

/**
 * Composite 7-part Collectible: Glowing Golden Lotus Blossom
 */
export function buildGoldenLotus(mats: AngkorMaterialSet): THREE.Group {
  const group = new THREE.Group();

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.24, 1), mats.lotusCore);
  core.position.y = 0.25;
  group.add(core);

  const petalGeo = new THREE.ConeGeometry(0.22, 0.56, 5);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const petal = new THREE.Mesh(petalGeo, i % 2 === 0 ? mats.lotusPetal : mats.gold);
    petal.position.set(Math.cos(angle) * 0.28, 0.22, Math.sin(angle) * 0.28);
    petal.rotation.z = -Math.cos(angle) * 0.72;
    petal.rotation.x = Math.sin(angle) * 0.72;
    group.add(petal);
  }

  return group;
}

/**
 * Composite 6-part Low Jumpable Obstacle: Carved Naga Stone Barrier
 * Pivoted at y = 0. Height ~ 1.05 units (cleanly jumpable).
 */
export function buildLowNagaBarrier(mats: AngkorMaterialSet): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.3), mats.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  // Stepped carved plinth
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.34, 0.76), mats.sandstoneDark);
  base.position.y = 0.17;
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  // Main beveled stone beam
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.42, 0.54), mats.sandstone);
  beam.position.y = 0.55;
  beam.castShadow = true;
  group.add(beam);

  // Twin Naga pillar end-caps with glowing ruby warning crests
  for (const side of [-0.95, 0.95]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 0.85, 8), mats.sandstoneDark);
    cap.position.set(side, 0.44, 0);
    cap.castShadow = true;
    group.add(cap);

    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), mats.rubyAccent);
    crest.position.set(side, 0.98, 0);
    group.add(crest);
  }

  // Gold warning inlay bar
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.58), mats.gold);
  trim.position.y = 0.78;
  group.add(trim);

  return group;
}

/**
 * Composite 8-part Tall Dodge Obstacle: Carved Angkor Prasat Pillar
 * Pivoted at y = 0. Height ~ 3.4 units (must switch lanes).
 */
export function buildTallTemplePillar(mats: AngkorMaterialSet): THREE.Group {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mats.contactShadow);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  // Tier 1 plinth
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.48, 1.75), mats.sandstoneDark);
  p1.position.y = 0.24;
  p1.castShadow = true;
  p1.receiveShadow = true;
  group.add(p1);

  // Tier 2 carved shaft
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.26, 1.55, 1.26), mats.sandstone);
  shaft.position.y = 1.25;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Tier 3 stepped prasat cornice
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.34, 1.48), mats.sandstoneDark);
  cornice.position.y = 2.18;
  cornice.castShadow = true;
  group.add(cornice);

  // Tier 4 lotus stupa crown (LatheGeometry)
  const spirePts = [
    new THREE.Vector2(0.54, 0),
    new THREE.Vector2(0.46, 0.32),
    new THREE.Vector2(0.32, 0.64),
    new THREE.Vector2(0.16, 0.92),
    new THREE.Vector2(0, 1.12),
  ];
  const spire = new THREE.Mesh(new THREE.LatheGeometry(spirePts, 10), mats.sandstone);
  spire.position.y = 2.35;
  spire.castShadow = true;
  group.add(spire);

  // Golden finial + glowing ruby guardian eye
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.38, 8), mats.gold);
  finial.position.y = 3.55;
  group.add(finial);

  const ruby = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mats.rubyAccent);
  ruby.position.set(0, 1.38, 0.68);
  group.add(ruby);

  return group;
}

/**
 * Composite 7-part Scenery Prop: Side Angkor Prasat Tower (along the causeway flank)
 */
export function buildFlankPrasatTower(mats: AngkorMaterialSet): THREE.Group {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 4.2), mats.sandstoneDark);
  plinth.position.y = 0.7;
  group.add(plinth);

  const tier1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 3.2), mats.sandstone);
  tier1.position.y = 2.5;
  group.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 2.4), mats.sandstoneDark);
  tier2.position.y = 4.4;
  group.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.6), mats.sandstone);
  tier3.position.y = 5.85;
  group.add(tier3);

  const crownPts = [
    new THREE.Vector2(0.75, 0),
    new THREE.Vector2(0.55, 0.65),
    new THREE.Vector2(0.28, 1.3),
    new THREE.Vector2(0, 1.85),
  ];
  const crown = new THREE.Mesh(new THREE.LatheGeometry(crownPts, 12), mats.sandstone);
  crown.position.y = 6.5;
  group.add(crown);

  const goldTip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 8), mats.gold);
  goldTip.position.y = 8.55;
  group.add(goldTip);

  const mossAccent = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.25, 3.35), mats.mossyStone);
  mossAccent.position.y = 1.48;
  group.add(mossAccent);

  return group;
}
