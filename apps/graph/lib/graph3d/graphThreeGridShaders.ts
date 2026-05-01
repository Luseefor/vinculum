export const GRID_VERTEX_SHADER = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const GRID_FRAGMENT_SHADER = `
uniform float uMinorStep;
uniform float uMajorStep;
uniform float uFadeDistance;
uniform vec2 uGridOffset;
uniform vec3 uCameraPosition;
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform int uPlaneMode;

varying vec3 vWorldPosition;

float lineIntensity(vec2 coord, float step) {
  vec2 scaled = coord / step;
  vec2 grid = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), vec2(0.0001));
  float dist = min(grid.x, grid.y);
  return 1.0 - min(dist, 1.0);
}

void main() {
  float safeMinorStep = max(uMinorStep, 0.0001);
  float safeMajorStep = max(uMajorStep, 0.0001);

  vec2 gridCoord;
  vec2 camCoord;
  if (uPlaneMode == 1) {
    gridCoord = vWorldPosition.xy - uGridOffset;
    camCoord = uCameraPosition.xy;
  } else if (uPlaneMode == 2) {
    gridCoord = vWorldPosition.yz - uGridOffset;
    camCoord = uCameraPosition.yz;
  } else {
    gridCoord = vWorldPosition.xz - uGridOffset;
    camCoord = uCameraPosition.xz;
  }
  float major = lineIntensity(gridCoord, safeMajorStep);
  float minor = lineIntensity(gridCoord, safeMinorStep);
  float minorMasked = minor * (1.0 - major);

  float radialDistance = distance(gridCoord + uGridOffset, camCoord);
  float fade = 1.0 - smoothstep(uFadeDistance * 0.12, uFadeDistance * 0.88, radialDistance);

  vec3 color = (uMinorColor * minorMasked) + (uMajorColor * major);
  float alpha = ((minorMasked * 0.38) + (major * 0.82)) * fade;

  if (alpha <= 0.001) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
`;
