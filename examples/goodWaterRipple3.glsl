precision mediump float;

varying vec2 vUv;
uniform float uTime;
uniform vec2 uMouseClick;
uniform int uIsMouseDown;
uniform float uAspect;

// Simple 2D noise function by iq: https://www.shadertoy.com/view/4dS3Wd
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    // Four corners in 2D of a tile
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    // Smooth interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
}

float ripple(vec2 uv, vec2 center, float time) {
    float dist = length(uv - center);
    float wave = sin(20.0 * dist - 6.0 * time);
    float attenuation = smoothstep(0.8, 0.0, dist);
    return wave * attenuation;
}

void main() {
    // Adapt UV for aspect ratio
    vec2 uv = vUv;
    uv.x *= uAspect;

    // Base color gradient resembling water depth
    vec3 baseColor = mix(vec3(0.0, 0.3, 0.5), vec3(0.0, 0.6, 0.9), uv.y);

    // Animate multiple sine waves for water surface
    float wave1 = sin(uv.x * 30.0 + uTime * 2.0) * 0.02;
    float wave2 = cos(uv.y * 25.0 - uTime * 1.5) * 0.015;
    float wave3 = sin((uv.x + uv.y) * 40.0 + uTime * 3.0) * 0.01;

    // Combine waves to displace UV for dynamic flow
    vec2 displacedUV = uv + vec2(wave1 + wave3, wave2 + wave3);

    // Add ripple effect from last mouse click location
    vec2 center = uMouseClick;
    center.x *= uAspect;
    float r = ripple(displacedUV, center, uTime);
    displacedUV += normalize(displacedUV - center) * r * 0.03;

    // Add subtle noise for water surface complexity
    float n = noise(displacedUV * 50.0 + uTime * 5.0) * 0.03;

    displacedUV += vec2(n);

    // Calculate lightness for fake light reflections using cosine waves
    float light = 0.5 + 0.5 * cos(30.0 * displacedUV.x + uTime * 5.0) * cos(30.0 * displacedUV.y + uTime * 4.0);
    light = pow(light, 3.0);

    // Final color modulated by light and waves
    vec3 color = baseColor + light * 0.15;

    // Add subtle specular highlight near ripple center (simulate light reflecting on waves)
    float spec = smoothstep(0.15, 0.0, length(displacedUV - center));
    color += vec3(0.3, 0.45, 0.6) * spec * light;

    gl_FragColor = vec4(color, 1.0);
}