// GLSL shared by the Earth sphere and the drifting land mesh, so both light identically and the
// crossfade between the photo globe and the deep-time globe is seamless at t = 0.

export const lightingChunk = /* glsl */ `
uniform vec3 uSun;
uniform float uDim;
uniform float uLights;
// ripple added to the surface normal for the sun's reflection only (set by the earth shader)
vec3 waveN = vec3(0.0);

vec3 desaturate(vec3 c, float a) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, vec3(l), a);
}

// albedo -> lit colour with soft terminator, rim haze and a hint of warm dusk
vec3 shade(vec3 albedo, vec3 N, vec3 V, float water, vec3 nightLights) {
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.12, 0.22, ndl);
  vec3 col = albedo * (0.025 + 1.2 * max(ndl * 0.85 + 0.15, 0.0) * day);

  // ocean: a tight sun glint plus a broad sheen, and the sky reflected at grazing angles (Fresnel)
  vec3 H = normalize(uSun + V);
  float nh = max(dot(normalize(N + waveN), H), 0.0);
  float spec = (pow(nh, 180.0) * 1.1 + pow(nh, 24.0) * 0.07) * water * day;
  col += vec3(1.0, 0.94, 0.84) * spec * 0.7;
  float fres0 = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += vec3(0.30, 0.52, 0.85) * fres0 * water * day * 0.18;

  // dusk band along the terminator
  col += vec3(1.0, 0.45, 0.18) * 0.05 * exp(-pow(ndl / 0.09, 2.0));

  // atmospheric haze toward the limb, only on the lit side
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col = mix(col, vec3(0.35, 0.62, 1.0) * (0.25 + 0.75 * day), fres * 0.55 * (0.15 + 0.85 * day));

  // city lights on the night side
  col += nightLights * (1.0 - day) * uLights;

  // focus dim: desaturate and darken the world around a selection
  col = mix(col, desaturate(col, 0.85) * 0.42, uDim);
  return col;
}
`

