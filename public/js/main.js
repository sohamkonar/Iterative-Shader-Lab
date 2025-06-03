// main.js - Application orchestration logic

// Global imports for the application
import { ShaderEvaluator } from './shaderEvaluator.js';
import * as ShaderRenderer from './shaderRenderer.js';

// Global variables
let canvas;
let gl;
let shaderEvaluator;
let currentIteration = 0;
let shaderEditor; // CodeMirror editor instance
let buttonAnimationInterval = null; // For button loading animation

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
        document.getElementById('themeToggle').addEventListener('click', toggleTheme);
        
        // Initialize CodeMirror editor with default fragment shader code
        const textArea = document.getElementById('fragmentShaderCode');
        shaderEditor = CodeMirror.fromTextArea(textArea, {
            mode: 'x-shader/x-fragment',
            theme: 'monokai',
            lineNumbers: true,
            matchBrackets: true,
            indentUnit: 4,
            lineWrapping: true,
            tabSize: 4,
            autofocus: false,
            readOnly: false
        });
        
        // Set the default fragment shader code
        shaderEditor.setValue(ShaderRenderer.defaultFragmentShader);
        
        // Make the CodeMirror instance fill its container nicely
        shaderEditor.setSize('100%', '350px');
        
        // Hide the vertex shader tab as we're only using fragment shaders now
        const vertexTab = document.getElementById('vertex-tab');
        if (vertexTab) {
            vertexTab.classList.add('d-none');
        }
    } catch (error) {
        alert('WebGL initialization error: ' + error.message);
    }
}

// These functions have been moved to shaderRenderer.js

