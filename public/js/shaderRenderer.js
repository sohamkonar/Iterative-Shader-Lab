// shaderRenderer.js - WebGL and shader rendering related code

/**
 * Shader Renderer - Handles WebGL initialization, shader compilation and rendering
 * Following the Shadertoy model where only fragment shaders are editable
 */

// Global variables
let gl;
let canvas;
let shaderProgram;
let positionBuffer;

// Fixed vertex shader (not editable by users)
const fixedVertexShader = `attribute vec2 position;
varying vec2 vUv;

void main() {
    vUv = position * 0.5 + 0.5; // Map from [-1,1] to [0,1]
    gl_Position = vec4(position, 0.0, 1.0);
}`;

// Default fragment shader
const defaultFragmentShader = `precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform vec2 uMouseClick;
uniform int uIsMouseDown;
uniform int uFrame;
uniform float uAspect;

void main() {
    vec2 uv = vUv;
    vec3 color = 0.5 + 0.5 * cos(uTime + uv.xyx + vec3(0, 2, 4));
    gl_FragColor = vec4(color, 1.0);
}`;

/**
 * Initialize WebGL
 * @param {HTMLCanvasElement} canvasElement - The canvas element to use
 * @param {Function} onShaderSetupComplete - Callback for when initial shader setup is complete
 * @returns {WebGLRenderingContext} - WebGL context
 */
function initWebGL(canvasElement, onShaderSetupComplete = null) {
    canvas = canvasElement;
    gl = canvas.getContext('webgl');

    if (!gl) {
        throw new Error('Unable to initialize WebGL. Your browser may not support it.');
    }

    // Set up initial program with default fragment shader and fixed vertex shader
    setupShaderProgram(defaultFragmentShader);
    initBuffers();

    // Set up mouse tracking for interactive shaders
    setupMouseTracking(canvas);

    // Optional callback for when setup is complete
    if (onShaderSetupComplete) {
        onShaderSetupComplete(gl, canvas);
    }
    
    return gl;
}

// Mouse state for shader uniforms
let mousePosition = { x: 0, y: 0 };
let lastClickPosition = { x: 0, y: 0 };
let isMouseDown = false;
let frameCount = 0;

/**
 * Setup mouse tracking for interactive shaders
 * @param {HTMLCanvasElement} canvas - The canvas element to track mouse on
 */
function setupMouseTracking(canvas) {
    canvas.addEventListener('mousemove', (event) => {
        const rect = canvas.getBoundingClientRect();
        // Normalize coordinates to [0,1] range
        mousePosition.x = (event.clientX - rect.left) / rect.width;
        mousePosition.y = 1.0 - (event.clientY - rect.top) / rect.height; // Flip y-axis to match WebGL
        
        // If mouse is down, also update lastClickPosition to track dragging
        if (isMouseDown) {
            lastClickPosition.x = mousePosition.x;
            lastClickPosition.y = mousePosition.y;
        }
    });
    
    canvas.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        const rect = canvas.getBoundingClientRect();
        lastClickPosition.x = (event.clientX - rect.left) / rect.width;
        lastClickPosition.y = 1.0 - (event.clientY - rect.top) / rect.height;
    });
    
    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
    });
    
    canvas.addEventListener('mouseleave', () => {
        isMouseDown = false;
    });
}

/**
 * Set up shader program
 * @param {string} fsSource - Fragment shader source code
 * @returns {boolean} - True if setup was successful
 */
function setupShaderProgram(fsSource) {
    try {
        // Create shader program using the fixed vertex shader and provided fragment shader
        const vertexShader = loadShader(gl.VERTEX_SHADER, fixedVertexShader);
        const fragmentShader = loadShader(gl.FRAGMENT_SHADER, fsSource);
        
        // Create the shader program
        shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        
        // Check if shader program linked successfully
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            const errorLog = gl.getProgramInfoLog(shaderProgram);
            throw new Error(`Unable to initialize the shader program: ${errorLog}`);
        }
        
        // Get position attribute location (from our fixed vertex shader)
        shaderProgram.vertexPosition = gl.getAttribLocation(shaderProgram, 'position');
        
        if (shaderProgram.vertexPosition === -1) {
            console.warn('No valid vertex position attribute found in shader');
        }
        
        // Get common uniform locations
        shaderProgram.timeUniform = gl.getUniformLocation(shaderProgram, 'uTime');
        shaderProgram.resolutionUniform = gl.getUniformLocation(shaderProgram, 'uResolution');
        shaderProgram.mouseUniform = gl.getUniformLocation(shaderProgram, 'uMouse');
        shaderProgram.mouseClickUniform = gl.getUniformLocation(shaderProgram, 'uMouseClick');
        shaderProgram.isMouseDownUniform = gl.getUniformLocation(shaderProgram, 'uIsMouseDown');
        shaderProgram.frameUniform = gl.getUniformLocation(shaderProgram, 'uFrame');
        shaderProgram.aspectUniform = gl.getUniformLocation(shaderProgram, 'uAspect');
        
        // Clear any previous errors in UI if available
        const errorElement = document.getElementById('shaderError');
        if (errorElement) {
            errorElement.classList.add('d-none');
        }
        
        const iterateBtn = document.getElementById('iterateBtn');
        if (iterateBtn) {
            iterateBtn.disabled = false;
        }
        
        return true;
    } catch (error) {
        // Display error message in UI if available
        const errorElement = document.getElementById('shaderError');
        if (errorElement) {
            errorElement.textContent = error.message;
            errorElement.classList.remove('d-none');
        }
        
        const iterateBtn = document.getElementById('iterateBtn');
        if (iterateBtn) {
            iterateBtn.disabled = true;
        }
        
        console.error(error);
        return false;
    }
}