export const earthVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const earthFragment = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uData;
uniform sampler2D uIceMap;
uniform sampler2D uRelief;
uniform sampler2D uClouds;
uniform float uCloudShadow;
uniform float uCloudOffset;
uniform float uReliefAmt;
uniform vec2 uReliefTexel;
uniform float uDrift;
uniform float uSea;
uniform float uIce;
uniform float uGreen;
uniform float uTime;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
${lightingChunk}

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  vec3 N0 = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 data = texture2D(uData, vUv).rgb;
  float land = data.r;
  float depth = (1.0 - data.g) * 11000.0 + 22.0;

  // local frame on the sphere: east and north
  vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), N0) + vec3(1e-5, 0.0, 0.0));
  vec3 north = cross(N0, east);
  vec3 N = N0;

  // mountains: light the relief from the real elevation (GEBCO), stronger as the camera comes close
  if (uReliefAmt > 0.0) {
    float h = texture2D(uRelief, vUv).r;
    float hx = texture2D(uRelief, vUv + vec2(uReliefTexel.x, 0.0)).r - texture2D(uRelief, vUv - vec2(uReliefTexel.x, 0.0)).r;
    float hy = texture2D(uRelief, vUv + vec2(0.0, uReliefTexel.y)).r - texture2D(uRelief, vUv - vec2(0.0, uReliefTexel.y)).r;
    // the texture is square-root encoded: undo it so slopes scale with real height
    float k = uReliefAmt * (0.6 + 1.6 * h);
    N = normalize(N0 - (east * hx + north * hy) * k * land);
  }

  // ocean surface: slow wind-driven waves perturb the normal (only matters where the sun glints)
  float sea = (1.0 - land);
  if (sea > 0.01) {
    vec2 p = vUv * vec2(1100.0, 550.0);
    float t = uTime * 0.08;
    float w1 = noise(p + vec2(t, t * 0.7)) - 0.5;
    float w2 = noise(p * 2.3 - vec2(t * 1.3, t * 0.4)) - 0.5;
    float w3 = noise(p * 0.21 + vec2(t * 0.3, 0.0)) - 0.5;
    waveN = (east * (w1 + w3 * 1.4) + north * (w2 + w3)) * 0.028 * sea;
  }

  // shelves exposed by lower sea level (Beringia, Doggerland, Sundaland...)
  float exposed = (1.0 - land) * smoothstep(depth - 12.0, depth + 12.0, -uSea);
  vec3 steppe = mix(vec3(0.30, 0.29, 0.20), vec3(0.42, 0.39, 0.28), noise(vUv * 900.0));
  vec3 albedo = mix(day, steppe * 0.75, exposed);

  // Green Sahara: in the African Humid Period the desert belt (about 15-30 N, Atlantic to Red Sea)
  // was grassland and lakes. Only sandy, bright desert pixels in that band are greened.
  if (uGreen > 0.0) {
    float lon = vUv.x * 360.0 - 180.0;
    // ragged edges: the wet belt's limits are known only roughly, and were never straight lines
    float lat = vUv.y * 180.0 - 90.0 + (noise(vUv * vec2(60.0, 30.0)) - 0.5) * 7.0;
    float band = smoothstep(8.0, 13.0, lat) * (1.0 - smoothstep(27.0, 32.0, lat))
               * smoothstep(-18.0, -14.0, lon) * (1.0 - smoothstep(33.0, 37.0, lon));
    float sandy = smoothstep(0.02, 0.09, day.r - day.b) * smoothstep(0.16, 0.3, dot(day, vec3(0.333)));
    vec3 savanna = mix(vec3(0.17, 0.27, 0.08), vec3(0.33, 0.36, 0.16), noise(vUv * 700.0) * 0.6 + noise(vUv * 90.0) * 0.4);
    albedo = mix(albedo, savanna, uGreen * band * sandy * land * 0.92);
  }

  // ice sheets at glacial maxima
  float ice = texture2D(uIceMap, vUv).r * uIce;
  albedo = mix(albedo, vec3(0.80, 0.87, 0.93), smoothstep(0.15, 0.6, ice));

  // deep-time ocean replaces the photo; the drifting land mesh is drawn on top
  float n = noise(vUv * vec2(40.0, 20.0)) * 0.5 + noise(vUv * vec2(160.0, 80.0)) * 0.5;
  vec3 deepOcean = mix(vec3(0.010, 0.040, 0.085), vec3(0.020, 0.075, 0.13), n);
  albedo = mix(albedo, deepOcean, uDrift);

  // shallow seas read turquoise, the deep ocean darker (bathymetry from GEBCO)
  float shallow = (1.0 - land) * (1.0 - exposed) * (1.0 - smoothstep(30.0, 220.0, depth)) * (1.0 - uDrift);
  albedo = mix(albedo, albedo * vec3(0.75, 1.12, 1.08) + vec3(0.0, 0.025, 0.03), shallow * 0.8);
  float deep = (1.0 - land) * smoothstep(1500.0, 6000.0, depth) * (1.0 - uDrift);
  albedo *= 1.0 - deep * 0.12;

  // clouds cast shadows: the cloud layer sampled a little toward the sun
  if (uCloudShadow > 0.0) {
    vec2 toSun = vec2(dot(uSun, east), dot(uSun, north)) * vec2(0.0016, 0.0032);
    float cs = smoothstep(0.25, 0.9, texture2D(uClouds, vUv + vec2(uCloudOffset, 0.0) - toSun).r);
    albedo *= 1.0 - cs * uCloudShadow * 0.42 * (1.0 - uDrift);
  }

  float water = mix((1.0 - land) * (1.0 - exposed) * (1.0 - smoothstep(0.2, 0.5, ice)), 1.0, uDrift);
  vec3 lights = pow(texture2D(uNight, vUv).rgb, vec3(1.4)) * vec3(1.6, 1.25, 0.85) * 1.8 * (1.0 - uDrift);

  gl_FragColor = vec4(shade(albedo, N, V, water, lights), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const driftVertex = /* glsl */ `
attribute vec3 aPosA;
attribute vec3 aPosB;
attribute vec2 aUv;
attribute float aOkA;
attribute float aOkB;
uniform float uMix;
uniform float uLift;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vOk;
void main() {
  vec3 p = normalize(mix(aPosA, aPosB, uMix));
  vOk = mix(aOkA, aOkB, uMix);
  vUv = aUv;
  vN = normalize(mat3(modelMatrix) * p);
  vec4 w = modelMatrix * vec4(p * uLift, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

export const driftFragment = /* glsl */ `
uniform sampler2D uDay;
uniform sampler2D uData;
uniform float uOpacity;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uSnow;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
varying float vOk;
${lightingChunk}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 day = texture2D(uDay, vUv).rgb;
  float land = texture2D(uData, vUv).r;
  // coastal triangles may sample ocean pixels after simplification: use a neutral land colour there
  vec3 albedo = mix(vec3(0.22, 0.24, 0.16), day, smoothstep(0.2, 0.7, land));
  // Deep time: today's vegetation and ice are anachronistic, so keep only the relief/texture
  // variation of the photo (clamped luminance) and colour it with the period palette.
  float lum = clamp(dot(albedo, vec3(0.2126, 0.7152, 0.0722)), 0.06, 0.32);
  vec3 period = uTint * (0.42 + lum * 1.25);
  albedo = mix(albedo, period, uTintAmt);
  albedo = mix(albedo, vec3(0.82, 0.88, 0.94), uSnow);
  if (vOk < 0.05) discard;
  // ghost crust (inferred positions) stays faint; reconstructed crust is solid
  gl_FragColor = vec4(shade(albedo, N, V, 0.0, vec3(0.0)), uOpacity * (vOk > 0.5 ? 1.0 : vOk * 1.6));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export const atmosphereVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`

// Physically based sky: single Rayleigh and Mie scattering of sunlight, ray-marched through a
// shell of radius uShell around the unit planet (after Nishita et al. 1993; coefficients for
// Earth's air scaled to planet radii, the shell a little thicker than real so it reads at globe
// scale). Rendered on the shell's back faces with additive blending: blue limb by day, reddening
// toward the terminator, a thin deep-blue line on the night side.
export const atmosphereFragment = /* glsl */ `
uniform vec3 uSun;
uniform float uIntensity;
uniform float uShell;
uniform float uSteps;
varying vec3 vN;
varying vec3 vWorld;

const vec3 BR = vec3(5.8e-6, 13.5e-6, 33.1e-6) * 6.371e6; // Rayleigh, per planet radius
const float BM = 21e-6 * 6.371e6;                          // Mie
const float G = 0.76;

vec2 sphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  float H = uShell - 1.0;
  float HR = H * 0.18;  // density scale heights, as fractions of the shell
  float HM = H * 0.06;
  // keep Earth's real optical depths (scale heights 8 km and 1.2 km) in the thicker shell
  vec3 bR = BR * (0.00126 / HR);
  float bM = BM * (0.000188 / HM);
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - cameraPosition);
  vec2 a = sphere(ro, rd, uShell);
  vec2 p = sphere(ro, rd, 1.0);
  float t0 = max(a.x, 0.0);
  float t1 = p.x > 0.0 ? min(a.y, p.x) : a.y;
  if (t1 <= t0) discard;
  float ds = (t1 - t0) / uSteps;
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= uSteps) break;
    vec3 x = ro + rd * (t0 + ds * (float(i) + 0.5));
    float hgt = length(x) - 1.0;
    float dR = exp(-hgt / HR) * ds;
    float dM = exp(-hgt / HM) * ds;
    odR += dR;
    odM += dM;
    // light path to the sun: skip samples in the planet's shadow
    vec2 ps = sphere(x, uSun, 1.0);
    if (ps.x > 0.0) continue;
    float tl = sphere(x, uSun, uShell).y;
    float dl = tl / 4.0, lR = 0.0, lM = 0.0;
    for (int j = 0; j < 4; j++) {
      vec3 y = x + uSun * dl * (float(j) + 0.5);
      float hy = length(y) - 1.0;
      lR += exp(-hy / HR) * dl;
      lM += exp(-hy / HM) * dl;
    }
    vec3 tau = bR * (odR + lR) + bM * 1.1 * (odM + lM);
    vec3 att = exp(-tau);
    sumR += dR * att;
    sumM += dM * att;
  }
  float mu = dot(rd, uSun);
  float phR = 0.0597 * (1.0 + mu * mu);
  float phM = 0.1194 * ((1.0 - G * G) * (1.0 + mu * mu)) / ((2.0 + G * G) * pow(1.0 + G * G - 2.0 * G * mu, 1.5));
  vec3 col = (sumR * bR * phR + sumM * bM * phM) * uIntensity;
  // a faint airglow so the night limb is not black
  float limb = clamp(1.0 - abs(dot(normalize(vN), rd)), 0.0, 1.0);
  col += vec3(0.03, 0.06, 0.16) * pow(limb, 6.0) * 0.35;
  col = 1.0 - exp(-col);
  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));
}
`

export const cloudFragment = /* glsl */ `
uniform sampler2D uClouds;
uniform vec3 uSun;
uniform float uOpacity;
uniform float uDim;
uniform float uOffset;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vN);
  float c = texture2D(uClouds, vUv + vec2(uOffset, 0.0)).r;
  c = smoothstep(0.18, 0.9, c);
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.1, 0.25, ndl);
  vec3 col = vec3(1.0) * (0.04 + 0.96 * day) + vec3(1.0, 0.55, 0.3) * 0.12 * exp(-pow(ndl / 0.1, 2.0));
  float a = c * uOpacity * (0.25 + 0.75 * day) * (1.0 - 0.6 * uDim);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