// Handle Generate button click with auto-iteration until success
async function handleGenerateClick() {
    // Get the prompt from the textarea
    const prompt = document.getElementById('shaderPrompt').value.trim();
    // Track if compilation succeeds, used later in finally block
    let compilationSuccess = false;
    
    const generateBtn = document.getElementById('generateBtn');
    const iterateBtn = document.getElementById('iterateBtn');
    const compileBtn = document.getElementById('compileBtn');
    
    generateBtn.disabled = true;
    iterateBtn.disabled = true;
    compileBtn.disabled = true;
    
    // Start animation for generate button
    startButtonAnimation(generateBtn, 'Generating');
    
    // Clear previous iteration history
    localStorage.removeItem('shaderIterationHistory');
    updateIterationHistory();
    
    // Reset iteration counter when generating a new shader
    iterationCounter = 0;
    
    try {
        updateStatusMessage('Generating shader from description...');
        
        // Call the API to generate the shader
        const prompt = document.getElementById('shaderPrompt').value;
        const result = await generateShader(prompt);
        
        if (result) {
            // Update the CodeMirror editor with the fragment shader code
            shaderEditor.setValue(result);
            
            // Compile and render the shader with our fixed vertex shader
            compilationSuccess = ShaderRenderer.setupShaderProgram(result);
            
            // Start auto-iteration if the shader doesn't compile successfully
            if (!compilationSuccess) {
                // Increment counter for the first iteration
                iterationCounter++;
                await autoIterateShader(prompt, result, iterationCounter);
            } else {
                // Shader compiled successfully on first try
                // Try to ensure we have the latest rendered frame
                ShaderRenderer.renderFrame();
                // Capture the canvas state
                const imageData = canvas.toDataURL('image/png');
                
                // Log the initial generation with the current iteration counter
                logIteration({
                    iteration: iterationCounter,
                    prompt,
                    fragmentShader: result,
                    success: compilationSuccess,
                    metrics: createMetrics(compilationSuccess, null),
                    imageData,
                    reflection: '',
                    isManualIteration: true,
                    isLastAutoIteration: false
                }, []); // Initial generation doesn't have saved screenshots yet
                
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
        // Stop the button animation and restore the button
        const generateBtn = document.getElementById('generateBtn');
        const compileBtn = document.getElementById('compileBtn');
        
        stopButtonAnimation(generateBtn);
        generateBtn.disabled = false;
        compileBtn.disabled = false;
        
        // Only enable iterate button if compile was successful
        document.getElementById('iterateBtn').disabled = !compilationSuccess;
    }
}

/**
 * Makes an API call to generate shader code from a prompt
 * @param {string} prompt - Text description of the desired shader effect
 * @returns {Promise<{vertexShader: string, fragmentShader: string}>} - Generated shader code
 */
async function generateShader(prompt) {
    try {
        console.log('Sending request to /api/generate-shader with prompt:', prompt);
        const response = await fetch('/api/generate-shader', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.response) {
            throw new Error('Invalid API response');
        }
        
        // Try to extract shader code from the LLM response
        console.log('Parsing LLM response for shader code...');
        const parsedResponse = ShaderRenderer.parseShaders(data.response);
        if (!parsedResponse) {
            throw new Error('Could not parse shader code from response');
        }
        
        // Display any comments from the LLM before the shader code
        const comments = extractLLMComments(data.response);
        displayLLMComments(comments);
        
        // Store the saved screenshots from the server for later use
        window.savedScreenshots = data.savedScreenshots || [];
        
        return parsedResponse;
    } catch (error) {
        console.error('Error in generateShader:', error);
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
 * Start button loading animation with dots
 * @param {HTMLElement} button - The button element to animate
 * @param {string} baseText - The base text to show (e.g., "Generating")
 */
function startButtonAnimation(button, baseText) {
    // If there's already an animation running, stop it first
    if (buttonAnimationInterval) {
        clearInterval(buttonAnimationInterval);
        buttonAnimationInterval = null;
    }
    
    // Store original text if not already stored
    if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
    }
    
    // Capture the exact width with the original text
    // First, store the current text
    const currentText = button.textContent;
    
    // Then temporarily set the text back to original to measure exact width
    button.textContent = button.dataset.originalText;
    const exactWidth = button.offsetWidth;
    
    // Restore current text (which will be immediately changed below)
    button.textContent = currentText;
    
    // Fix the width to exactly match the original text width
    button.style.width = `${exactWidth}px`;
    
    // Initialize animation state
    let dotCount = 0;
    button.textContent = `${baseText}${'.'.repeat(dotCount)}${' '.repeat(3-dotCount)}`;
    
    // Start new animation interval
    buttonAnimationInterval = setInterval(() => {
        // Only update if the button still exists in the DOM
        if (button && button.isConnected) {
            // Cycle through 0, 1, 2, 3 dots
            dotCount = (dotCount + 1) % 4;
            button.textContent = `${baseText}${'.'.repeat(dotCount)}${' '.repeat(Math.max(0, 3-dotCount))}`;
        } else {
            // Button was removed, clear the interval
            clearInterval(buttonAnimationInterval);
            buttonAnimationInterval = null;
        }
    }, 500); // Change every half second
}

/**
 * Stop button loading animation
 * @param {HTMLElement} button - The button element to restore
 */
function stopButtonAnimation(button) {
    // Clear the animation interval if it exists
    if (buttonAnimationInterval) {
        clearInterval(buttonAnimationInterval);
        buttonAnimationInterval = null;
    }
    
    // Only proceed if the button exists and is connected to the DOM
    if (button && button.isConnected) {
        // Restore original text if available
        if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            delete button.dataset.originalText;
        }
        
        // Let CSS handle the styling via the class rules
        // This ensures consistent button appearance
        button.style.width = '';
    }
}

/**
 * Extract LLM comments from the response
 * @param {string} response - Raw LLM response text
 * @returns {string} - Extracted comments
 */
function extractLLMComments(response) {
    const fragmentMarker = '#-- FRAGMENT SHADER --#';
    
    if (response.includes(fragmentMarker)) {
        // Extract everything before the marker
        const commentsPart = response.substring(0, response.indexOf(fragmentMarker)).trim();
        return commentsPart;
    }
    
    // If no marker, return empty string
    return '';
}

/**
 * Display LLM comments in the UI
 * @param {string} comments - LLM comments text
 */
function displayLLMComments(comments) {
    const commentsContainer = document.getElementById('llmCommentsContainer');
    const commentsElement = document.getElementById('llmComments');
    
    if (comments && comments.trim().length > 0) {
        commentsElement.textContent = comments;
        commentsContainer.classList.remove('d-none');
    } else {
        commentsElement.textContent = '';
        commentsContainer.classList.add('d-none');
    }
}

/**
 * Update status message in UI
 * @param {string} message - Status message to display
 */
function updateStatusMessage(message) {
    console.log('Status:', message);
    
    // Create or update status message element
    let statusElement = document.getElementById('statusMessage');
    
    if (!statusElement) {
        // Create the status message element if it doesn't exist
        statusElement = document.createElement('div');
        statusElement.id = 'statusMessage';
        statusElement.className = 'alert alert-info mt-2';
        
        // Insert after the canvas
        const canvasContainer = document.querySelector('#glCanvas').parentElement;
        canvasContainer.appendChild(statusElement);
    }
    
    // Update the message text
    statusElement.textContent = message;
    
    // Show the message
    statusElement.classList.remove('d-none');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        statusElement.classList.add('fade-out');
        setTimeout(() => {
            statusElement.classList.add('d-none');
            statusElement.classList.remove('fade-out');
        }, 500);
    }, 5000);
}

