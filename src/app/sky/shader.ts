import { BASE_CLOUD_SPEED } from '../../domain/skyUniforms';

/** A GLSL float literal: `2` would be an int and fail to compile next to floats. */
const glslFloat = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

/** One triangle that covers the whole screen. */
export const VERTEX_SRC = `attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

/**
 * The sky, layer by layer (spec 6.4). Screen coordinates have y measured from the TOP, like
 * `sunPos` and `sunZone`. Colour is sRGB-encoded 0–1, which is what the canvas outputs.
 *
 * Colour math runs at mediump. Coordinates fed to the noise and the time run at highp where the
 * GPU has it: the sin hash returns only zeros in fp16, and iPhones run mediump as fp16.
 */
export const FRAGMENT_SRC = `precision mediump float;
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define HI highp
#else
#define HI mediump
#endif
#define BASE_CLOUD_SPEED ${glslFloat(BASE_CLOUD_SPEED)}
// The clamp aims this far under uMaxLuma, so 8-bit rounding and mediump error stay under it.
#define LUMA_HEADROOM 0.97
// Above this share of the cap, luminance is compressed smoothly towards it.
#define KNEE 0.85
// WCAG relative luminance weights, applied to linear RGB.
#define LUMA vec3(0.2126, 0.7152, 0.0722)
// Where the moon hangs, in screen fractions: inside the sun zone, top right.
#define MOON vec2(0.78, 0.1)

uniform HI float uTime;
// Cloud travel: the time integral of uCloudSpeed, so changing the speed never jumps the clouds.
uniform HI float uDrift;
uniform HI vec2 uResolution;
uniform vec3 uSkyTop;
uniform vec3 uSkyBottom;
uniform vec2 uSunPos;
uniform float uSunIntensity;
uniform float uMoon;
uniform float uStars;
uniform float uCloudCover;
uniform float uCloudDark;
uniform float uCloudSpeed;
uniform float uFog;
uniform float uRain;
uniform float uSnow;
uniform float uGlassDrops;
uniform float uHeat;
uniform float uFlash;
uniform float uMaxLuma;
uniform float uSunZone;
uniform int uOctaves;

HI float hash(HI vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

float noise(HI vec2 p) {
  HI vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), s.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), s.x), s.y);
}

// Normalised to 0–1 whatever the octave count, so cover thresholds hold on low quality too.
float fbm(HI vec2 p) {
  float v = 0.0, a = 0.5, total = 0.0;
  for (int i = 0; i < 4; i++) {
    if (i >= uOctaves) break;
    v += a * noise(p);
    total += a;
    p = p * 2.03 + vec2(17.1, 9.2);
    a *= 0.5;
  }
  return v / total;
}

// Water on the glass: an 8x14 grid, a few cells hold a drop, some columns slide slowly.
// Returns the UV shift of the lens (xy), its mask (z) and a specular glint (w).
vec4 drops(HI vec2 uv, float aspect) {
  HI vec2 g = uv * vec2(8.0, 14.0);
  float lane = hash(vec2(floor(g.x), 3.7));
  g.y -= step(0.7, lane) * uTime * (0.05 + 0.1 * lane);
  HI vec2 id = floor(g);
  float h = hash(id + 0.5);
  float on = step(1.0 - 0.3 * uGlassDrops, h) * smoothstep(0.0, 0.2, uGlassDrops);
  vec2 c = (vec2(fract(h * 13.0), fract(h * 29.0)) - 0.5) * 0.4;
  vec2 d = (fract(g) - 0.5 - c) * vec2(1.75 * aspect, 1.0);
  float r = mix(0.12, 0.26, fract(h * 47.0));
  float m = on * smoothstep(r, r * 0.7, length(d));
  vec2 shift = -2.5 * m * (fract(g) - 0.5 - c) / vec2(8.0, 14.0);
  float glint = on * smoothstep(r * 0.3, 0.0, length(d + vec2(0.3, 0.35) * r));
  return vec4(shift, m, glint);
}

// Slanted streaks: columns of tall cells, staggered, scrolling down along the slant.
float rainLayer(HI vec2 p, float scale, float speed, float slant) {
  HI vec2 q = vec2((p.x + p.y * slant) * scale, (p.y - uTime * speed) * scale / 8.0);
  HI float column = floor(q.x);
  q.y += hash(vec2(column, scale)) * 7.0;
  float h = hash(vec2(column, floor(q.y)) + scale);
  vec2 f = fract(q);
  float across = smoothstep(0.07, 0.0, abs(f.x - 0.5 - (h - 0.5) * 0.6));
  float along = (f.y - 0.1 - 0.4 * fract(h * 17.0)) / 0.45;
  float on = step(h, 0.25 + 0.6 * uRain);
  return on * across * smoothstep(0.0, 1.0, along) * smoothstep(1.0, 0.85, along);
}

