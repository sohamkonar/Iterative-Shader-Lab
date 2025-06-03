precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec2 uMouseClick;
uniform int uIsMouseDown;
uniform int uFrame;
uniform float uAspect;

varying vec2 vUv;

// Simple 2D noise function by IQ
float hash(vec2 p) {
    p = fract(p*vec2(123.34, 456.21));
    p += dot(p, p+45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    vec2 u = f*f*(3.0-2.0*f);

    return mix(a, b, u.x) +
           (c - a)* u.y * (1.0 - u.x) +
           (d - b)* u.x * u.y;
}

void main() {
    // Normalize UV so that aspect ratio is preserved
    vec2 uv = vUv;
    uv.x *= uAspect;

    // Base coordinates for ripples
    vec2 pos = uv * 10.0;

    // Animate ripples over time
    float t = uTime * 2.0;

    // Multiple layers of sine waves for ripples
    float ripple = 0.0;
    ripple += sin(pos.x * 3.0 + t);
    ripple += sin(pos.y * 3.0 + t * 1.5);
    ripple += sin((pos.x + pos.y) * 4.0 + t * 1.2);
    ripple += sin(length(pos - vec2(5.0)) * 6.0 - t * 2.5);

    // Add small noise for water surface detail
    float n = noise(pos + vec2(t*0.5));

    ripple += n * 0.5;

    ripple /= 4.5; // normalize roughly [-1..1]

    // Map ripple to blue gradient colors
    vec3 waterColor = vec3(0.0, 0.3, 0.6) + ripple * 0.1;

    // Add some reflection effect
    float reflect = smoothstep(0.3, 0.5, ripple);

    waterColor += reflect * 0.1;

    // Gamma correction
    waterColor = pow(waterColor, vec3(0.4545));

    gl_FragColor = vec4(waterColor, 1.0);
}