/**
 * Log an iteration to history
 * @param {object} iteration - Iteration data to log
 * @param {array} savedScreenshots - Array of saved screenshot filenames from the server
 */
function logIteration(iteration, savedScreenshots = []) {
    // If we have saved screenshots from the server, store their URLs instead of base64 data
    if (savedScreenshots && savedScreenshots.length > 0) {
        // Use the first screenshot for the history item
        iteration.savedScreenshotUrl = `/screenshots/${savedScreenshots[0]}`;
    }
    
    // Ensure we have image data for this iteration
    if (!iteration.imageData && !iteration.savedScreenshotUrl) {
        // Use a default image or create a blank one
        console.warn('No image data available for iteration ' + iteration.iteration);
        iteration.imageData = canvas.toDataURL('image/png');
    }
    
    const history = getIterationHistory() || [];
    history.push(iteration);
    localStorage.setItem('shaderIterationHistory', JSON.stringify(history));
    console.log('Logged iteration:', iteration.iteration);
    console.log('History size:', history.length, 'items');
    if (iteration.savedScreenshotUrl) {
        console.log('Using saved screenshot URL:', iteration.savedScreenshotUrl);
    }
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
    const fragmentShaderCode = shaderEditor.getValue();
    
    const success = ShaderRenderer.setupShaderProgram(fragmentShaderCode);
    
    if (!success) {
        document.getElementById('iterateBtn').disabled = true;
    } else {
        document.getElementById('iterateBtn').disabled = false;
    }
}

