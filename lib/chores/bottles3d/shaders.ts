/**
 * Gli shader delle bottiglie 3D. Sono scritti in GLSL "vecchio stile"
 * (`texture2D`, `gl_FragColor`): three.js li converte da solo in GLSL ES 3.0,
 * quindi `textureGrad` e le derivate ci sono sempre.
 *
 * Tutti i colori arrivano già in lineare; ogni shader esce in sRGB
 * premoltiplicato, perché il canvas è trasparente sopra la pagina.
 */
import { BOTTOM_R, NECK_R, SHOULDER_H } from '../liquid3d'

const f = (n: number) => n.toFixed(4)

/** La stanza che si riflette nel vetro e nella superficie, e l'uscita in sRGB. */
const COMMON = /* glsl */ `
  const float TAU = 6.28318530718;
  uniform vec3 uRoom;
  uniform float uRoomRefl;
  float softRange(float x, float a, float b, float s) {
    return smoothstep(a - s, a + s, x) * (1.0 - smoothstep(b - s, b + s, x));
  }
  // Luce diffusa del colore della pagina, una finestra alta a sinistra, una luce
  // di taglio a destra, una finestra larga alle spalle (la si vede riflessa nella
  // superficie del liquido) e la plafoniera.
  vec3 envLight(vec3 d) {
    d = normalize(d);
    float az = atan(d.x, d.z);
    float el = asin(clamp(d.y, -1.0, 1.0));
    vec3 col = uRoom * uRoomRefl * mix(0.35, 1.0, smoothstep(-0.5, 0.9, d.y));
    col += vec3(1.0, 0.97, 0.92) * 8.0 * softRange(az, -1.74, -1.16, 0.09) * softRange(el, -0.2, 0.9, 0.1);
    col += vec3(0.92, 0.96, 1.0) * 2.2 * softRange(az, 2.18, 2.6, 0.14) * softRange(el, -0.1, 0.8, 0.12);
    col += vec3(1.0) * 2.4 * smoothstep(2.6, 2.85, abs(az)) * softRange(el, 0.03, 0.5, 0.08);
    col += vec3(1.0) * 0.8 * smoothstep(1.1, 1.3, el);
    return col;
  }
  vec3 toSRGB(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)); }
  // Da colore premoltiplicato in lineare a uscita premoltiplicata in sRGB.
  vec4 outPremul(vec3 col, float alpha) {
    alpha = clamp(alpha, 0.0, 1.0);
    alpha = max(alpha, min(max(col.r, max(col.g, col.b)), 1.0));
    if (alpha < 0.003) discard;
    return vec4(toSRGB(col / alpha) * alpha, alpha);
  }
`

/** La forma interna della bottiglia e la superficie del liquido, uguali a `liquid3d.ts`. */
const BOTTLE = /* glsl */ `
  #define RC ${f(BOTTOM_R)}
  #define SHH ${f(SHOULDER_H)}
  #define RN ${f(NECK_R)}
  #define MEN_H 0.022
  #define MEN_W 0.028
  uniform float uH;
  uniform float uRI;
  uniform vec3 uPlane;   // superficie: quota al centro e pendenza, nel riferimento del liquido
  uniform vec3 uIface;   // confine tra bonus e faccende
  uniform vec2 uTwist;   // quanto la bottiglia è girata sul suo asse (il liquido non gira con lei)
  uniform sampler2D uWave;
  vec2 toLiq(vec2 p) { return vec2(p.x * uTwist.x + p.y * uTwist.y, -p.x * uTwist.y + p.y * uTwist.x); }
  vec2 fromLiq(vec2 g) { return vec2(g.x * uTwist.x - g.y * uTwist.y, g.x * uTwist.y + g.y * uTwist.x); }
  // Il menisco: il liquido risale un poco lungo il vetro.
  float meniscus(float r) { return MEN_H * exp(-(uRI - min(r, uRI)) / MEN_W); }
  float rIn(float y) {
    if (y < 0.0) return 0.0;
    if (y < RC) { float d = RC - y; return uRI - RC + sqrt(max(RC * RC - d * d, 0.0)); }
    if (y <= uH) return uRI;
    float t = (y - uH) / SHH;
    if (t <= 1.0) return RN + (uRI - RN) * (0.5 + 0.5 * cos(3.14159265 * t));
    return RN;
  }
  float surfaceH(vec2 xz, out vec2 grad) {
    vec2 q = toLiq(xz);
    vec3 w = texture2D(uWave, q / (2.0 * uRI) + 0.5).rgb;
    grad = fromLiq(uPlane.yz + w.yz);
    float r = length(xz);
    float men = meniscus(r);
    if (r > 1e-4) grad += (men / MEN_W) * xz / r;
    return uPlane.x + dot(uPlane.yz, q) + w.x + men;
  }
  float surfaceY(vec2 xz) { vec2 g; return surfaceH(xz, g); }
  float ifaceY(vec2 xz) { return uIface.x + dot(uIface.yz, toLiq(xz)); }
  float exitCyl(vec3 ro, vec3 rd, float r) {
    float a = dot(rd.xz, rd.xz);
    if (a < 1e-7) return 1e3;
    float b = dot(ro.xz, rd.xz);
    float c = dot(ro.xz, ro.xz) - r * r;
    float disc = b * b - a * c;
    if (disc < 0.0) return 0.0;
    return (-b + sqrt(disc)) / a;
  }
`

