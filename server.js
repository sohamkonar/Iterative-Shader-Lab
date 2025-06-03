// server.js - Express server for the Iterative Shader Lab using GPT-4.1-mini

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

// Determine which model to use based on environment variables
function getModelToUse() {
  // Check if we should use the fine-tuned model
  const useFinetuned = process.env.USE_FINETUNED_MODEL === 'true' || process.env.USE_FINETUNED_MODEL === true;
  
  let model;
  if (useFinetuned && process.env.OPENAI_MODEL_NAME) {
    // Use fine-tuned model if explicitly requested and available
    model = process.env.OPENAI_MODEL_NAME;
    console.log(`Using finetuned model: ${model}`);
  } else if (process.env.OPENAI_BASE_MODEL) {
    // Otherwise use the base model if available
    model = process.env.OPENAI_BASE_MODEL;
    console.log(`Using base model: ${model}`);
  } else {
    // Fall back to gpt-4.1-mini as default
    model = "gpt-4.1-mini";
    console.log(`Using default model: ${model}`);
  }
  
  // Ensure we always return a valid model name
  if (!model || model.trim() === '') {
    console.log('No valid model found in environment, falling back to gpt-4.1-mini');
    return "gpt-4.1-mini";
  }
  
  return model;
}

const app = express();
const PORT = process.env.PORT || 3000;

// Read API key from env var
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: process.env.OPENAI_API_KEY is not set.');
  process.exit(1);
}

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static assets
app.use(express.static('public'));
// Serve JavaScript files
app.use('/js', express.static(path.join(__dirname, 'public/js')));
// Serve CSS files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
// Serve screenshots
app.use('/screenshots', express.static(path.join(__dirname, 'screenshots')));

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
  console.log('Created screenshots directory:', screenshotsDir);
} else {
  console.log('Screenshots directory exists:', screenshotsDir);
}

// LLM-powered shader generation endpoint
app.post('/api/generate-shader', async (req, res) => {
  const { prompt } = req.body;
  
  try {
    // Call OpenAI API - for initial generation, use the finetuned model
    // This is one of the two places where the finetuned model should be used
    // (the other is the first manual iteration)
    let modelToUse = getModelToUse();
    
    // Ensure we have a valid model to use
    if (!modelToUse || modelToUse.trim() === '') {
      console.log('modelToUse is empty or undefined in shader generation, falling back to gpt-4.1-mini');
      modelToUse = 'gpt-4.1-mini';
    }
    
    console.log(`Using model for initial shader generation: ${modelToUse} (finetuned model if available)`);
    
    // Determine if we're using the finetuned model to include specific instructions
    const usingFinetunedModel = process.env.USE_FINETUNED_MODEL === 'true';
    
    // Base system content that's common to both models
    let systemContent = "You are an expert GLSL shader programmer specializing in fragment shaders like those used in Shadertoy. You have been finetuned on a large collection of Shadertoy examples. Write high-quality, efficient WebGL fragment shaders based on descriptions.\n\nCRITICAL REQUIREMENT: YOUR RESPONSE MUST INCLUDE ACTUAL SHADER CODE. Do not just discuss techniques or examples without implementing them.\n\nIMPORTANT REFERENCE APPROACH:\n- Use your knowledge of Shadertoy examples as reference for the requested effect\n- Keep explanations brief (max 2-3 sentences) about what techniques you're using\n- DO NOT copy or paste descriptions from Shadertoy without implementation\n- Focus on implementing the shader rather than just discussing examples\n\nSTRICT OUTPUT FORMAT (YOU MUST FOLLOW THIS EXACTLY):\n1. Brief explanation (2-3 sentences maximum)\n2. The '#-- FRAGMENT SHADER --#' marker\n3. Your complete, working shader code\n\nEXACT FORMAT EXAMPLE:\nI'm implementing this effect using ray marching with soft shadows. I'm taking inspiration from volumetric lighting techniques commonly used in atmospheric shaders.\n\n#-- FRAGMENT SHADER --#\nprecision mediump float;\n\nvoid main() {\n  // shader code here\n}\n\nCODE REQUIREMENTS:\n- Your code MUST be compilable in WebGL (GLSL ES 1.0)\n- Your code will run in a fixed vertex shader environment that provides normalized UV coordinates in a varying called 'vUv'\n- You only need to write the fragment shader - DO NOT include any vertex shader code\n- Focus on implementing a working shader that matches the request\n\nAvailable uniforms:\n- uTime (float): Time in seconds for animations\n- uResolution (vec2): Canvas dimensions in pixels\n- uMouse (vec2): Normalized mouse position (0.0-1.0)\n- uMouseClick (vec2): Normalized position of the last mouse click\n- uIsMouseDown (int): Boolean flag for mouse button state\n- uFrame (int): Frame counter for animation control\n- uAspect (float): Canvas aspect ratio for proper proportions";
    
    // Add special instructions for the finetuned model
    if (usingFinetunedModel) {
      systemContent += "\n\nSPECIAL INSTRUCTIONS FOR FINETUNED MODEL:\n- Use the training data ONLY as examples to reference concepts and techniques\n- DO NOT copy code directly from training examples\n- Instead, derive inspiration and apply similar techniques creatively\n- Your output MUST adhere exactly to the specified format with the '#-- FRAGMENT SHADER --#' separator\n- Ensure your shader code is original while building on concepts from the training data\n- Focus on producing high-quality, creative, and functional shader code that matches the requested description";
    }
    
    const completion = await openai.chat.completions.create({
      model: modelToUse,
      messages: [
        { "role": "system", "content": systemContent },
        { "role": "user", "content": `Create a shader that produces: ${prompt}` }
      ]
    });

    // There are no screenshots in the initial generation request, but we'll add the field for consistency
    res.json({ 
      response: completion.choices[0].message.content,
      savedScreenshots: []
    });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate shader' });
  }
});