// Common auto-iteration function used by both handleGenerateClick and handleIterateClick
async function autoIterateShader(prompt, initialFragmentShader, currentIteration, userFeedback = null) {
    const MAX_AUTO_ITERATIONS = 3;
    let autoIterationCount = 0; // Count auto-iterations separately
    let currentFragmentShader = initialFragmentShader;
    let success = false;
    
    // Find the iterate button to update during auto-iterations
    const iterateBtn = document.getElementById('iterateBtn');
    updateStatusMessage(`Iteration ${currentIteration}...`);
    
    try {
        while (autoIterationCount < MAX_AUTO_ITERATIONS) {
            // Update button text to show simple 'Iterating' text with animation
            startButtonAnimation(iterateBtn, 'Iterating');
            
            // Get the evaluation from our shader evaluator
            let evaluation = null;
            
            try {
                evaluation = shaderEvaluator.evaluateShader(currentFragmentShader);
                console.log('Shader evaluation:', evaluation);
            } catch (evalError) {
                console.error('Error during shader evaluation:', evalError);
            }
            
            // Only try to get a screenshot if the shader is actually compiling
            let screenshot = null;
            let storageThumbnail = null;
            
            // Try to ensure we have the latest rendered frame
            if (ShaderRenderer.isCompiled()) {
                ShaderRenderer.renderFrame();
                // Now get a screenshot for the current state of the shader
                screenshot = getOptimizedScreenshot(canvas);
                // Create a smaller thumbnail for localStorage
                storageThumbnail = getThumbnailForStorage(canvas);
            } else {
                console.log('Cannot capture screenshot - shader not compiled');
            }
            
            // Save the current state of the iteration with its screenshot before requesting improvements
            logIteration({
                iteration: currentIteration,
                prompt,
                fragmentShader: currentFragmentShader,
                success: false, // It's not successful yet, that's why we're iterating
                metrics: createMetrics(false, evaluation),
                imageData: storageThumbnail || canvas.toDataURL('image/png'), // Fallback to regular screenshot
                reflection: '',
                isManualIteration: false,
                isLastAutoIteration: false
            }, []); // Empty array as we don't have saved screenshots from server yet
            
            // Update the iteration history display
            updateIterationHistory();
            
            try {
                // Call the API to refine the shader
                const response = await fetch('/api/iterate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt, 
                        currentFragment: currentFragmentShader,
                        evaluation,
                        screenshots: screenshot ? [screenshot] : [],
                        iteration: currentIteration - 1, // Use the previous iteration number since we incremented it
                        userFeedback: userFeedback || 'Fix the shader compilation errors and improve the visual quality'
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                
                const data = await response.json();
                
                if (!data.response) {
                    throw new Error('Empty response from server');
                }
                
                // Parse the response
                const responseContent = data.response;
                const reflection = data.reflection || '';
                const newIterationCounter = data.iteration || currentIteration;
                const savedScreenshots = data.savedScreenshots || [];
                
                // Store the saved screenshots for the next iteration
                window.savedScreenshots = savedScreenshots;
                
                // Extract and display LLM comments
                const comments = extractLLMComments(responseContent);
                displayLLMComments(comments);
                
                // Parse the shader code from the LLM response
                currentFragmentShader = ShaderRenderer.parseShaders(responseContent);
                
                // Update the CodeMirror editor with the new shader code
                shaderEditor.setValue(currentFragmentShader);
                
                // Try to compile the new shader
                success = ShaderRenderer.setupShaderProgram(currentFragmentShader);
                
                // Try to render one more frame to ensure the canvas has content
                let resultScreenshot = null;
                let storageThumbnail = null;
                
                if (ShaderRenderer.isCompiled()) {
                    ShaderRenderer.renderFrame();
                    // Get a screenshot of the result for the iteration history
                    resultScreenshot = getOptimizedScreenshot(canvas);
                    // Create a smaller thumbnail for localStorage
                    storageThumbnail = getThumbnailForStorage(canvas);
                } else {
                    console.log('Cannot capture result screenshot - shader not compiled');
                }
                
                // Now we're processing the next iteration with the updated shader
                // Increment iteration counter for the next iteration
                currentIteration++;
                
                // We don't log this iteration here - we'll log it at the beginning of the next loop
                // or after we break out of the loop (if this was successful or the last iteration)
                
                // If this was successful or the last iteration, log the final state
                if (success || autoIterationCount + 1 === MAX_AUTO_ITERATIONS) {
                    // Try to ensure we have the latest rendered frame
                    let finalThumbnail = storageThumbnail;
                    if (ShaderRenderer.isCompiled()) {
                        ShaderRenderer.renderFrame();
                        finalThumbnail = getThumbnailForStorage(canvas);
                    }
                    
                    // Log the final iteration state
                    logIteration({
                        iteration: currentIteration,
                        prompt,
                        fragmentShader: currentFragmentShader,
                        success,
                        metrics: createMetrics(success, evaluation),
                        imageData: finalThumbnail,
                        reflection: reflection,
                        isManualIteration: false,
                        isLastAutoIteration: true
                    }, []);
                    
                    // Update the iteration history display
                    updateIterationHistory();
                }
                
                updateStatusMessage(`Iteration ${currentIteration} successful!`);
                autoIterationCount++;
                
                if (success) {
                    // We've successfully compiled, stop iterating
                    break;
                }
                
                // Continue to the next auto-iteration if we haven't reached the limit
                if (autoIterationCount < MAX_AUTO_ITERATIONS) {
                    updateStatusMessage(`Auto-iteration ${autoIterationCount + 1}/${MAX_AUTO_ITERATIONS}...`);
                }
            } catch (error) {
                console.error('Error during auto-iteration:', error);
                updateStatusMessage(`Auto-iteration failed: ${error.message}`);
                document.getElementById('shaderError').textContent = `Auto-iteration error: ${error.message}`;
                stopButtonAnimation(iterateBtn);
                document.getElementById('shaderError').classList.remove('d-none');
                break;
            }
        }
        
        // After auto-iteration, update the UI
        // Make sure to stop the animation first
        stopButtonAnimation(iterateBtn);
        
        if (success) {
            document.getElementById('iterateBtn').disabled = false;
            document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
            updateStatusMessage('Shader compiled successfully! Enter what you want to improve and click Iterate.');
        } else {
            updateStatusMessage('Auto-iteration complete, but shader still has errors. Try manual edits.');
            document.getElementById('iterateBtn').disabled = true;
            document.getElementById('iterationFeedbackContainer').classList.remove('d-none');
        }
    } catch (error) {
        console.error('General error during auto-iteration:', error);
        updateStatusMessage('Auto-iteration failed with an error');
        document.getElementById('shaderError').textContent = `Error: ${error.message}`;
        document.getElementById('shaderError').classList.remove('d-none');
    } finally {
        document.getElementById('generateBtn').disabled = false;
        document.getElementById('compileBtn').disabled = false;
        document.getElementById('generateBtn').textContent = 'Generate Shader';
    }
}

// Handle Iterate button click
async function handleIterateClick() {
    // Get the current shader and the user's feedback
    const fragmentShaderCode = shaderEditor.getValue();
    const feedbackText = document.getElementById('iterationFeedback').value.trim();
    
    if (!feedbackText) {
        alert('Please enter feedback on what you would like to improve');
        return;
    }
    
    const iterateBtn = document.getElementById('iterateBtn');
    const generateBtn = document.getElementById('generateBtn');
    const compileBtn = document.getElementById('compileBtn');
    
    iterateBtn.disabled = true;
    generateBtn.disabled = true;
    compileBtn.disabled = true;
    
    // Start animation for iterate button
    startButtonAnimation(iterateBtn, 'Iterating');
    
    // Get the original prompt
    const prompt = document.getElementById('shaderPrompt').value;
    
    // Iterate on the shader with current iteration count
    try {
        // Increment the global iteration counter
        iterationCounter++;
        // Pass the user's feedback to autoIterateShader
        await autoIterateShader(prompt, fragmentShaderCode, iterationCounter, feedbackText);
        
        // Ensure the button animation is stopped (in case autoIterateShader didn't)
        const iterateBtn = document.getElementById('iterateBtn');
        stopButtonAnimation(iterateBtn);
    } catch (error) {
        console.error('Error during iteration:', error);
        document.getElementById('shaderError').textContent = `Iteration error: ${error.message}`;
        document.getElementById('shaderError').classList.remove('d-none');
    } finally {
        // Stop the button animation and restore buttons
        const iterateBtn = document.getElementById('iterateBtn');
        const generateBtn = document.getElementById('generateBtn');
        const compileBtn = document.getElementById('compileBtn');
        
        stopButtonAnimation(iterateBtn);
        
        iterateBtn.disabled = false;
        generateBtn.disabled = false;
        compileBtn.disabled = false;
    }
}

// Reflection feedback is now handled directly in the iteration history UI

/**
 * Get an optimized screenshot from the canvas for sending to LLM
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

/**
 * Get a tiny thumbnail version of the canvas for storing in localStorage
 * @param {HTMLCanvasElement} canvas - The WebGL canvas element
 * @returns {string|null} - Base64 encoded thumbnail data, or null if failed
 */
function getThumbnailForStorage(canvas) {
    try {
        // Create an extremely small version of the canvas for localStorage
        const maxDimension = 150; // Very small for localStorage storage
        
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
        
        // Get the data URL with minimal quality for storage
        const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.25); // Extreme compression for localStorage
        
        return dataUrl;
    } catch (error) {
        console.error('Error creating thumbnail:', error);
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
        
        // Create thumbnail with click functionality to restore shader
        const thumbnail = document.createElement('img');
        // Use the saved screenshot URL if available, otherwise fall back to base64 data
        thumbnail.src = item.savedScreenshotUrl || item.imageData;
        thumbnail.className = 'iteration-thumbnail mb-2 cursor-pointer';
        thumbnail.title = 'Click to restore this shader';
        
        // Add click handler to restore this shader
        thumbnail.addEventListener('click', () => {
            // Restore the shader code to the editor
            shaderEditor.setValue(item.fragmentShader);
            
            // Compile and render the restored shader
            const success = ShaderRenderer.setupShaderProgram(item.fragmentShader);
            
            // Update UI based on compilation result
            document.getElementById('iterateBtn').disabled = !success;
            
            // Show a message
            updateStatusMessage(`Restored ${iterationLabel}`);
        });
        
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

// Global counter for iterations
let iterationCounter = 0;

/**
 * Toggle between dark and light theme
 */
function toggleTheme() {
    const htmlElement = document.documentElement;
    const themeToggleBtn = document.getElementById('themeToggle');
    const iconElement = themeToggleBtn.querySelector('i');
    const currentTheme = htmlElement.getAttribute('data-theme');
    
    // Toggle theme on document and CodeMirror simultaneously
    if (currentTheme === 'dark') {
        // Switch to light mode
        htmlElement.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        iconElement.className = 'fa-solid fa-moon'; // Show moon in light mode
        shaderEditor.setOption('theme', 'eclipse');
    } else {
        // Switch to dark mode
        htmlElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        iconElement.className = 'fa-solid fa-sun'; // Show sun in dark mode
        shaderEditor.setOption('theme', 'monokai');
    }
}

/**
 * Initialize theme based on user preference or system preference
 */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeToggleBtn = document.getElementById('themeToggle');
    const iconElement = themeToggleBtn.querySelector('i');
    const shouldUseDarkTheme = savedTheme === 'dark' || 
        (!savedTheme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Apply theme to the document and CodeMirror simultaneously
    if (shouldUseDarkTheme) {
        document.documentElement.setAttribute('data-theme', 'dark');
        iconElement.className = 'fa-solid fa-sun';
        
        // Set CodeMirror theme if editor is initialized
        if (shaderEditor) {
            shaderEditor.setOption('theme', 'monokai');
        }
    } else {
        document.documentElement.removeAttribute('data-theme');
        iconElement.className = 'fa-solid fa-moon';
        
        // Set CodeMirror theme if editor is initialized
        if (shaderEditor) {
            shaderEditor.setOption('theme', 'eclipse');
        }
    }
}

/**
 * Initialize speech recognition for a specific textarea
 * @param {string} buttonId - ID of the microphone button
 * @param {string} textareaId - ID of the textarea to receive transcribed text
 */
function initSpeechRecognition(buttonId, textareaId) {
    const micButton = document.getElementById(buttonId);
    const textarea = document.getElementById(textareaId);
    
    // Check if browser supports Speech Recognition
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.error('Speech recognition not supported in this browser');
        micButton.disabled = true;
        micButton.title = 'Speech recognition not supported in this browser';
        return;
    }
    
    // Create a speech recognition instance
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    // Configure speech recognition
    recognition.continuous = true; // Set to true to allow silence detection
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    // Silence detection - will stop recording after 3 seconds of silence
    const SILENCE_TIMEOUT = 2000; // 2 seconds
    let silenceTimer = null;
    
    let finalTranscript = '';
    let isRecording = false;
    
    // Handle microphone button click
    micButton.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
            micButton.classList.remove('recording');
            micButton.title = 'Use speech-to-text';
        } else {
            // Save the original text before starting
            originalText = textarea.value.trim();
            
            // Reset transcript and update UI
            finalTranscript = '';
            micButton.classList.add('recording');
            micButton.title = 'Stop recording';
            
            // Start listening
            try {
                recognition.start();
                isRecording = true;
            } catch (error) {
                console.error('Speech recognition error:', error);
                micButton.classList.remove('recording');
            }
        }
    });
    
    // Store the original text that was in the textarea before recording started
    let originalText = '';
    
    // Handle results
    recognition.onresult = (event) => {
        // Reset silence timer whenever speech is detected
        if (silenceTimer) {
            clearTimeout(silenceTimer);
        }
        
        // Set a new silence timer
        silenceTimer = setTimeout(() => {
            if (isRecording) {
                recognition.stop();
            }
        }, SILENCE_TIMEOUT);
        
        let interimTranscript = '';
        finalTranscript = '';
        
        // Process all results, separating final from interim
        for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Always start with the original text that was in the textarea before recording
        let newText = originalText;
        
        // Add a space if there was original text
        if (newText && (finalTranscript || interimTranscript)) {
            newText += ' ';
        }
        
        // Add final transcript first (the confirmed speech)
        if (finalTranscript) {
            newText += finalTranscript.trim();
        }
        
        // Add interim transcript (the currently being processed speech)
        if (interimTranscript) {
            // If we have both final and interim, add a space in between
            if (finalTranscript) newText += ' ';
            newText += interimTranscript;
        }
        
        // Update the textarea with the complete text
        textarea.value = newText;
    };
    
    // Handle end of speech recognition
    recognition.onend = () => {
        isRecording = false;
        micButton.classList.remove('recording');
        micButton.title = 'Use speech-to-text';
        
        // Manually trigger an input event on the textarea to enable buttons
        // This is needed because the automatic silence detection doesn't trigger an input event
        if (textarea.value.trim().length > 0) {
            // Create and dispatch an input event
            const inputEvent = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            textarea.dispatchEvent(inputEvent);
        }
    };
    
    // Handle errors
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isRecording = false;
        micButton.classList.remove('recording');
        micButton.title = 'Use speech-to-text';
        
        // Also trigger an input event in case of error to ensure buttons are enabled
        if (textarea.value.trim().length > 0) {
            // Create and dispatch an input event
            const inputEvent = new Event('input', {
                bubbles: true,
                cancelable: true,
            });
            textarea.dispatchEvent(inputEvent);
        }
    };
}

// Initialize WebGL when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize WebGL
    initWebGL();
    
    // Initialize speech recognition for shader prompt and iteration feedback
    initSpeechRecognition('shaderPromptMic', 'shaderPrompt');
    initSpeechRecognition('iterationFeedbackMic', 'iterationFeedback');
    
    // Initialize theme after DOM is loaded
    initTheme();
    
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
