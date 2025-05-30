// main.js - Application orchestration logic

// Global imports for the application
import { ShaderEvaluator } from './shaderEvaluator.js';
import * as ShaderRenderer from './shaderRenderer.js';

// Global variables
let canvas;
let gl;
let shaderEvaluator;
let currentIteration = 0;

// Initialize WebGL
function initWebGL() {
    canvas = document.getElementById('glCanvas');
    
    // Initialize WebGL using the ShaderRenderer module
    try {
        gl = ShaderRenderer.initWebGL(canvas, (glContext, canvasElement) => {
            // This callback runs after the initial shader setup is complete
            shaderEvaluator = new ShaderEvaluator(glContext, canvasElement);
        });
        
        // Start animation loop
        let lastTime = 0;
        function render(now) {
            now *= 0.001;  // Convert to seconds
            const deltaTime = now - lastTime;
            lastTime = now;
            
            ShaderRenderer.drawScene(now);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);
        
        // UI event listeners
        document.getElementById('generateBtn').addEventListener('click', handleGenerateClick);
        document.getElementById('compileBtn').addEventListener('click', handleCompileClick);
        document.getElementById('iterateBtn').addEventListener('click', handleIterateClick);
        
        // Initialize text areas with default shader code
        document.getElementById('vertexShaderCode').value = ShaderRenderer.defaultVertexShader;
        document.getElementById('fragmentShaderCode').value = ShaderRenderer.defaultFragmentShader;
    } catch (error) {
        alert('WebGL initialization error: ' + error.message);
    }
}

// These functions have been moved to shaderRenderer.js

// Handle Generate button click with auto-iteration until success
async function handleGenerateClick() {
    // Get the prompt from the textarea
    const prompt = document.getElementById('shaderPrompt').value.trim();
    
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('iterateBtn').disabled = true;
    document.getElementById('compileBtn').disabled = true;
    document.getElementById('generateBtn').textContent = 'Generating...';
    
    // Clear previous iteration history
    localStorage.removeItem('shaderIterationHistory');
    updateIterationHistory();
    
    try {
        updateStatusMessage('Generating shader from description...');
        
        // Call the API to generate the shader
        const prompt = document.getElementById('shaderPrompt').value;
        const result = await generateShader(prompt);
        
        if (result && result.vertexShader && result.fragmentShader) {
            // Update the shader editors
            document.getElementById('vertexShaderCode').value = result.vertexShader;
            document.getElementById('fragmentShaderCode').value = result.fragmentShader;
            
            // Compile and render the shader
            let success = ShaderRenderer.setupShaderProgram(result.vertexShader, result.fragmentShader);
            
            // Start auto-iteration if the shader doesn't compile successfully
            if (!success) {
                await autoIterateShader(prompt, result.vertexShader, result.fragmentShader, 0);
            } else {
                // Shader compiled successfully on first try
                // Capture the canvas state
                const imageData = canvas.toDataURL('image/png');
                
                // Log the initial generation as iteration 0
                logIteration({
                    iteration: 0,
                    prompt,
                    vertexShader: result.vertexShader,
                    fragmentShader: result.fragmentShader,
                    success,
                    metrics: createMetrics(success, null),
                    imageData,
                    reflection: '',
                    isManualIteration: true,
                    isLastAutoIteration: false
                });
                
                // Update iteration history display
                updateIterationHistory();
                
                // Check if rendering is actually visible (for user feedback only)
                let isActuallyWorking = true;
                try {
                    // Get WebGL context and check pixels
                    const gl = canvas.getContext('webgl');
                    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
                    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
                    
                    // If any pixel is non-black, the shader is actually rendering something
                    let hasVisibleContent = false;
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (pixels[i] > 0 || pixels[i+1] > 0 || pixels[i+2] > 0) {
                            hasVisibleContent = true;
                            break;
                        }
                    }
                    
                    isActuallyWorking = hasVisibleContent;
                    console.log('Shader visible content check:', isActuallyWorking ? 'Content visible' : 'No visible content');
                } catch (e) {
                    console.error('Error checking shader output:', e);
                }
                
                // Always show the feedback field regardless of shader errors
                document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
                
                // If the shader compiled but isn't showing content, inform the user
                if (!isActuallyWorking) {
                    updateStatusMessage('Shader compiles but isn\'t rendering properly. Enter feedback to improve it.');
                } else {
                    updateStatusMessage('Shader generated successfully! Enter what you want to improve and click Iterate.');
                }
            }
        } else {
            throw new Error('Failed to generate shader. The API response was incomplete.');
        }
    } catch (error) {
        console.error('Error generating shader:', error);
        document.getElementById('shaderError').textContent = `Error generating shader: ${error.message}`;
        document.getElementById('shaderError').classList.remove('d-none');
        updateStatusMessage('Failed to generate shader.');
    } finally {
        // Re-enable all buttons
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('compileBtn').disabled = false;
        document.getElementById('generateBtn').textContent = 'Generate Shader';
        
        // Only enable iterate button if there's feedback
        const feedbackText = document.getElementById('iterationFeedback').value.trim();
        document.getElementById('iterateBtn').disabled = !feedbackText;
    }
}