// Reflexion-based shader iteration endpoint
app.post('/api/iterate-shader', async (req, res) => {
  // Declare variables at the function scope so they're available throughout the function
  let modelToUse;
  let supportsImageInput = false;
  let savedScreenshots = [];
  console.log('=== ITERATE ENDPOINT CALLED ===');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    // Log the request size to check if it's too large
    const requestSize = JSON.stringify(req.body).length;
    console.log(`Request size: ${requestSize} bytes`);
    
    const { prompt, fragmentShader, userFeedback, screenshots = [], iteration = 0, isAutoIteration = false } = req.body;
    console.log('Prompt length:', prompt ? prompt.length : 'undefined');
    console.log('Current fragment shader length:', fragmentShader ? fragmentShader.length : 'undefined');
    console.log('User feedback:', userFeedback || 'None provided');
    console.log('Iteration:', iteration);
    console.log('Screenshots count:', screenshots.length);
    
    // Process screenshots if available
    savedScreenshots = [];
    
    // Save screenshots to the screenshots directory
    if (screenshots.length > 0) {
      console.log('First screenshot length:', screenshots[0].length);
      console.log('Screenshot type:', screenshots[0].substring(0, 30) + '...');
      
      // Save each screenshot to disk and get filenames
      savedScreenshots = saveScreenshots(screenshots, iteration);
    }
    
    const MAX_ITERATIONS = 5;
    const TARGET_SSIM = 0.85;
    
    // Validate required inputs
    if (!fragmentShader) {
      console.log('ERROR: Missing fragment shader code');
      return res.status(400).json({ error: 'Missing fragment shader code' });
    }
    
    // Create messages array starting with the system prompt
    console.log('Creating messages array for OpenAI API...');
    // Determine if we're using the finetuned model to include specific instructions
    const usingFinetunedModel = process.env.USE_FINETUNED_MODEL === 'true';
    
    // Base system content that's common to both models
    let systemContent = "You are an expert GLSL shader programmer specializing in fragment shaders like those used in Shadertoy. You have been finetuned on a large collection of Shadertoy examples. Implement Reflexion-style self-improvement to iteratively refine shader code based on feedback.\n\nCRITICAL REQUIREMENT: YOUR RESPONSE MUST INCLUDE ACTUAL IMPROVED SHADER CODE. Do not just discuss techniques or examples without implementing them.\n\nIMPORTANT REFERENCE APPROACH:\n- Use your knowledge of Shadertoy examples as reference for the requested fixes\n- Keep explanations brief (max 2-3 sentences) about what issues you're addressing\n- DO NOT copy or paste descriptions from Shadertoy without implementation\n- Focus on implementing the fixes rather than just discussing approaches\n\nSTRICT OUTPUT FORMAT (YOU MUST FOLLOW THIS EXACTLY):\n1. Brief reflection on issues (2-3 sentences maximum)\n2. The '#-- FRAGMENT SHADER --#' marker\n3. Your complete, working improved shader code\n\nEXACT FORMAT EXAMPLE:\nI've fixed the shadowing artifacts by adjusting the ray marching epsilon value and improving the normal calculation precision. I've also optimized the lighting calculations to reduce unnecessary iterations.\n\n#-- FRAGMENT SHADER --#\nprecision mediump float;\n\nvoid main() {\n  // improved shader code here\n}\n\nCODE REQUIREMENTS:\n- Your code MUST be compilable in WebGL (GLSL ES 1.0)\n- Your code will run in a fixed vertex shader environment that provides normalized UV coordinates in a varying called 'vUv'\n- You only need to write the fragment shader - DO NOT include any vertex shader code\n- Focus on implementing a working shader that addresses the feedback\n\nAvailable uniforms:\n- uTime (float): Time in seconds for animations\n- uResolution (vec2): Canvas dimensions in pixels\n- uMouse (vec2): Normalized mouse position (0.0-1.0)\n- uMouseClick (vec2): Normalized position of the last mouse click\n- uIsMouseDown (int): Boolean flag for mouse button state\n- uFrame (int): Frame counter for animation control\n- uAspect (float): Canvas aspect ratio for proper proportions\n\nIMPORTANT DEBUGGING APPROACH:\n- Analyze compilation errors and visual issues carefully\n- Ensure numerical stability in mathematical operations\n- Fix edge cases and potential divide-by-zero scenarios\n- Optimize for performance where possible\n- Verify your fixes with mental tracing of the shader execution";
    
    // Add special instructions for the finetuned model
    if (usingFinetunedModel) {
      systemContent += "\n\nSPECIAL INSTRUCTIONS FOR FINETUNED MODEL:\n- Use the training data ONLY as examples to reference concepts and techniques\n- DO NOT copy code directly from training examples\n- Instead, derive inspiration and apply similar techniques creatively\n- Your output MUST adhere exactly to the specified format with the '#-- FRAGMENT SHADER --#' separator\n- Ensure your shader code is original while building on concepts from the training data\n- Focus on producing high-quality, creative fixes that address the specific issues while maintaining the shader's intended functionality";
    }
    
    const messages = [
      {
        "role": "system", 
        "content": systemContent
      }
    ];
    
    // If this is an iteration (not the first generation)
    if (iteration > 0) {
      console.log(`Processing iteration ${iteration}`);
      
      // Add the previous code as an assistant message
      console.log('Adding previous shader code as assistant message');
      messages.push({
        "role": "assistant",
        "content": `${fragmentShader}`
      });
      
      // Determine which model to use - MOVED UP BEFORE SCREENSHOT PROCESSING
      // Following specific rules for model selection:
      // 1. Only use finetuned model for initial generation and first manual iteration
      // 2. Use gpt-4.1-mini for all auto-iterations and subsequent manual iterations
      
      if (isAutoIteration) {
        // For auto-iteration, always use gpt-4.1-mini
        modelToUse = "gpt-4.1-mini";
        supportsImageInput = true; // gpt-4.1-mini supports image input
        console.log(`Auto-iteration flag is true. Using model: ${modelToUse}`);
      } else {
        // For manual iterations, only use finetuned model for the first iteration (iteration = 0)
        if (iteration === 0) {
          // First manual iteration - use finetuned model if available
          modelToUse = getModelToUse();
          console.log(`First manual iteration. Using model from settings: ${modelToUse}`);
        } else {
          // Subsequent manual iterations - always use gpt-4.1-mini
          modelToUse = "gpt-4.1-mini";
          console.log(`Subsequent manual iteration (${iteration}). Using model: ${modelToUse}`);
        }
        
        // Check if the model supports image input
        // Currently only certain OpenAI models support image input
        const imageCompatibleModels = [
          'gpt-4-vision-preview', 'gpt-4-turbo', 'gpt-4-turbo-preview', 
          'gpt-4-1106-vision-preview', 'gpt-4-0125-preview',
          'gpt-4.1-preview', 'gpt-4.1-mini', 'gpt-4-1106-preview',
          'gpt-4o', 'gpt-4o-mini'
        ];
        
        supportsImageInput = imageCompatibleModels.includes(modelToUse);
        console.log(`Manual iteration. Using model: ${modelToUse} (${supportsImageInput ? 'supports' : 'does not support'} image input)`);
      }
      
      // Create a text feedback message based on the iteration number and user feedback
      console.log('Creating feedback text based on iteration number and user feedback...');
      let feedbackText = `Iteration ${iteration}: Evaluate and improve the previous shader `;
      
      // Add user's specific feedback if available
      if (req.body.userFeedback) {
        console.log('User provided specific feedback:', req.body.userFeedback);
        feedbackText = `Iteration ${iteration}: ${req.body.userFeedback}\n\nEvaluate and improve the shader according to this user feedback. `;
      } else {
        // If no specific user feedback, use a default message
        feedbackText += 'to make it more efficient and visually appealing.';
      }
      
      feedbackText += '\n\nWrite a brief one-sentence reflection identifying the key issues. Then provide the complete improved shader code.';
      
      // Check if we can include images - only for models that support image input
      if (screenshots && screenshots.length > 0 && supportsImageInput) {
        // Process images only if the model supports image input
        console.log('Processing screenshot for API request');
        try {
          // Try to create a message with images
          const userMessage = {
            "role": "user",
            "content": [
              { "type": "text", "text": feedbackText }
            ]
          };
          
          // Add up to 3 screenshots, but check size of each
          // Process screenshots up to a maximum of 3
          const MAX_SCREENSHOTS = 1;
          let processedCount = 0;
          let totalSize = 0;
          
          for (let i = 0; i < screenshots.length && i < MAX_SCREENSHOTS; i++) {
            const screenshot = screenshots[i];
            if (screenshot && screenshot.startsWith('data:image')) {
              try {
                // Check if the base64 data is valid and not too large
                const base64Data = screenshot.split(',')[1];
                const size = base64Data.length;
                
                // Keep track of total size to stay within reasonable limits
                totalSize += size;
                
                // Validate base64 data and total size
                if (base64Data && size < 1024 * 1024 && totalSize < 3 * 1024 * 1024) { // 1MB per image, 3MB total
                  // Use image_url format with data URI
                  userMessage.content.push({
                    "type": "image_url",
                    "image_url": {
                      // Use the full data URI (including the prefix)
                      "url": screenshot
                    }
                  });
                  processedCount++;
                  console.log(`Added screenshot ${i+1} (${Math.round(size/1024)}KB) to API request`);
                } else {
                  console.warn(`Screenshot ${i+1} too large (${Math.round(size/1024)}KB) or total size exceeds limit, skipping`);
                  break; // Stop adding more if we hit the size limit
                }
              } catch (base64Error) {
                console.error(`Error processing base64 image data for screenshot ${i+1}:`, base64Error);
                // Continue without this image
              }
            }
          }
          
          console.log(`Added ${processedCount} screenshots to API request (total size: ${Math.round(totalSize/1024)}KB)`);
          
          messages.push(userMessage);
        } catch (imgError) {
          console.error('Error processing image for API:', imgError);
          // Fallback to text-only if image processing fails
          messages.push({
            "role": "user",
            "content": feedbackText
          });
        }
      } else {
        // For models that don't support image input or if no screenshots are available
        if (screenshots && screenshots.length > 0 && !supportsImageInput) {
          console.log('Model does not support image input. Using text-only message.');
        }
        
        // Text-only message
        messages.push({
          "role": "user",
          "content": feedbackText
        });
      }
    } else {
      // First generation: just add the user prompt
      messages.push({
        "role": "user",
        "content": `Create a shader that produces: ${prompt}`
      });
    }
    
    // Call OpenAI API with the constructed messages
    console.log('Preparing to call OpenAI API...');
    console.log('Messages count:', messages.length);
    try {
      
      // Call the API with detailed error handling
      console.log('Making API call...');
      
      // Ensure we have a valid model to use
      if (!modelToUse || modelToUse.trim() === '') {
        console.log('modelToUse is empty or undefined, falling back to gpt-4.1-mini');
        modelToUse = 'gpt-4.1-mini';
      }
      
      console.log(`Using model for API call: ${modelToUse}`);
      const completion = await openai.chat.completions.create({
        model: modelToUse,
        messages: messages
      });
      
      console.log('API call successful!');
      
      if (!completion || !completion.choices || !completion.choices[0]) {
        console.error('Unexpected API response structure:', JSON.stringify(completion));
        throw new Error('Invalid API response structure');
      }
      
      const responseContent = completion.choices[0].message.content;
      console.log('Response content length:', responseContent.length);
      console.log('Response preview:', responseContent.substring(0, 100) + '...');
      
      let reflection = "";
      
      // Extract reflection if this is an iteration
      if (iteration > 0) {
        console.log('Extracting reflection from response...');
        const reflectionMatch = responseContent.match(/Reflection:\s*(.*?)\n/i);
        if (reflectionMatch && reflectionMatch[1]) {
          reflection = reflectionMatch[1].trim();
          console.log('Extracted reflection:', reflection);
        } else {
          console.log('No reflection found in response');
        }
      }
      
      res.json({
        response: responseContent,
        reflection: reflection,
        iteration: iteration,
        savedScreenshots: savedScreenshots || []
      });
    } catch (apiError) {
      console.error('OpenAI API call failed:', apiError);
      throw apiError; // Re-throw to be caught by the outer try-catch
    }
  } catch (error) {
    console.error('===== ERROR IN ITERATION PROCESS =====');
    console.error('Error message:', error.message);
    console.error('Error name:', error.name);
    console.error('Error stack:', error.stack);
    
    // Check for specific error types to provide better diagnostics
    if (error.response) {
      // OpenAI API error with response
      console.error('OpenAI API error response:', error.response.status);
      console.error('OpenAI API error data:', JSON.stringify(error.response.data));
    } else if (error.request) {
      // Network error or no response
      console.error('Network error or no response from API');
      console.error('Request details:', error.request);
    }
    
    // Send a more detailed error response to the client
    res.status(500).json({ 
      error: 'Failed to iterate on shader', 
      message: error.message,
      type: error.name
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('404: Page not found');
});

/**
 * Save screenshots to the screenshots directory
 * @param {Array<string>} screenshots - Array of base64 encoded screenshots
 * @param {number} iteration - Current iteration number
 * @returns {Array<string>} - Array of saved screenshot filenames
 */
function saveScreenshots(screenshots, iteration) {
  const savedScreenshots = [];
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    screenshots.forEach((screenshot, index) => {
      // Only process if it's a valid data URL
      if (screenshot && screenshot.startsWith('data:image')) {
        // Extract the base64 data and image type
        const matches = screenshot.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (matches && matches.length === 3) {
          const imageType = matches[1];
          const base64Data = matches[2];
          const extension = imageType.split('/')[1] || 'png';
          
          // Create filename with iteration, timestamp, and index
          const filename = `screenshot_iter${iteration}_${timestamp}_${index}.${extension}`;
          const filePath = path.join(screenshotsDir, filename);
          
          // Write the file to disk
          fs.writeFileSync(filePath, base64Data, 'base64');
          console.log(`Saved screenshot to ${filePath}`);
          
          // Add the filename to the return array
          savedScreenshots.push(filename);
        }
      }
    });
  } catch (error) {
    console.error('Error saving screenshots:', error);
  }
  return savedScreenshots;
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