export const VS_WORLD = /* glsl */ `
  varying vec3 vModel;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vModel = position;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

/**
 * Il vetro, disegnato due volte: prima le facce di dietro (la parete lontana,
 * dietro il liquido), poi quelle davanti. Sul davanti ci sono le scritte, in
 * una texture a tre canali (R nomi, G tacche, B suggerimenti e «+»), colorate
 * secondo cosa c'è dietro: vetro vuoto, liquido delle faccende o bonus.
 */
export const FS_GLASS = /* glsl */ `
  ${COMMON}
  ${BOTTLE}
  uniform sampler2D uLabels;
  uniform float uBack;
  uniform float uRO;
  uniform float uGT;
  uniform float uHasLiquid;
  uniform vec3 uTint;
  uniform vec3 uShine;
  uniform vec4 uInkDry, uInkMain, uInkBonus;
  uniform vec4 uLineDry, uLineMain, uLineBonus;
  uniform vec4 uSubDry, uSubMain, uSubBonus;
  varying vec3 vModel;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  vec4 over(vec4 top, vec4 base) { return vec4(top.rgb + base.rgb * (1.0 - top.a), top.a + base.a * (1.0 - top.a)); }
  vec4 layer(vec4 c, float m) { float a = c.a * m; return vec4(c.rgb * a, a); }
  void main() {
    vec3 n = normalize(vNormalW);
    if (!gl_FrontFacing) n = -n;
    vec3 v = normalize(cameraPosition - vPosW);
    float cosv = clamp(dot(n, v), 0.0, 1.0);
    float F = 0.04 + 0.96 * pow(1.0 - cosv, 5.0);
    float y = vModel.y;
    // Il vetro chiaro assorbe poco di fronte e molto di taglio: è il bordo che lo disegna.
    float thick = uGT * (1.0 / max(cosv, 0.12) - 0.7);
    if (y < 0.0) thick += 0.06;
    float ga = 1.0 - exp(-thick * 1.6);
    vec4 c = vec4(uTint * ga, ga);
    vec2 pin = vModel.xz * (uRI / uRO);
    float sY = surfaceY(pin);
    if (y > 0.0 && y < uH) {
      float r2 = max(dot(vModel.xz, vModel.xz), 1e-4);
      vec2 uv = vec2(0.5 + atan(vModel.x, vModel.z) / TAU, y / uH);
      // Derivate dell'angolo calcolate a mano: niente salto dove atan torna indietro.
      vec3 dx = dFdx(vModel);
      vec3 dy = dFdy(vModel);
      vec2 gx = vec2((vModel.z * dx.x - vModel.x * dx.z) / (r2 * TAU), dx.y / uH);
      vec2 gy = vec2((vModel.z * dy.x - vModel.x * dy.z) / (r2 * TAU), dy.y / uH);
      vec3 m = textureGrad(uLabels, uv, gx, gy).rgb;
      vec4 ink = uInkDry;
      vec4 line = uLineDry;
      vec4 sub = uSubDry;
      float fade = 1.0;
      if (uBack > 0.5) {
        fade = 0.45;
      } else if (uHasLiquid > 0.5) {
        float aa = fwidth(y) * 1.2 + 0.0015;
        float wet = 1.0 - smoothstep(-aa, aa, y - sY);
        float bon = wet * (1.0 - smoothstep(-aa, aa, y - ifaceY(pin)));
        ink = mix(mix(uInkDry, uInkMain, wet), uInkBonus, bon);
        line = mix(mix(uLineDry, uLineMain, wet), uLineBonus, bon);
        sub = mix(mix(uSubDry, uSubMain, wet), uSubBonus, bon);
      }
      c = over(layer(line, m.g * fade), c);
      c = over(layer(sub, m.b * fade), c);
      c = over(layer(ink, m.r * fade), c);
    }
    // La linea dove il liquido tocca il vetro.
    if (uHasLiquid > 0.5 && y > 0.0 && sY > 0.02) {
      float d = (y - sY) / 0.011;
      float men = exp(-d * d) * (uBack > 0.5 ? 0.22 : 0.5);
      c.rgb += uShine * men;
      c.a = max(c.a, men * 0.6);
    }
    c.rgb += envLight(reflect(-v, n)) * F;
    gl_FragColor = outPremul(c.rgb, c.a);
  }