// Round flakes, one per cell at most, swaying sideways as they fall.
float snowLayer(HI vec2 p, float scale, float speed) {
  HI vec2 q = (p - vec2(0.0, uTime * speed)) * scale;
  HI vec2 id = floor(q);
  float h = hash(id + scale);
  vec2 o = (vec2(h, fract(h * 23.0)) - 0.5) * 0.4;
  o.x += 0.22 * sin(uTime * (0.6 + h) + h * 6.2832);
  float r = mix(0.05, 0.1, fract(h * 7.0));
  float on = step(h, 0.3 + 0.5 * uSnow);
  return on * smoothstep(r, r * 0.2, length(fract(q) - 0.5 - o));
}

// sRGB <-> linear, with the thresholds of src/domain/contrast.ts.
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.03928, c)); }
vec3 toSrgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.00304, c)); }

void main() {
  HI vec2 px = gl_FragCoord.xy / uResolution;
  HI vec2 uv = vec2(px.x, 1.0 - px.y);
  float aspect = uResolution.x / uResolution.y;
  float cap = uMaxLuma * LUMA_HEADROOM;
  // A grey of exactly the capped luminance: the brightest a lit cloud needs to be.
  vec3 capGrey = toSrgb(vec3(cap));

  // 7 and 9 bend the view, so they run first: glass drops refract, heat shimmers the bottom 25%.
  vec4 drop = uGlassDrops > 0.001 ? drops(uv, aspect) : vec4(0.0);
  HI vec2 s = uv + drop.xy;
  s.x += uHeat * smoothstep(0.75, 1.0, uv.y) * 0.004 * sin(uv.y * 120.0 + uTime * 4.0);
  // Isotropic coordinates, in screen heights.
  HI vec2 p = vec2(s.x * aspect, s.y);

  // 1. Gradient.
  vec3 col = mix(uSkyTop, uSkyBottom, smoothstep(-0.05, 1.05, s.y));
  float day = smoothstep(0.08, 0.45, dot(mix(uSkyTop, uSkyBottom, 0.5), vec3(0.299, 0.587, 0.114)));

  // 2. Stars, twinkling, thinning towards the horizon.
  if (uStars > 0.001) {
    HI vec2 g = p * 90.0;
    HI vec2 id = floor(g);
    float h = hash(id);
    vec2 o = (vec2(hash(id + 7.0), fract(h * 91.0)) - 0.5) * 0.5;
    float star = step(0.982, h) * smoothstep(0.35, 0.0, length(fract(g) - 0.5 - o));
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + 2.0 * fract(h * 31.0)) + h * 60.0);
    col += vec3(0.9, 0.93, 1.0) * star * twinkle * uStars * (1.0 - smoothstep(0.3, 0.8, s.y));
  }

  // 3. Sun: disc and core glow go to \`light\`, the only colour allowed past the cap, and only in
  // the sun zone: the disc fades out over 3% and the glow over 10%, both ending 1% above the zone
  // line, so the bilinear upscale of the canvas cannot carry any of it below the line.
  // The wide bloom and a faint 22-degree halo with a rainbow rim stay in the sky.
  vec2 sun = vec2(uSunPos.x * aspect, uSunPos.y);
  float d = length(p - sun);
  vec3 sunCol = vec3(1.0, 0.93, 0.8);
  float inZone = 1.0 - smoothstep(uSunZone - 0.04, uSunZone - 0.01, uv.y);
  vec3 light = sunCol * (smoothstep(0.036, 0.016, d) * min(1.0, uSunIntensity * 4.0) * inZone
    + exp(-d * 14.0) * 0.75 * uSunIntensity * (1.0 - smoothstep(uSunZone - 0.11, uSunZone - 0.01, uv.y)));
  col += sunCol * exp(-d * 3.0) * 0.22 * uSunIntensity;
  float ring = (d - 0.22) / 0.018;
  vec3 rainbow = 0.6 + 0.4 * cos(6.2832 * ((d - 0.22) / 0.04 + vec3(0.0, 0.33, 0.67)));
  col += rainbow * exp(-ring * ring) * 0.07 * uSunIntensity;

  // 3. Moon: a soft, slightly mottled disc with a cool glow.
  float md = length(p - MOON * vec2(aspect, 1.0));
  light += vec3(0.93, 0.95, 1.0) * (0.92 - 0.15 * noise(p * 60.0)) * smoothstep(0.03, 0.026, md) * uMoon * inZone;
  col += vec3(0.6, 0.7, 0.9) * exp(-md * 9.0) * 0.18 * uMoon;

  // 4. Clouds: domain-warped fbm drifting with the wind, lit up to the cap from the sun side,
  // darkened by uCloudDark at their thick cores, brightened by lightning. They hide the sun.
  if (uCloudCover > 0.001) {
    // A heavy cover greys the whole sky first, so its gaps are never a saturated blue.
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))) * vec3(0.94, 0.98, 1.08),
      uCloudCover * uCloudCover * 0.6);
    HI vec2 cp = p * vec2(1.2, 3.6) + vec2(uDrift * 2.0, 0.0);
    float n = fbm(cp + 0.6 * fbm(cp + vec2(0.0, uDrift)));
    // n is roughly normal around 0.5: this edge makes the covered share ~ uCloudCover.
    float edge = mix(0.6, 0.14, uCloudCover);
    // Light cover stays thin and see-through; heavy cover closes up.
    float density = smoothstep(edge, edge + 0.2, n) * mix(0.65, 1.0, uCloudCover);
    float core = smoothstep(edge, edge + 0.35, n);
    vec3 lit = mix(vec3(0.2, 0.23, 0.3), capGrey * vec3(0.95, 1.0, 1.08), day);
    vec3 cloud = mix(lit, lit * 0.42, uCloudDark * (0.4 + 0.6 * core));
    cloud = mix(cloud, col, 0.3);
    cloud += vec3(1.0, 0.88, 0.7) * exp(-d * 3.5) * uSunIntensity * (1.0 - core) * 0.35;
    cloud += vec3(0.85, 0.88, 1.0) * uFlash * (0.5 + 0.5 * n);
    col = mix(col, cloud, density);
    light *= (1.0 - density) * (1.0 - 0.7 * uCloudCover * uCloudCover);
  }
  // 8. Lightning also lifts the whole sky a little.
  col += vec3(0.8, 0.85, 1.0) * uFlash * 0.12;

  // 5. Fog: an even veil, thicker towards the bottom.
  float fog = uFog * mix(0.45, 0.9, s.y);
  col = mix(col, mix(capGrey, uSkyBottom, 0.35) * mix(0.35, 1.0, day), fog);
  light *= 1.0 - fog;

  // 6. Rain: three depths of slanted streaks; wind (double cloud speed) tilts them further.
  if (uRain > 0.001) {
    float slant = mix(0.12, 0.32, clamp(uCloudSpeed / BASE_CLOUD_SPEED - 1.0, 0.0, 1.0));
    float r = rainLayer(p, 22.0, 2.4, slant) * 0.6
      + rainLayer(p, 40.0, 1.8, slant) * 0.4
      + rainLayer(p + 3.1, 70.0, 1.2, slant) * 0.25;
    col += vec3(0.82, 0.87, 0.95) * r * uRain * 0.35;
  }
  // 6. Snow: three depths of flakes.
  if (uSnow > 0.001) {
    float f = snowLayer(p, 9.0, 0.12) + snowLayer(p + 1.7, 16.0, 0.08) * 0.7
      + snowLayer(p + 4.3, 26.0, 0.05) * 0.45;
    col += vec3(0.95) * f * uSnow * 0.8;
  }

  // 7. Drops catch a little light and a glint.
  col += (0.05 + 0.5 * drop.w) * drop.z;

  // Everything but \`light\` is held under the cap on the whole screen, with a soft knee that keeps
  // cloud shading, so the sun zone's edge never shows as a band. Dither against banding first.
  col = clamp(col + (hash(gl_FragCoord.xy) - 0.5) / 255.0, 0.0, 1.0);
  vec3 lin = toLinear(col);
  float x = dot(lin, LUMA) / cap;
  if (x > KNEE) col = toSrgb(lin * (KNEE + (1.0 - KNEE) * (1.0 - exp((KNEE - x) / (1.0 - KNEE)))) / x);
  col += light;

  // 10. Brightness clamp, the last colour step and the guarantee the glass relies on: below the
  // sun zone, scale in linear light so the WCAG luminance of the output is at most uMaxLuma
  // (minus headroom for 8-bit rounding and mediump error). By now it only catches rounding.
  if (uv.y > uSunZone) {
    col = clamp(col, 0.0, 1.0);
    lin = toLinear(col);
    col = toSrgb(lin * min(1.0, cap / max(dot(lin, LUMA), 1e-4)));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;