/**
 * Compile shader
 * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
 * @param {string} source - Shader source code
 * @returns {WebGLShader} - Compiled shader
 */
function loadShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    // Check if compilation was successful
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const errorLog = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        const shaderType = type === gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
        throw new Error(`An error occurred compiling the ${shaderType} shader: ${errorLog}`);
    }
    
    return shader;
}

/**
 * Initialize buffers for rendering
 */
function initBuffers() {
    // Create a buffer for the square's positions.
    positionBuffer = gl.createBuffer();
    
    // Select the positionBuffer as the one to apply buffer operations to
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // Create an array of positions for the square (full-screen quad)
    const positions = [
        -1.0,  1.0,
         1.0,  1.0,
        -1.0, -1.0,
         1.0, -1.0,
    ];
    
    // Pass the list of positions into WebGL to build the shape
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
}

/**
 * Draw the scene
 * @param {number} time - Current time in seconds
 */
function drawScene(time) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    
    // Use shader program
    gl.useProgram(shaderProgram);
    
    // Increment frame counter
    frameCount++;
    
    // Set the shader uniforms if they exist
    if (shaderProgram.timeUniform) {
        gl.uniform1f(shaderProgram.timeUniform, time);
    }
    
    if (shaderProgram.resolutionUniform) {
        gl.uniform2f(shaderProgram.resolutionUniform, canvas.width, canvas.height);
    }
    
    if (shaderProgram.mouseUniform) {
        gl.uniform2f(shaderProgram.mouseUniform, mousePosition.x, mousePosition.y);
    }
    
    if (shaderProgram.mouseClickUniform) {
        gl.uniform2f(shaderProgram.mouseClickUniform, lastClickPosition.x, lastClickPosition.y);
    }
    
    if (shaderProgram.isMouseDownUniform) {
        gl.uniform1i(shaderProgram.isMouseDownUniform, isMouseDown ? 1 : 0);
    }
    
    if (shaderProgram.frameUniform) {
        gl.uniform1i(shaderProgram.frameUniform, frameCount);
    }
    
    if (shaderProgram.aspectUniform) {
        gl.uniform1f(shaderProgram.aspectUniform, canvas.width / canvas.height);
    }
    
    // Set up vertex attributes 
    if (shaderProgram.vertexPosition !== -1) {
        // Set up vertex attributes
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(
            shaderProgram.vertexPosition,
            2,        // 2 components per vertex
            gl.FLOAT, // the data is 32bit floats
            false,    // don't normalize
            0,        // stride
            0         // offset
        );
        gl.enableVertexAttribArray(shaderProgram.vertexPosition);
        
        // Draw the geometry
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
        console.warn('Cannot render: No valid vertex position attribute in shader');
    }
}

/**
 * Get the current shader program
 * @returns {WebGLProgram} - Current shader program
 */
function getShaderProgram() {
    return shaderProgram;
}

/**
 * Sanitize shader code by removing markdown code fences and other non-GLSL content
 * @param {string} code - Raw shader code that might contain markdown or other syntax
 * @returns {string} - Clean GLSL code
 */
function sanitizeShaderCode(code) {
    if (!code) return '';
    
    // Remove markdown code fences if present
    let cleanCode = code.replace(/```(?:glsl|cpp|c\+\+|c)?/g, '').replace(/```/g, '');
    
    // Remove HTML comments
    cleanCode = cleanCode.replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove extra whitespace 
    cleanCode = cleanCode.trim();
    
    // Log for debugging
    console.log('Sanitized shader code:', cleanCode);
    
    return cleanCode;
}

/**
 * Parse LLM response to extract fragment shader code
 * @param {string} response - Raw LLM response text
 * @returns {string} - Extracted fragment shader code
 */
function parseShaders(response) {
    const fragmentMarker = '#-- FRAGMENT SHADER --#';
    
    // Check if response has fragment marker
    if (response.includes(fragmentMarker)) {
        // Extract fragment shader code
        const fragmentStart = response.indexOf(fragmentMarker) + fragmentMarker.length;
        const fragmentCode = response.substring(fragmentStart).trim();
        return sanitizeShaderCode(fragmentCode);
    }
    
    // If no marker, assume the entire response is fragment shader code
    // We'll sanitize to remove markdown and non-GLSL content
    return sanitizeShaderCode(response);
}

/**
 * Check if a shader program is currently compiled and ready
 * @returns {boolean} - True if the shader program is compiled and ready
 */
function isCompiled() {
    return shaderProgram !== null && shaderProgram !== undefined;
}

/**
 * Manually trigger a frame render
 * @returns {boolean} - True if rendering was successful
 */
function renderFrame() {
    if (!isCompiled()) {
        return false;
    }
    
    // Get current time
    const currentTime = performance.now() / 1000.0;
    
    // Draw the scene with current time
    drawScene(currentTime);
    return true;
}

// Export as ES module
export {
    gl,
    canvas,
    initWebGL,
    setupShaderProgram,
    loadShader,
    drawScene,
    parseShaders,
    sanitizeShaderCode,
    getShaderProgram,
    isCompiled,
    renderFrame,
    fixedVertexShader,
    defaultFragmentShader
};
