// GLSL shared by the Earth sphere and the drifting land mesh, so both light identically and the
// crossfade between the photo globe and the deep-time globe is seamless at t = 0.

export const lightingChunk = /* glsl */ `
uniform vec3 uSun;
uniform float uDim;
uniform float uLights;

vec3 desaturate(vec3 c, float a) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, vec3(l), a);
}

// albedo -> lit colour with soft terminator, rim haze and a hint of warm dusk
vec3 shade(vec3 albedo, vec3 N, vec3 V, float water, vec3 nightLights) {
  float ndl = dot(N, uSun);
  float day = smoothstep(-0.12, 0.22, ndl);
  vec3 col = albedo * (0.025 + 1.2 * max(ndl * 0.85 + 0.15, 0.0) * day);

  // ocean glint
  vec3 H = normalize(uSun + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) * water * day;
  col += vec3(1.0, 0.93, 0.82) * spec * 0.55;

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
uniform float uDrift;
uniform float uSea;
uniform float uIce;
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
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 day = texture2D(uDay, vUv).rgb;
  vec3 data = texture2D(uData, vUv).rgb;
  float land = data.r;
  float depth = (1.0 - data.g) * 11000.0 + 22.0;

  // shelves exposed by lower sea level (Beringia, Doggerland, Sundaland...)
  float exposed = (1.0 - land) * smoothstep(depth - 12.0, depth + 12.0, -uSea);
  vec3 steppe = mix(vec3(0.30, 0.29, 0.20), vec3(0.42, 0.39, 0.28), noise(vUv * 900.0));
  vec3 albedo = mix(day, steppe * 0.75, exposed);

  // ice sheets at glacial maxima
  float ice = texture2D(uIceMap, vUv).r * uIce;
  albedo = mix(albedo, vec3(0.80, 0.87, 0.93), smoothstep(0.15, 0.6, ice));

  // deep-time ocean replaces the photo; the drifting land mesh is drawn on top
  float n = noise(vUv * vec2(40.0, 20.0)) * 0.5 + noise(vUv * vec2(160.0, 80.0)) * 0.5;
  vec3 deepOcean = mix(vec3(0.010, 0.040, 0.085), vec3(0.020, 0.075, 0.13), n);
  albedo = mix(albedo, deepOcean, uDrift);

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

// Rendered on the back faces of a shell of radius uShell: brightest at the planet's limb, fading
// to nothing at the shell edge, lit by the sun so the night limb stays a faint deep-blue line.
export const atmosphereFragment = /* glsl */ `
uniform vec3 uSun;
uniform float uIntensity;
uniform float uShell;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  float limb = sqrt(uShell * uShell - 1.0) / uShell;
  float d = clamp(-dot(V, N) / limb, 0.0, 1.0);
  float sun = smoothstep(-0.35, 0.55, dot(N, uSun));
  vec3 col = mix(vec3(0.10, 0.25, 0.75), vec3(0.45, 0.75, 1.0), sun);
  float a = pow(d, 2.6) * (0.08 + 0.92 * sun) * uIntensity;
  gl_FragColor = vec4(col * a, a);
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