/**
 * Makes an API call to generate shader code from a prompt
 * @param {string} prompt - Text description of the desired shader effect
 * @returns {Promise<{vertexShader: string, fragmentShader: string}>} - Generated shader code
 */
async function generateShader(prompt) {
    try {
        // Call the /api/generate-shader endpoint
        const response = await fetch('/api/generate-shader', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Parse the response to extract vertex and fragment shader code
        return ShaderRenderer.parseShaders(data.response);
    } catch (error) {
        console.error('Error generating shader:', error);
        throw error;
    }
}

/**
 * Parse the LLM response to extract vertex and fragment shader code
 * @param {string} response - Raw LLM response text
 * @returns {{vertexShader: string, fragmentShader: string}} - Extracted shader code
 */
// This function has been moved to shaderRenderer.js

// This function has been moved to shaderRenderer.js

/**
 * Update status message in UI
 * @param {string} message - Status message to display
 */
function updateStatusMessage(message) {
    // You can implement this to show loading/status messages
    console.log('Status:', message);
}

/**
 * Log an iteration to history
 * @param {object} iteration - Iteration data to log
 */
function logIteration(iteration) {
    // Get current history from localStorage or initialize empty array
    const history = getIterationHistory();
    
    // Add new iteration
    history.push(iteration);
    
    // Store updated history
    localStorage.setItem('shaderIterationHistory', JSON.stringify(history));
}

/**
 * Get iteration history from localStorage
 * @returns {Array} - Array of iteration objects
 */
function getIterationHistory() {
    const storedHistory = localStorage.getItem('shaderIterationHistory');
    return storedHistory ? JSON.parse(storedHistory) : [];
}

/**
 * Create metrics object for shader evaluation
 * @param {boolean} success - Whether compilation was successful
 * @param {object|null} evaluation - Evaluation data if available
 * @returns {object} - Metrics object
 */
function createMetrics(success, evaluation) {
    const metrics = {
        compilationSuccess: success
    };
    
    if (evaluation) {
        // Add evaluation metrics if available
        Object.assign(metrics, evaluation.metrics);
    }
    
    return metrics;
}

// Handle Compile button click
function handleCompileClick() {
    const vertexSource = document.getElementById('vertexShaderCode').value;
    const fragmentSource = document.getElementById('fragmentShaderCode').value;
    
    // Try to compile and render the shader using ShaderRenderer
    ShaderRenderer.setupShaderProgram(vertexSource, fragmentSource);
}

// Common auto-iteration function used by both handleGenerateClick and handleIterateClick
async function autoIterateShader(prompt, initialVertexShader, initialFragmentShader, startIteration) {
    const MAX_AUTO_ITERATIONS = 5; // Maximum number of iterations to attempt
    let iterationCount = 0;
    let success = false;
    let currentIteration = startIteration;
    let currentVertex = initialVertexShader;
    let currentFragment = initialFragmentShader;
    
    // Clear any previous errors
    document.getElementById('shaderError').classList.add('d-none');
    
    while (!success && iterationCount < MAX_AUTO_ITERATIONS) {
        iterationCount++;
        const iterationLabel = `Auto-Iteration ${iterationCount}/${MAX_AUTO_ITERATIONS}`;
        
        // Get user feedback (only used for manual iterations, empty for auto-iterations after generate)
        const feedbackElement = document.getElementById('iterationFeedback');
        const userFeedback = (startIteration > 0 && iterationCount === 1) ? 
            (feedbackElement ? feedbackElement.value.trim() : '') : '';
        
        // Increment iteration counter
        currentIteration++;
        
        // 1. Evaluate the current shader
        updateStatusMessage(`${iterationLabel}: Evaluating shader...`);
        const evaluation = await shaderEvaluator.evaluateShader(currentVertex, currentFragment);
        
        // 2. Log evaluation metrics
        console.log(`${iterationLabel} shader evaluation:`, evaluation);
        
        // 3. Prepare simplified evaluation object for API
        const simplifiedEvaluation = {
            compiled: evaluation.compilationSuccess || false,
            infoLog: evaluation.compileErrors || evaluation.linkErrors || '',
            metrics: evaluation.metrics || {},
            hasNaNs: evaluation.hasNaNs || false
        };
        
        // 4. Get screenshot
        const screenshotData = getOptimizedScreenshot(canvas);
        
        // 5. Call the /api/iterate endpoint
        updateStatusMessage(`${iterationLabel}: Generating improved shader...`);
        
        let data;
        try {
            const response = await fetch('/api/iterate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt,
                    currentVertex: currentVertex,
                    currentFragment: currentFragment,
                    evaluation: simplifiedEvaluation,
                    iteration: currentIteration,
                    screenshots: screenshotData ? [screenshotData] : [],
                    userFeedback: userFeedback
                })
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            data = await response.json();
        } catch (fetchError) {
            console.error(`Error during ${iterationLabel.toLowerCase()}:`, fetchError);
            
            if (iterationCount === 1 && startIteration > 0) {
                // If this is the first manual iteration, fail completely
                throw fetchError;
            }
            
            // For auto-iterations, try to continue with next iteration
            updateStatusMessage(`${iterationLabel}: Failed - ${fetchError.message}. Trying again...`);
            continue;
        }
        
        // 6. Parse the result
        const result = ShaderRenderer.parseShaders(data.response);
        
        // Update the current shaders for the next iteration
        currentVertex = result.vertexShader;
        currentFragment = result.fragmentShader;
        
        // 7. Update the shader editors
        document.getElementById('vertexShaderCode').value = result.vertexShader;
        document.getElementById('fragmentShaderCode').value = result.fragmentShader;
        
        // 8. Compile and render the new shader
        success = ShaderRenderer.setupShaderProgram(result.vertexShader, result.fragmentShader);
        
        // If the shader compiles successfully, consider it a success regardless of WebGL errors
        // This prevents endless iteration when the shader compiles without syntax errors
        if (success) {
            // Log any WebGL errors but ignore them for auto-iteration stopping criteria
            try {
                const gl = canvas.getContext('webgl');
                const errors = [];
                let err;
                while ((err = gl.getError()) !== gl.NO_ERROR) {
                    errors.push(err);
                }
                
                if (errors.length > 0) {
                    console.log(`${iterationLabel}: Shader compiled with WebGL warnings (ignored):`, errors);
                }
            } catch (e) {
                console.error('Error checking WebGL errors:', e);
            }
            
            // If shaders compile successfully, stop auto-iteration regardless of WebGL errors
            console.log(`${iterationLabel}: Compilation successful - stopping auto-iteration.`);
        }
        
        // Capture the canvas state and metrics for potential logging
        const imageData = canvas.toDataURL('image/png');
        const metrics = createMetrics(success, evaluation);
        
        // Store iteration data for logging
        const iterationData = {
            iteration: currentIteration,
            prompt,
            vertexShader: result.vertexShader,
            fragmentShader: result.fragmentShader,
            success,
            metrics,
            imageData,
            reflection: data.reflection || 'No reflection provided',
            // Flag if this is the first manual iteration vs auto-iteration
            isManualIteration: startIteration > 0 && iterationCount === 1,
            isLastAutoIteration: success
        };
        
        // For first iteration or successful iterations, always log them
        if ((startIteration > 0 && iterationCount === 1) || success) {
            // Log this iteration in history
            logIteration(iterationData);
            
            // Update the UI
            updateIterationHistory();
            updateMetricsDisplay(metrics);
        }
        
        if (success) {
            updateStatusMessage(`${iterationLabel}: Success! Enter new feedback for further improvements.`);
            
            // Clear the feedback field and show it for the next iteration
            if (document.getElementById('iterationFeedback')) {
                document.getElementById('iterationFeedback').value = '';
                document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
            }
            
            break;
        } else if (iterationCount < MAX_AUTO_ITERATIONS) {
            updateStatusMessage(`${iterationLabel}: Shader still has errors, continuing...`);
        }
    }
    
    // Always show the feedback field after iterations, even if auto-iteration failed
    if (document.getElementById('iterationFeedback')) {
        document.getElementById('iterationFeedback').value = '';
        document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
    }
    
    if (!success && iterationCount >= MAX_AUTO_ITERATIONS) {
        updateStatusMessage(`Auto-iteration stopped after ${iterationCount} attempts. Enter specific feedback to fix remaining issues.`);
        document.getElementById('shaderError').textContent = `Could not automatically fix all shader issues. Try providing specific feedback.`;
        document.getElementById('shaderError').classList.remove('d-none');
    }
    
    return success;
}