`

export const VS_LIQUID = /* glsl */ `
  varying vec3 vModel;
  void main() {
    vModel = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Il liquido come volume. Si disegna su un cilindro che contiene l'interno:
 * per ogni pixel il raggio trova dove entra nel liquido (dal vetro, sotto la
 * superficie, o dalla superficie, con qualche passo di Newton sulle onde), si
 * rifrange, attraversa uno o due strati e ne somma il colore, più denso dove
 * il cammino è lungo. Dalla superficie si aggiunge il riflesso della stanza.
 */
export const FS_LIQUID = /* glsl */ `
  ${COMMON}
  ${BOTTLE}
  uniform vec3 uCam;      // la camera nel riferimento della bottiglia
  uniform mat3 uRotW;     // dalla bottiglia al mondo
  uniform vec3 uKeyM;
  uniform float uYTop;
  uniform float uDensity;
  uniform float uHasBonus;
  uniform vec2 uLayerH;   // spessore al centro: faccende, bonus
  uniform vec3 uLiqTop, uLiqDeep, uBonTop, uBonDeep, uShine;
  varying vec3 vModel;

  bool inHull(vec3 p) { return p.y > 0.0 && length(p.xz) < rIn(p.y); }
  vec3 hullNormal(vec3 p) {
    float r = length(p.xz);
    vec2 dir = r > 1e-4 ? p.xz / r : vec2(0.0, 1.0);
    if (p.y < 0.004 && r < uRI - RC) return vec3(0.0, -1.0, 0.0);
    float e = 0.004;
    float dr = (rIn(p.y + e) - rIn(max(p.y - e, 0.0001))) / (2.0 * e);
    return normalize(vec3(dir.x, -dr, dir.y));
  }
  float planeY(vec3 p) { return uPlane.x + dot(uPlane.yz, toLiq(p.xz)); }
  vec3 layerColor(bool bonus, vec3 p) {
    vec3 col;
    if (bonus) {
      float d = clamp((ifaceY(p.xz) - p.y) / max(uLayerH.y, 0.25), 0.0, 1.0);
      col = mix(uBonTop, uBonDeep, d);
    } else {
      float d = clamp((planeY(p) - p.y) / max(uLayerH.x, 0.3), 0.0, 1.0);
      col = mix(uLiqTop, uLiqDeep, d);
    }
    vec2 dir = normalize(p.xz + vec2(0.0, 1e-3));
    float lit = 0.92 + 0.12 * dot(dir, normalize(uKeyM.xz + vec2(1e-4)));
    return col * lit;
  }
  void main() {
    vec3 ro = vModel;
    vec3 rd = normalize(vModel - uCam);
    float tEx = exitCyl(ro, rd, uRI * 1.003);
    if (rd.y < -1e-4) tEx = min(tEx, -ro.y / rd.y);
    if (rd.y > 1e-4) tEx = min(tEx, (uYTop - ro.y) / rd.y);
    if (tEx <= 0.0) discard;

    // 1. dove il raggio entra davvero nella bottiglia (fondo arrotondato, spalla)
    float t = 0.0;
    vec3 p = ro;
    if (!inHull(p)) {
      float st = tEx / 16.0;
      bool found = false;
      for (int i = 1; i <= 16; i++) {
        float tt = st * float(i);
        if (inHull(ro + rd * tt)) { t = tt; found = true; break; }
      }
      if (!found) discard;
      float a = t - st;
      float b = t;
      for (int i = 0; i < 6; i++) {
        float m = 0.5 * (a + b);
        if (inHull(ro + rd * m)) b = m; else a = m;
      }
      t = b;
      p = ro + rd * t;
    }

    // 2. entra dal vetro (sotto la superficie) o dalla superficie?
    vec2 g;
    float s = surfaceH(p.xz, g);
    bool viaSurface = p.y >= s;
    vec3 nE;
    if (viaSurface) {
      float tt = t;
      for (int i = 0; i < 5; i++) {
        vec3 pp = ro + rd * tt;
        vec2 gg;
        float ss = surfaceH(pp.xz, gg);
        float fp = rd.y - dot(gg, rd.xz);
        if (fp > -1e-4) { tt = 1e3; break; }
        tt -= (pp.y - ss) / fp;
      }
      if (tt > tEx || tt < t - 0.01) discard;
      p = ro + rd * tt;
      if (p.y <= 0.0 || length(p.xz) > rIn(p.y) + 0.003) discard;
      s = surfaceH(p.xz, g);
      nE = normalize(vec3(-g.x, 1.0, -g.y));
    } else {
      nE = hullNormal(p);
    }

    // 3. il cammino dentro il liquido, rifratto
    float cosi = clamp(-dot(rd, nE), 0.0, 1.0);
    float F = 0.02 + 0.98 * pow(1.0 - cosi, 5.0);
    vec3 rd2 = refract(rd, nE, 0.75);
    if (dot(rd2, rd2) < 0.25) rd2 = rd;
    float L = exitCyl(p, rd2, uRI);
    if (rd2.y < -1e-4) L = min(L, -p.y / rd2.y);
    if (!viaSurface) {
      float B = rd2.y - dot(g, rd2.xz);
      if (B > 1e-4) L = min(L, max((s - p.y) / B, 0.0));
    }
    L = max(L, 0.0);

    // 4. due strati: si attraversa prima l'uno e poi, forse, l'altro
    bool firstBonus = uHasBonus > 0.5 && p.y < ifaceY(p.xz);
    float L1 = L;
    float L2 = 0.0;
    if (uHasBonus > 0.5) {
      float Ai = p.y - ifaceY(p.xz);
      float Bi = rd2.y - dot(fromLiq(uIface.yz), rd2.xz);
      float ts = abs(Bi) > 1e-5 ? -Ai / Bi : -1.0;
      if (ts > 0.0 && ts < L) { L1 = ts; L2 = L - ts; }
    }
    float a1 = 1.0 - exp(-uDensity * L1);
    float a2 = 1.0 - exp(-uDensity * L2);
    vec3 col = layerColor(firstBonus, p + rd2 * (L1 * 0.5)) * a1
             + (1.0 - a1) * layerColor(!firstBonus, p + rd2 * (L1 + L2 * 0.5)) * a2;
    float alpha = a1 + (1.0 - a1) * a2;

    if (viaSurface) {
      vec3 nW = normalize(uRotW * nE);
      vec3 rdW = normalize(uRotW * rd);
      vec3 refl = envLight(reflect(rdW, nW));
      col = col * (1.0 - F) + refl * F;
      alpha = alpha * (1.0 - F) + F;
      float rim = smoothstep(uRI - 0.07, uRI - 0.004, length(p.xz));
      col += uShine * rim * 0.28;
    } else {
      float line = 1.0 - smoothstep(0.0, 0.028, s - p.y);
      col += uShine * line * 0.4 * alpha;
    }
    gl_FragColor = outPremul(col, alpha);
  }
`

export const VS_CAP = /* glsl */ `
  varying vec3 vModel;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vTanW;
  varying float vNy;
  void main() {
    vModel = position;
    vNy = normal.y;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    float ang = atan(position.x, position.z);
    vTanW = normalize(mat3(modelMatrix) * vec3(cos(ang), 0.0, -sin(ang)));
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

export const FS_CAP = /* glsl */ `
  ${COMMON}
  uniform vec3 uCapCol;
  varying vec3 vModel;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  varying vec3 vTanW;
  varying float vNy;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    // zigrinatura sul bordo del tappo
    float ang = atan(vModel.x, vModel.z);
    float side = 1.0 - smoothstep(0.3, 0.6, abs(vNy));
    n = normalize(n + side * 0.22 * sin(ang * 56.0) * normalize(vTanW));
    vec3 key = normalize(vec3(-0.85, 0.5, 0.45));
    float dif = max(dot(n, key), 0.0);
    float F = 0.04 + 0.96 * pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 5.0);
    vec3 col = uCapCol * (0.42 + 0.7 * dif) + envLight(reflect(-v, n)) * F * 0.5;
    gl_FragColor = vec4(toSRGB(col), 1.0);
  }
