/* Motor 3D da caneca (Three.js r128) e empacotamento criptografado dos links 3D.
   Usado pelo Provador (index.html) e pela página da cliente (v/index.html). */
(function (global) {
  'use strict';

  // Caneca Live Sub 325 ml: Ø 81 mm, ~10 cm de altura, faixa imprimível de 98 mm (medidas em cm).
  const MUG = { R: 4.05, T: 0.32, Y0: 0.12, Y1: 9.92 };
  const CIRC_MM = Math.PI * 81;                 // 254,5 mm de volta
  const ART_H_MM = 98;
  const WHITE = '#F5F5F2';
  const TARGET_Y = 5.0;
  const TEX_W = 4096, TEX_H = Math.round(TEX_W * ART_H_MM / CIRC_MM);

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- cena ---------- */
  // Duas iluminações de estúdio. Cada uma tem um "ambiente" (o que a cerâmica reflete)
  // e luzes diretas que dão volume. As cores das luzes ficam em RGB linear.
  const LIGHTS = {
    dia: {
      room: [0.40, 0.42, 0.46], floor: [0.58, 0.57, 0.56], env: 0.75,
      panels: [ // [largura, altura, intensidade, posição, cor]
        [18, 14, 3.4, [-15, 10, 9], [1, 1.01, 1.05]],    // janela grande à esquerda
        [10, 14, 1.4, [16, 7, 5], [1, 1, 1]],            // rebatedor à direita
        [24, 8, 1.6, [0, 22, 2], [1, 1, 1]],             // teto
        [14, 10, 1.1, [4, 8, -20], [1, 1, 1]]            // contraluz
      ],
      key: { color: 0xffffff, intensity: 0.2, pos: [-8, 9, 7] },
      fill: { color: 0xdfe8ff, intensity: 0.04, pos: [9, 4, 6] },
      hemi: { sky: 0xeef3ff, ground: 0xcfc8bf, intensity: 0.06 },
      shadow: 0.38
    },
    noite: {
      room: [0.07, 0.074, 0.085], floor: [0.07, 0.07, 0.07], env: 1,
      panels: [
        [8, 8, 6.5, [12, 8, 10], [1, 0.95, 0.9]],        // luminária à direita, branco levemente quente
        [12, 6, 1.2, [-11, 12, -14], [0.8, 0.86, 1]],    // luz da janela, atrás
        [6, 4, 1.6, [-14, 6, 8], [1, 1, 1]]              // reflexo suave à esquerda
      ],
      key: { color: 0xfff4ea, intensity: 0.4, pos: [9, 8, 6] },
      fill: { color: 0xd6def0, intensity: 0.12, pos: [-9, 7, 6] },
      hemi: { sky: 0x8a93a8, ground: 0x3a3632, intensity: 0.1 },
      shadow: 0.62
    }
  };
  function buildEnvScene(L) {
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.BoxGeometry(44, 26, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color().fromArray(L.room), side: THREE.BackSide }));
    room.position.y = 9; s.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.MeshBasicMaterial({ color: new THREE.Color().fromArray(L.floor) }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.9; s.add(floor);
    L.panels.forEach(([w, h, k, pos, col]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col[0] * k, col[1] * k, col[2] * k), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 5, 0); s.add(m);
    });
    return s;
  }

  function ceramic(extra) {
    return new THREE.MeshPhysicalMaterial(Object.assign({ roughness: 0.45, metalness: 0, reflectivity: 0.2, clearcoat: 0.85, clearcoatRoughness: 0.07 }, extra));
  }

  function ellipticTube(curve, steps, radial, a, b) {
    const frames = curve.computeFrenetFrames(steps, false);
    const pos = [], nor = [], idx = [];
    for (let i = 0; i <= steps; i++) {
      const P = curve.getPointAt(i / steps), N = frames.normals[i], B = frames.binormals[i];
      for (let j = 0; j <= radial; j++) {
        const t = (j / radial) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        pos.push(P.x + N.x * a * c + B.x * b * s, P.y + N.y * a * c + B.y * b * s, P.z + N.z * a * c + B.z * b * s);
        let nx = c / a, ny = s / b; const l = Math.hypot(nx, ny); nx /= l; ny /= l;
        nor.push(N.x * nx + B.x * ny, N.y * nx + B.y * ny, N.z * nx + B.z * ny);
      }
    }
    for (let i = 0; i < steps; i++) for (let j = 0; j < radial; j++) {
      const a0 = i * (radial + 1) + j, a1 = a0 + radial + 1;
      idx.push(a0, a0 + 1, a1, a1, a0 + 1, a1 + 1);   // faces viradas para fora
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setIndex(idx);
    return g;
  }

  function contactShadow() {
    const c = mk(256, 256), g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.4, 'rgba(0,0,0,0.32)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.13)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.035)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.005;
    return m;
  }

  // halfW / halfTall: meia largura e meia altura (cm) que precisam caber; cx desloca o enquadramento; ty é a altura da mira.
  function placeCamera(cam, aspect, o) {
    const e = o.elev == null ? 0.21 : o.elev, ds = o.dist || 1, halfW = o.halfW || 7.6, cx = o.cx || 0;
    const halfTall = o.halfTall || 6.1, ty = o.ty == null ? TARGET_Y : o.ty;
    cam.aspect = aspect; cam.updateProjectionMatrix();
    const halfV = THREE.MathUtils.degToRad(cam.fov / 2), halfH = Math.atan(Math.tan(halfV) * aspect);
    const d = Math.max(halfTall / Math.tan(halfV), halfW / Math.tan(halfH)) * ds;
    cam.position.set(cx, ty + Math.sin(e) * d, Math.cos(e) * d);
    cam.lookAt(cx, ty, 0);
  }

  /* ---------- caneca ---------- */
  // Cria a cena da caneca. A arte é desenhada numa textura que dá a volta inteira:
  // u = ângulo / 2π, alça em u = 0,25 e centro da arte em u = 0,75 (oposto à alça).
  function create(renderer) {
    const { R, T, Y0, Y1 } = MUG, V2 = THREE.Vector2;
    const look = { artMM: 200, fit: 'stretch', inner: WHITE, handle: WHITE, body: WHITE };
    let art = null;
    look.light = 'dia';

    const scene = new THREE.Scene(), group = new THREE.Group(), envScenes = {}, envs = new Map();
    const key = new THREE.DirectionalLight(), fill = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight();
    scene.add(key, fill, hemi);
    const texCanvas = mk(TEX_W, TEX_H), tctx = texCanvas.getContext('2d');
    const artTex = new THREE.CanvasTexture(texCanvas);
    artTex.encoding = THREE.sRGBEncoding;
    artTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Parede externa: recebe a arte.
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Y1 - Y0, 220, 1, true), ceramic({ map: artTex }));
    wall.position.y = (Y0 + Y1) / 2; group.add(wall);

    // Interior + borda (cor do esmalte interno), com sombreado de profundidade.
    const ri = R - T, pts = [new V2(0.001, 0.62), new V2(ri - 0.28, 0.62)];
    for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); pts.push(new V2(ri - 0.28 + 0.28 * Math.cos(a), 0.9 + 0.28 * Math.sin(a))); }
    pts.push(new V2(ri, Y1));
    for (let i = 1; i <= 12; i++) { const a = Math.PI - (i / 12) * Math.PI; pts.push(new V2(R - T / 2 + (T / 2) * Math.cos(a), Y1 + (T / 2) * Math.sin(a))); }
    const innerGeo = new THREE.LatheGeometry(pts, 220);
    const p = innerGeo.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), rad = Math.hypot(p.getX(i), p.getZ(i));
      let f = 0.42 + 0.58 * Math.pow(clamp((y - 0.62) / (Y1 - 0.62), 0, 1), 0.55);
      if (rad > ri + 0.01) f = 1;
      cols.push(f, f, f);
    }
    innerGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const matInner = ceramic({ vertexColors: true, side: THREE.DoubleSide });
    group.add(new THREE.Mesh(innerGeo, matInner));

    // Fundo externo com pé.
    const bp = [new V2(0.001, 0.08), new V2(R - 0.7, 0.08), new V2(R - 0.55, 0), new V2(R - Y0, 0)];
    for (let i = 1; i <= 8; i++) { const a = -Math.PI / 2 + (i / 8) * (Math.PI / 2); bp.push(new V2(R - Y0 + Y0 * Math.cos(a), Y0 + Y0 * Math.sin(a))); }
    const matBody = ceramic({ side: THREE.DoubleSide });
    group.add(new THREE.Mesh(new THREE.LatheGeometry(bp, 220), matBody));

    // Alça em C, seção oval, nascendo dentro da parede.
    const v = (x, y) => new THREE.Vector3(x, y, 0);
    const curve = new THREE.CatmullRomCurve3([v(3.8, 8.25), v(4.7, 8.5), v(5.75, 8.3), v(6.55, 7.45), v(6.85, 5.95), v(6.55, 4.35), v(5.75, 3.25), v(4.7, 2.75), v(3.8, 2.65)], false, 'centripetal');
    const matHandle = ceramic({ side: THREE.DoubleSide });
    group.add(new THREE.Mesh(ellipticTube(curve, 160, 40, 0.62, 0.37), matHandle));

    scene.add(group);
    const shadow = contactShadow();
    scene.add(shadow);
    const mats = [];
    group.traverse((o) => { if (o.material) mats.push(o.material); });

    function drawArt(g, x, y, w, h) {
      if (!art) return;
      if (look.fit === 'stretch') { g.drawImage(art.src, x, y, w, h); return; }
      const s = Math.min(w / art.w, h / art.h), dw = art.w * s, dh = art.h * s;
      g.drawImage(art.src, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    }
    // Arte planificada exatamente como vai na área de impressão (fundo na cor do corpo).
    function renderFlat(w, h) {
      const c = mk(w, h), g = c.getContext('2d');
      g.fillStyle = look.body; g.fillRect(0, 0, w, h);
      g.imageSmoothingQuality = 'high';
      drawArt(g, 0, 0, w, h);
      return c;
    }
    function paint() {
      const w = TEX_W * look.artMM / CIRC_MM, x0 = TEX_W * 0.75 - w / 2;
      tctx.fillStyle = look.body; tctx.fillRect(0, 0, TEX_W, TEX_H);
      tctx.imageSmoothingQuality = 'high';
      drawArt(tctx, x0, 0, w, TEX_H);
      if (x0 + w > TEX_W) drawArt(tctx, x0 - TEX_W, 0, w, TEX_H);
      if (x0 < 0) drawArt(tctx, x0 + TEX_W, 0, w, TEX_H);
      artTex.needsUpdate = true;
    }
    function applyLight() {
      const L = LIGHTS[look.light] || LIGHTS.dia;
      key.color.setHex(L.key.color); key.intensity = L.key.intensity; key.position.fromArray(L.key.pos);
      fill.color.setHex(L.fill.color); fill.intensity = L.fill.intensity; fill.position.fromArray(L.fill.pos);
      hemi.color.setHex(L.hemi.sky); hemi.groundColor.setHex(L.hemi.ground); hemi.intensity = L.hemi.intensity;
      shadow.material.opacity = L.shadow / 0.42;
      mats.forEach((m) => { m.envMapIntensity = L.env; });
    }
    function set(patch) {
      Object.assign(look, patch);
      applyLight();
      matInner.color.set(look.inner).convertSRGBToLinear();
      matHandle.color.set(look.handle).convertSRGBToLinear();
      matBody.color.set(look.body).convertSRGBToLinear();
      paint();
    }
    function setArt(src, w, h) { art = src ? { src, w, h } : null; paint(); }
    // Cada renderizador precisa do próprio mapa de ambiente, um por iluminação.
    function envFor(r) {
      const name = LIGHTS[look.light] ? look.light : 'dia';
      let byR = envs.get(r); if (!byR) { byR = {}; envs.set(r, byR); }
      if (!byR[name]) {
        if (!envScenes[name]) envScenes[name] = buildEnvScene(LIGHTS[name]);
        const pm = new THREE.PMREMGenerator(r); byR[name] = pm.fromScene(envScenes[name], 0.035).texture; pm.dispose();
      }
      return byR[name];
    }
    function render(r, cam, o) {
      const c = r.domElement;
      placeCamera(cam, c.width / c.height, o);
      group.rotation.y = o.yaw || 0;
      scene.environment = envFor(r);
      r.render(scene, cam);
    }

    set({});
    return { look, set, setArt, drawArt, renderFlat, render };
  }

  function newRenderer(opts) {
    const r = new THREE.WebGLRenderer(Object.assign({ antialias: true, alpha: true }, opts));
    r.outputEncoding = THREE.sRGBEncoding;
    r.setClearColor(0x000000, 0);
    return r;
  }
  const newCamera = () => new THREE.PerspectiveCamera(26, 1, 1, 300);

  /* ---------- links 3D: pacote criptografado ----------
     arquivo = iv (12 bytes) + AES-GCM( "CNC1" + tamanho do JSON (uint32) + JSON + JPEG da arte ).
     A chave vai só no link, depois do #, e nunca é enviada ao servidor. */
  const b64u = {
    enc(bytes) {
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      str = str.replace(/-/g, '+').replace(/_/g, '/');
      while (str.length % 4) str += '=';
      const s = atob(str), b = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
      return b;
    }
  };
  const MAGIC = [67, 78, 67, 49]; // "CNC1"
  function randomId(n) {
    const abc = 'abcdefghijkmnpqrstuvwxyz23456789', r = crypto.getRandomValues(new Uint8Array(n));
    return Array.from(r, (x) => abc[x % abc.length]).join('');
  }
  async function pack(cfg, artBlob) {
    const json = new TextEncoder().encode(JSON.stringify(cfg)), img = new Uint8Array(await artBlob.arrayBuffer());
    const plain = new Uint8Array(8 + json.length + img.length);
    plain.set(MAGIC); new DataView(plain.buffer).setUint32(4, json.length);
    plain.set(json, 8); plain.set(img, 8 + json.length);
    const raw = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
    const bytes = new Uint8Array(12 + ct.length); bytes.set(iv); bytes.set(ct, 12);
    return { id: randomId(12), key: b64u.enc(raw), bytes };
  }
  async function unpack(buf, keyStr) {
    const data = new Uint8Array(buf);
    const key = await crypto.subtle.importKey('raw', b64u.dec(keyStr), 'AES-GCM', false, ['decrypt']);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: data.subarray(0, 12) }, key, data.subarray(12)));
    if (MAGIC.some((b, i) => plain[i] !== b)) throw new Error('formato');
    const n = new DataView(plain.buffer).getUint32(4);
    const cfg = JSON.parse(new TextDecoder().decode(plain.subarray(8, 8 + n)));
    return { cfg, art: new Blob([plain.subarray(8 + n)], { type: 'image/jpeg' }) };
  }
  // "#id.chave" → { id, key }
  // Tolerante: acha "código.chave" em qualquer parte do texto, mesmo com o # trocado por %23,
  // espaço ou pontuação grudados no fim (alguns aplicativos de mensagem fazem isso).
  function parseHash(text) {
    let s = String(text || '');
    try { s = decodeURIComponent(s); } catch (e) { /* mantém como veio */ }
    const m = /([a-z2-9]{12})\.([A-Za-z0-9_-]{22})(?![A-Za-z0-9_-])/.exec(s);
    return m ? { id: m[1], key: m[2] } : null;
  }

  global.Mug3D = {
    MUG, CIRC_MM, ART_H_MM, WHITE, TEX_W, TEX_H, LIGHTS,
    create, newRenderer, newCamera, placeCamera, mk,
    share: { pack, unpack, parseHash, b64u }
  };
})(window);
