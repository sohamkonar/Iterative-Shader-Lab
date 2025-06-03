precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform float uAspect;

varying vec2 vUv;

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,
                      0.366025403784439,
                     -0.577350269189626,
                      0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
                  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), 
                          dot(x12.zw,x12.zw)), 0.0 );
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0+h*h );
  vec3 g = vec3(a0.x * x0.x + h.x * x0.y,
                a0.y * x12.x + h.y * x12.y,
                a0.z * x12.z + h.z * x12.w);
  return 130.0 * dot(m, g);
}

float waveHeight(vec2 p, float t) {
    float h = 0.0;
    h += 0.15 * sin(3.0*p.x + t*1.3);
    h += 0.10 * cos(4.0*p.y + t*1.7);
    h += 0.07 * sin(5.0*(p.x+p.y) + t*2.1);
    h += 0.05 * snoise(p*3.0 + t*0.5);
    return h;
}

vec3 getNormal(vec2 p, float t) {
    float eps = 0.001;
    float hL = waveHeight(p - vec2(eps,0.0), t);
    float hR = waveHeight(p + vec2(eps,0.0), t);
    float hD = waveHeight(p - vec2(0.0,eps), t);
    float hU = waveHeight(p + vec2(0.0,eps), t);
    vec3 n = normalize(vec3(hL - hR, 2.0*eps, hD - hU));
    return n;
}

float fresnel(vec3 viewDir, vec3 normal) {
    float base = 0.2;
    float power = 4.5;
    return base + (1.0 - base)*pow(1.0 - dot(viewDir, normal), power);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= uAspect;

    vec2 waterUV = uv * 3.0;

    float height = waveHeight(waterUV, uTime);

    vec3 normal = getNormal(waterUV, uTime);

    vec3 viewDir = normalize(vec3(0.0, 1.0, 1.5));

    float refractionStrength = 0.07;
    vec2 refractUV = vUv + normal.xz * refractionStrength;
    refractUV = clamp(refractUV, 0.0, 1.0);

    vec3 skyColor = mix(vec3(0.6,0.8,1.0), vec3(0.1,0.15,0.3), vUv.y);

    vec3 floorColor = vec3(0.12, 0.30, 0.28);

    vec3 bgColor = mix(floorColor, skyColor, smoothstep(0.4, 1.0, vUv.y));

    vec2 bgUV = refractUV;
    vec3 refractedColor = mix(floorColor, skyColor, smoothstep(0.4, 1.0, bgUV.y));

    float fresnelTerm = fresnel(viewDir, normal);

    vec3 lightDir = normalize(vec3(-0.3, 1.0, 0.8));

    float diff = max(dot(normal, lightDir), 0.0);

    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 60.0);

    vec3 waterColor = vec3(0.12, 0.46, 0.54);
    vec3 color = refractedColor * (1.0 - fresnelTerm)
                 + mix(waterColor * diff * 2.3, vec3(2.9), spec) * fresnelTerm;

    color *= 0.9 + 1.3 * height;

    gl_FragColor = vec4(color, 1.0);
}