// Handle Iterate button click with auto-iteration until success
async function handleIterateClick() {
    // Prevent multiple clicks
    document.getElementById('iterateBtn').disabled = true;
    document.getElementById('generateBtn').disabled = true;
    document.getElementById('compileBtn').disabled = true;
    document.getElementById('iterateBtn').textContent = 'Iterating...';
    
    try {
        const prompt = document.getElementById('shaderPrompt').value;
        const currentVertex = document.getElementById('vertexShaderCode').value;
        const currentFragment = document.getElementById('fragmentShaderCode').value;
        
        // Get current iteration count from history
        const history = getIterationHistory();
        const currentIteration = history.length > 0 ? 
            Math.max(...history.map(item => item.iteration)) : 0;
        
        // Start auto-iteration
        await autoIterateShader(prompt, currentVertex, currentFragment, currentIteration);
    } catch (error) {
        console.error('Error iterating shader:', error);
        document.getElementById('shaderError').textContent = `Error iterating shader: ${error.message}`;
        document.getElementById('shaderError').classList.remove('d-none');
        updateStatusMessage('Failed to iterate shader.');
    } finally {
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('compileBtn').disabled = false;
        document.getElementById('iterateBtn').textContent = 'Iterate';
        
        // Only enable the iterate button if there's feedback text
        const feedbackText = document.getElementById('iterationFeedback').value.trim();
        document.getElementById('iterateBtn').disabled = !feedbackText;
    }
}