`

export const VS_POINTS = /* glsl */ `
  attribute float aSize;
  attribute float aKind;
  uniform vec3 uCam;
  uniform float uScale;
  uniform float uDensity;
  uniform float uRI;
  varying float vAtt;
  varying float vKind;
  void main() {
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = max(aSize * uScale / -mv.z, 1.0);
    vAtt = 1.0;
    // Le bolle stanno dentro il liquido: più sono lontane dal vetro, meno si vedono.
    if (aKind < 0.5) {
      vec3 toCam = normalize(uCam - position);
      float a = dot(toCam.xz, toCam.xz);
      float b = dot(position.xz, toCam.xz);
      float c = dot(position.xz, position.xz) - uRI * uRI;
      float t = a > 1e-6 ? (-b + sqrt(max(b * b - a * c, 0.0))) / a : 0.0;
      vAtt = exp(-uDensity * t * 0.75);
    }
  }
`

export const FS_POINTS = /* glsl */ `
  ${COMMON}
  uniform vec3 uShine;
  uniform vec3 uDrop;
  varying float vAtt;
  varying float vKind;
  void main() {
    vec2 q = gl_PointCoord * 2.0 - 1.0;
    float r = length(q);
    if (r > 1.0) discard;
    vec3 col;
    float a;
    if (vKind < 0.5) {
      float ring = smoothstep(0.5, 0.88, r) * (1.0 - smoothstep(0.88, 1.0, r));
      float spot = 1.0 - smoothstep(0.0, 0.32, length(q - vec2(-0.35, 0.35)));
      a = (ring * 0.6 + spot * 0.75) * vAtt;
      col = mix(uShine, vec3(1.0), 0.5) * a;
    } else {
      float edge = 1.0 - smoothstep(0.82, 1.0, r);
      float spot = 1.0 - smoothstep(0.0, 0.38, length(q - vec2(-0.3, 0.32)));
      a = edge * 0.95;
      col = mix(uDrop, vec3(1.0), spot * 0.7) * a;
    }
    gl_FragColor = outPremul(col, a);
  }
