precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouseClick;
uniform int uIsMouseDown;
uniform float uAspect;
varying vec2 vUv;

void main() {
    // Normalize UV so that aspect ratio is considered
    vec2 uv = vUv;
    uv.x *= uAspect;

    // Ripple source position - use last click or center if none
    vec2 center = vec2(0.5 * uAspect, 0.5);
    vec2 src = center;
    if(uIsMouseDown == 1) {
        src = vec2(uMouseClick.x * uAspect, uMouseClick.y);
    }

    // Distance from ripple center
    float dist = distance(uv, src);

    // Parameters for ripple
    float waveFrequency = 20.0;
    float waveSpeed = 3.0;
    float waveAmplitude = 0.015;

    // Animate ripple based on distance and time
    float wave = sin((dist * waveFrequency) - (uTime * waveSpeed));

    // Displacement for refraction effect
    // Derivative of sine wave to simulate slope for distortion
    float displacement = wave * waveAmplitude;

    // Calculate gradient direction of wave using partial derivatives approximation
    // Approximate small offset for gradient
    float delta = 0.001;
    float waveX1 = sin(((distance(uv + vec2(delta,0.0), src)) * waveFrequency) - (uTime * waveSpeed));
    float waveX2 = sin(((distance(uv - vec2(delta,0.0), src)) * waveFrequency) - (uTime * waveSpeed));
    float gradX = (waveX1 - waveX2) / (2.0 * delta);

    float waveY1 = sin(((distance(uv + vec2(0.0, delta), src)) * waveFrequency) - (uTime * waveSpeed));
    float waveY2 = sin(((distance(uv - vec2(0.0, delta), src)) * waveFrequency) - (uTime * waveSpeed));
    float gradY = (waveY1 - waveY2) / (2.0 * delta);

    vec2 grad = vec2(gradX, gradY);

    // Refraction offset vector (simulated)
    vec2 offset = grad * waveAmplitude * 0.5;

    // Apply offset to uv coordinate (inverse distortion to simulate light bending)
    vec2 refractedUV = uv + offset;

    // Keep refractedUV in bounds for stable color lookup
    refractedUV = clamp(refractedUV, vec2(0.0), vec2(uAspect, 1.0));

    // Create a simple background color gradient (vertical)
    vec3 baseColor = mix(vec3(0.0, 0.3, 0.6), vec3(0.7, 0.9, 1.0), refractedUV.y);

    // Add some color variation based on horizontal position for more watery look
    baseColor *= 0.8 + 0.2 * sin(refractedUV.x * 20.0 + uTime * 3.0);

    // Output final color
    gl_FragColor = vec4(baseColor, 1.0);
}