// Reflection feedback is now handled directly in the iteration history UI

/**
 * Get an optimized screenshot from the canvas for faster transmission
 * @param {HTMLCanvasElement} canvas - The WebGL canvas element
 * @returns {string|null} - Base64 encoded image data, or null if failed
 */
function getOptimizedScreenshot(canvas) {
    try {
        // Create an even smaller version of the canvas for the screenshot
        const maxDimension = 400; // Reducing max dimension for smaller file size
        
        // Calculate new dimensions while maintaining aspect ratio
        let width = canvas.width;
        let height = canvas.height;
        
        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = Math.floor(height * (maxDimension / width));
                width = maxDimension;
            } else {
                width = Math.floor(width * (maxDimension / height));
                height = maxDimension;
            }
        }
        
        // Create temporary canvas for resizing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        
        // Draw original canvas onto temp canvas to resize
        const ctx = tempCanvas.getContext('2d');
        ctx.fillStyle = '#000'; // Ensure background is filled
        ctx.fillRect(0, 0, width, height); // Clear with black background
        ctx.drawImage(canvas, 0, 0, width, height);
        
        // Get the data URL with very reduced quality for smaller size
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.5); // More compression
        
        // Check if the data URL is not too large (max 2MB)
        if (dataUrl.length > 2 * 1024 * 1024) {
            console.warn('Screenshot too large, returning null');
            return null;
        }
        
        return dataUrl;
    } catch (error) {
        console.error('Error creating optimized screenshot:', error);
        return null;
    }
}