`

export const VS_STREAM = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPosW = w.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

export const FS_STREAM = /* glsl */ `
  ${COMMON}
  uniform vec3 uColor;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float cosv = abs(dot(n, v));
    float F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
    float core = 1.0 - exp(-3.0 * cosv);
    float a = 0.6 + 0.35 * core;
    vec3 col = uColor * (0.8 + 0.25 * core) * a * (1.0 - F) + envLight(reflect(-v, n)) * F;
    gl_FragColor = outPremul(col, a * (1.0 - F) + F);
  }
`

export const VS_SHADOW = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Ombra sotto la bottiglia e, spostata dalla parte opposta alla finestra, la luce colorata che passa dal liquido. */
export const FS_SHADOW = /* glsl */ `
  ${COMMON}
  uniform float uShadow;
  uniform float uCaustic;
  uniform vec3 uCausticCol;
  varying vec2 vUv;
  void main() {
    vec2 q = (vUv - 0.5) * 2.0;
    float sh = exp(-dot(q, q) * 3.2) * uShadow;
    vec2 c = (vUv - vec2(0.66, 0.6)) * 2.6;
    float ca = exp(-dot(c, c) * 4.0) * uCaustic;
    vec4 col = vec4(0.0, 0.0, 0.0, sh);
    col = vec4(uCausticCol * ca + col.rgb * (1.0 - ca), ca + col.a * (1.0 - ca));
    gl_FragColor = outPremul(col.rgb, col.a);
  }
`
