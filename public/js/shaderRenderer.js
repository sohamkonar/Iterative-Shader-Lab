// shaderRenderer.js - WebGL and shader rendering related code

/**
 * Shader Renderer - Handles WebGL initialization, shader compilation and rendering
 */

// Global variables
let gl;
let canvas;
let shaderProgram;
let positionBuffer;

// Default shaders
const defaultVertexShader = `
attribute vec4 aVertexPosition;
varying vec2 vUv;

void main() {
    vUv = aVertexPosition.xy * 0.5 + 0.5;
    gl_Position = aVertexPosition;
}`;

const defaultFragmentShader = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;

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

    // Set up initial program with default shaders
    setupShaderProgram(defaultVertexShader, defaultFragmentShader);
    initBuffers();

    // Optional callback for when setup is complete
    if (onShaderSetupComplete) {
        onShaderSetupComplete(gl, canvas);
    }
    
    return gl;
}

/**
 * Set up shader program
 * @param {string} vsSource - Vertex shader source code
 * @param {string} fsSource - Fragment shader source code
 * @returns {boolean} - True if setup was successful
 */
function setupShaderProgram(vsSource, fsSource) {
    try {
        // Create shader program
        const vertexShader = loadShader(gl.VERTEX_SHADER, vsSource);
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
        
        // Get attribute and uniform locations
        // Try common vertex attribute names - first aVertexPosition, then position, then a_position
        const posAttribNames = ['aVertexPosition', 'aPosition', 'position', 'a_position', 'pos', 'a_vertex'];
        
        // Find the first attribute name that exists in the shader
        for (const attribName of posAttribNames) {
            const attribLoc = gl.getAttribLocation(shaderProgram, attribName);
            if (attribLoc !== -1) {
                shaderProgram.vertexPosition = attribLoc;
                shaderProgram.vertexAttribName = attribName;
                console.log(`Using vertex attribute: ${attribName}`);  
                break;
            }
        }
        
        // If no valid position attribute found, use a default attribute
        if (shaderProgram.vertexPosition === undefined || shaderProgram.vertexPosition === -1) {
            // Log a warning but don't fail - we'll handle this in drawScene
            console.warn('No valid vertex position attribute found in shader');
            shaderProgram.vertexPosition = -1;
        }
        
        // Get common uniform locations
        shaderProgram.timeUniform = gl.getUniformLocation(shaderProgram, 'uTime');
        shaderProgram.resolutionUniform = gl.getUniformLocation(shaderProgram, 'uResolution');
        
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
    
    // Set the shader uniforms if they exist
    if (shaderProgram.timeUniform) {
        gl.uniform1f(shaderProgram.timeUniform, time);
    }
    
    if (shaderProgram.resolutionUniform) {
        gl.uniform2f(shaderProgram.resolutionUniform, canvas.width, canvas.height);
    }
    
    // Only set up vertex attributes if we found a valid position attribute
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
 * Parse LLM response to extract vertex and fragment shader code
 * @param {string} response - Raw LLM response text
 * @returns {{vertexShader: string, fragmentShader: string}} - Extracted shader code
 */
function parseShaders(response) {
    const vertexMarker = '#-- VERTEX SHADER --#';
    const fragmentMarker = '#-- FRAGMENT SHADER --#';
    
    // Check if response has markers
    if (response.includes(vertexMarker) && response.includes(fragmentMarker)) {
        // Split by markers and extract vertex and fragment shader code
        const vertexStart = response.indexOf(vertexMarker) + vertexMarker.length;
        const fragmentStart = response.indexOf(fragmentMarker) + fragmentMarker.length;
        
        let vertexCode = '';
        let fragmentCode = '';
        
        if (fragmentStart > vertexStart) {
            // Normal order: vertex then fragment
            vertexCode = response.substring(vertexStart, response.indexOf(fragmentMarker)).trim();
            fragmentCode = response.substring(fragmentStart).trim();
        } else {
            // Reverse order: fragment then vertex
            fragmentCode = response.substring(fragmentStart, response.indexOf(vertexMarker)).trim();
            vertexCode = response.substring(vertexStart).trim();
        }
        
        return {
            vertexShader: sanitizeShaderCode(vertexCode),
            fragmentShader: sanitizeShaderCode(fragmentCode)
        };
    }
    
    // If no markers, try to identify by common GLSL patterns
    // Assume shader with precision declaration is fragment shader
    if (response.includes('precision')) {
        const parts = response.split('precision');
        if (parts.length >= 2) {
            // The first part might contain vertex shader code
            const vertexCandidate = sanitizeShaderCode(parts[0]);
            // Recombine the rest with 'precision' keyword
            const fragmentCandidate = sanitizeShaderCode('precision' + parts.slice(1).join('precision'));
            
            return {
                vertexShader: vertexCandidate,
                fragmentShader: fragmentCandidate
            };
        }
    }
    
    // Default: assume the entire response is fragment shader code
    return {
        vertexShader: defaultVertexShader,
        fragmentShader: sanitizeShaderCode(response)
    };
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
    defaultVertexShader,
    defaultFragmentShader
};