// Update the iteration history display
function updateIterationHistory() {
    const history = getIterationHistory();
    const historyContainer = document.getElementById('iterationHistory');
    
    // Clear existing content
    historyContainer.innerHTML = '';
    
    // Get the significant iterations (initial generation and manual iterations)
    // We only want to show the final result of each generation or iteration
    let significantIterations = [];
    
    // First, find the initial shader generation (iteration 0)
    const initialGeneration = history.find(item => item.iteration === 0);
    if (initialGeneration) {
        significantIterations.push(initialGeneration);
    }
    
    // Then, find the first iteration and any successful iteration that completes auto-iteration
    history.forEach(item => {
        if (item.iteration > 0 && (item.isManualIteration || item.isLastAutoIteration)) {
            significantIterations.push(item);
        }
    });
    
    // Add iteration items in reverse order (newest first)
    significantIterations.slice().reverse().forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'iteration-item';
        
        // Create thumbnail
        const thumbnail = document.createElement('img');
        thumbnail.src = item.imageData;
        thumbnail.className = 'iteration-thumbnail mb-2';
        
        // Create iteration header
        const header = document.createElement('div');
        header.className = 'fw-bold';
        
        // Label generation vs iteration properly
        let iterationLabel = item.iteration === 0 ? 'Initial Generation' : `Iteration ${item.iteration}`;
        header.textContent = `${iterationLabel}: ${item.success ? 'Success' : 'Failed'}`;
        
        // Create metrics display
        const metrics = document.createElement('div');
        metrics.className = 'metrics';
        metrics.textContent = item.metrics ? JSON.stringify(item.metrics) : 'No metrics available';
        
        // Assemble the item
        itemElement.appendChild(header);
        itemElement.appendChild(thumbnail);
        itemElement.appendChild(metrics);
        
        historyContainer.appendChild(itemElement);
    });
}

// Update the metrics display
function updateMetricsDisplay(metrics) {
    const metricsContainer = document.getElementById('qualityMetrics');
    
    if (!metrics) {
        metricsContainer.innerHTML = '<p>No metrics available yet.</p>';
        return;
    }
    
    // Create metrics display
    metricsContainer.innerHTML = '';
    
    // Create metrics list
    const metricsList = document.createElement('ul');
    metricsList.className = 'list-group';
    
    Object.entries(metrics).forEach(([key, value]) => {
        const item = document.createElement('li');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        const label = document.createElement('span');
        label.textContent = key;
        
        const valueSpan = document.createElement('span');
        valueSpan.className = 'badge bg-primary rounded-pill';
        valueSpan.textContent = typeof value === 'number' ? value.toFixed(2) : value;
        
        item.appendChild(label);
        item.appendChild(valueSpan);
        metricsList.appendChild(item);
    });
    
    metricsContainer.appendChild(metricsList);
}

// Initialize WebGL when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize WebGL
    initWebGL();
    
    // Show the iteration feedback field when Generate completes successfully
    document.getElementById('generateBtn').addEventListener('click', function() {
        // Hide the feedback field initially when generating a new shader
        document.getElementById('iterationFeedbackContainer').classList.add('d-none');
    });
    
    // Enable the iterate button when text is entered in the feedback field
    document.getElementById('iterationFeedback').addEventListener('input', function() {
        const feedbackText = this.value.trim();
        const iterateBtn = document.getElementById('iterateBtn');
        
        // Only enable the iterate button if there's feedback text
        if (feedbackText) {
            iterateBtn.disabled = false;
        } else {
            iterateBtn.disabled = true;
        }
    });
    
    // Make sure the iterate button is usable even after errors
    document.getElementById('compileBtn').addEventListener('click', function() {
        // When compile is clicked, show the feedback field if it's not already visible
        document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
    });
});

// End of main.js
