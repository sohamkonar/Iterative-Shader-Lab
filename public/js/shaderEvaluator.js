// shaderEvaluator.js - Evaluate shader compilation, performance, and visual results

/**
 * ShaderEvaluator - Evaluates shader code by compiling, rendering, and computing metrics
 * Based on the Reflexion approach (https://arxiv.org/abs/2303.11366)
 */
class ShaderEvaluator {
    constructor(gl, canvas, options = {}) {
        this.gl = gl;
        this.canvas = canvas;
        this.options = Object.assign({
            ssimThreshold: 0.85,
            maxScreenshots: 5,
            timeJitterAmount: 2.0,
            baseTime: 0,
        }, options);
        
        // Reference images for SSIM comparison (could be loaded externally)
        this.referenceImages = {};
    }

    /**
     * Set a reference image for SSIM comparison
     * @param {string} name - Scene name
     * @param {HTMLImageElement} image - Reference image
     */
    setReferenceImage(name, image) {
        this.referenceImages[name] = image;
    }

    /**
     * Compile a shader
     * @param {string} source - Source code
     * @param {number} type - Shader type (gl.VERTEX_SHADER or gl.FRAGMENT_SHADER)
     * @returns {WebGLShader|null} - Compiled shader or null if failed
     */
    compileShader(source, type) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            // Don't delete the shader - we need it for the info log
            return { shader, success: false, log: gl.getShaderInfoLog(shader) };
        }
        
        return { shader, success: true, log: '' };
    }

    /**
     * Link a shader program
     * @param {WebGLShader} vertexShader - Compiled vertex shader
     * @param {WebGLShader} fragmentShader - Compiled fragment shader
     * @returns {WebGLProgram|null} - Linked program or null if failed
     */
    linkProgram(vertexShader, fragmentShader) {
        const gl = this.gl;
        const program = gl.createProgram();
        
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return { program, success: false, log: gl.getProgramInfoLog(program) };
        }
        
        return { program, success: true, log: '' };
    }

    /**
     * Render a scene with the given program
     * @param {WebGLProgram} program - Compiled shader program
     * @param {string} scene - Scene name (e.g., 'quad', 'sphere', 'complex')
     * @param {Object} uniforms - Uniform values to set
     */
    renderScene(program, scene = 'quad', uniforms = {}) {
        const gl = this.gl;
        
        // Use the program
        gl.useProgram(program);
        
        // Set uniforms
        this._setUniforms(program, uniforms);
        
        // Draw the scene (simplified for now)
        // In a real implementation, you'd have different geometry for each scene
        this._drawQuad(program);
    }

    /**
     * Set uniforms on the shader program
     * @private
     * @param {WebGLProgram} program - Compiled shader program
     * @param {Object} uniforms - Uniform values to set
     */
    _setUniforms(program, uniforms) {
        const gl = this.gl;
        
        // Set all standard uniforms used in Shadertoy-style fragment shaders
        const standardUniforms = {
            // Always provide these even if not in uniforms parameter
            uTime: uniforms.uTime !== undefined ? uniforms.uTime : 0.0,
            uResolution: uniforms.uResolution !== undefined ? uniforms.uResolution : [this.canvas.width, this.canvas.height],
            uMouse: uniforms.uMouse !== undefined ? uniforms.uMouse : [0.5, 0.5],
            uMouseClick: uniforms.uMouseClick !== undefined ? uniforms.uMouseClick : [0.5, 0.5],
            uIsMouseDown: uniforms.uIsMouseDown !== undefined ? uniforms.uIsMouseDown : 0,
            uFrame: uniforms.uFrame !== undefined ? uniforms.uFrame : 0,
            uAspect: uniforms.uAspect !== undefined ? uniforms.uAspect : this.canvas.width / this.canvas.height
        };
        
        // Set all standard uniforms
        for (const [name, value] of Object.entries(standardUniforms)) {
            const location = gl.getUniformLocation(program, name);
            if (location) {
                if (typeof value === 'number') {
                    gl.uniform1f(location, value);
                } else if (Array.isArray(value)) {
                    switch (value.length) {
                        case 2: gl.uniform2fv(location, value); break;
                        case 3: gl.uniform3fv(location, value); break;
                        case 4: gl.uniform4fv(location, value); break;
                    }
                }
            }
        }
        
        // Set any additional custom uniforms
        for (const [name, value] of Object.entries(uniforms)) {
            // Skip standard uniforms already set
            if (standardUniforms.hasOwnProperty(name)) continue;
            
            const location = gl.getUniformLocation(program, name);
            if (location) {
                // Detect type and set uniform accordingly
                if (typeof value === 'number') {
                    gl.uniform1f(location, value);
                } else if (Array.isArray(value)) {
                    switch (value.length) {
                        case 2: gl.uniform2fv(location, value); break;
                        case 3: gl.uniform3fv(location, value); break;
                        case 4: gl.uniform4fv(location, value); break;
                    }
                }
                // Add support for textures or other types as needed
            }
        }
    }

    /**
     * Draw a quad that fills the viewport
     * @private
     * @param {WebGLProgram} program - Compiled shader program
     */
    _drawQuad(program) {
        const gl = this.gl;
        
        // Create a buffer for the quad
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        
        // Two triangles forming a quad
        const positions = [
            -1, -1,
            1, -1,
            -1, 1,
            -1, 1,
            1, -1,
            1, 1
        ];
        
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
        
        // Set up attribute (using aPosition as in our fixed vertex shader)
        const positionLocation = gl.getAttribLocation(program, 'aPosition');
        if (positionLocation !== -1) {
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
        }
        
        // Draw
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        
        // Clean up
        gl.deleteBuffer(buffer);
    }

    /**
     * Compute SSIM between rendered output and reference image
     * Note: This is a placeholder; actual SSIM implementation would use a library
     * @param {string} scene - Scene name
     * @returns {number} - SSIM score (0-1)
     */
    computeSSIM(scene = 'quad') {
        // In a real implementation, you'd use the ssim.js library
        // For now, this is just a placeholder that returns a random value
        return Math.random() * 0.5 + 0.5; // Random value between 0.5 and 1.0
    }

    /**
     * Measure FPS by rendering multiple frames
     * @param {WebGLProgram} program - Compiled shader program
     * @param {number} frames - Number of frames to render
     * @returns {number} - FPS
     */
    measureFPS(program, frames = 60) {
        const start = performance.now();
        
        for (let i = 0; i < frames; i++) {
            this.renderScene(program, 'quad', {
                uTime: this.options.baseTime + (i / frames) * this.options.timeJitterAmount,
                uResolution: [this.canvas.width, this.canvas.height],
                uFrame: i,
                uAspect: this.canvas.width / this.canvas.height
            });
        }
        
        const end = performance.now();
        const elapsed = (end - start) / 1000; // seconds
        
        return frames / elapsed;
    }

    /**
     * Capture screenshots with jittered time values
     * @param {WebGLProgram} program - Compiled shader program
     * @param {string} scene - Scene name
     * @returns {Array<string>} - Array of base64 encoded PNGs
     */
    captureScreenshots(program, scene = 'quad') {
        const screenshots = [];
        
        for (let i = 0; i < this.options.maxScreenshots; i++) {
            // Render with jittered time
            this.renderScene(program, scene, {
                uTime: this.options.baseTime + Math.random() * this.options.timeJitterAmount,
                uResolution: [this.canvas.width, this.canvas.height],
                uFrame: i,
                uAspect: this.canvas.width / this.canvas.height
            });
            
            // Capture canvas as PNG
            const dataURL = this.canvas.toDataURL('image/png');
            const base64 = dataURL.split(',')[1];
            screenshots.push(base64);
        }
        
        return screenshots;
    }

    /**
     * Check for NaN pixels in rendered output
     * @returns {boolean} - True if NaNs are detected
     */
    checkForNaNs() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Read pixels from WebGL context
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        
        // Better NaN detection - look for rendering artifacts or suspicious patterns
        let hasPixels = false;
        let suspiciousPattern = false;
        
        // Check if we have any non-transparent pixels (alpha > 0)
        for (let i = 0; i < pixels.length; i += 4) {
            const a = pixels[i + 3];
            if (a > 0) {
                hasPixels = true;
                break;
            }
        }
        
        // If no pixels were rendered at all, that's suspicious
        if (!hasPixels) {
            return true;
        }
        
        // Check for WebGL errors that might indicate NaNs
        const glError = gl.getError();
        if (glError !== gl.NO_ERROR) {
            console.log('WebGL error detected during NaN check:', glError);
            return true;
        }
        
        // If we have pixels and no WebGL errors, shader is probably fine
        return false;
    }

    /**
     * Fixed vertex shader for fragment-only workflow (like Shadertoy)
     * @private
     * @returns {string} - Fixed vertex shader source
     */
    _getFixedVertexShader() {
        return `
            attribute vec4 aPosition;
            varying vec2 vUv;
            
            void main() {
                vUv = aPosition.xy * 0.5 + 0.5;
                gl_Position = aPosition;
            }
        `;
    }

    /**
     * Fully evaluate a fragment shader and return detailed results
     * @param {string} fragmentSource - Fragment shader source
     * @returns {Object} - Evaluation results
     */
    async evaluateShader(fragmentSource) {
        const gl = this.gl;
        
        // Use fixed vertex shader
        const vertexSource = this._getFixedVertexShader();
        
        // Compile shaders
        const vertexResult = this.compileShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentResult = this.compileShader(fragmentSource, gl.FRAGMENT_SHADER);
        
        // Combined info log
        const infoLog = [
            vertexResult.log ? `Vertex shader: ${vertexResult.log}` : '',
            fragmentResult.log ? `Fragment shader: ${fragmentResult.log}` : ''
        ].filter(Boolean).join('\n');
        
        // If compilation failed, return early
        if (!vertexResult.success || !fragmentResult.success) {
            return {
                compiled: false,
                infoLog,
                metrics: { ssim: 0, fps: 0 },
                hasNaNs: false,
                screenshots: []
            };
        }
        
        // Link program
        const programResult = this.linkProgram(vertexResult.shader, fragmentResult.shader);
        
        // If linking failed, return early
        if (!programResult.success) {
            return {
                compiled: false,
                infoLog: infoLog + '\n' + programResult.log,
                metrics: { ssim: 0, fps: 0 },
                hasNaNs: false,
                screenshots: []
            };
        }
        
        // Render and evaluate
        const program = programResult.program;
        this.renderScene(program, 'quad', {
            uTime: this.options.baseTime,
            uResolution: [this.canvas.width, this.canvas.height]
        });
        
        // Compute metrics
        const ssim = this.computeSSIM('quad');
        const fps = this.measureFPS(program);
        const hasNaNs = this.checkForNaNs();
        
        // Capture screenshots
        const screenshots = this.captureScreenshots(program);
        
        // Clean up
        gl.deleteProgram(program);
        gl.deleteShader(vertexResult.shader);
        gl.deleteShader(fragmentResult.shader);
        
        return {
            compiled: true,
            infoLog,
            metrics: { ssim, fps },
            hasNaNs,
            screenshots
        };
    }
}

// Export as ES module
export { ShaderEvaluator };
