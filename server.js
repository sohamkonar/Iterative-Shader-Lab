// server.js - Express server for the Iterative Shader Lab using GPT-4.1-mini

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Configuration, OpenAIApi } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Read API key from env var
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error('ERROR: process.env.OPENAI_API_KEY is not set.');
  process.exit(1);
}

const configuration = new Configuration({
  apiKey: OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Serve static assets
app.use(express.static('public'));
// Serve JavaScript files
app.use('/js', express.static(path.join(__dirname, 'public/js')));
// Serve CSS files
app.use('/css', express.static(path.join(__dirname, 'public/css')));

// LLM-powered shader generation endpoint
app.post('/api/generate-shader', async (req, res) => {
  const { prompt } = req.body;
  
  try {
    // Call OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-4.1-mini",
      messages: [
        { "role": "system", "content": "You are an expert GLSL shader programmer. Write high-quality, efficient WebGL shaders based on descriptions.\nFollow these guidelines:\n- Ensure your code is compilable in WebGL (GLSL ES 1.0)\n- Use precision mediump float; at the start of fragment shaders\n- Return both vertex and fragment shaders\n- Make sure uniforms are consistent between vertex and fragment shaders\n- Available uniforms: uTime (float), uResolution (vec2)\n- Format output with clear separators like #-- VERTEX SHADER --# and #-- FRAGMENT SHADER --#" },
        { "role": "user", "content": `Create a shader that produces: ${prompt}` }
      ],
    });

    res.json({ response: completion.data.choices[0].message.content });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to generate shader' });
  }
});

// Reflexion-based shader iteration endpoint
app.post('/api/iterate', async (req, res) => {
  console.log('=== ITERATE ENDPOINT CALLED ===');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    // Log the request size to check if it's too large
    const requestSize = JSON.stringify(req.body).length;
    console.log(`Request size: ${requestSize} bytes`);
    
    const { prompt, currentVertex, currentFragment, evaluation, screenshots = [], iteration = 0 } = req.body;
    console.log('Prompt length:', prompt ? prompt.length : 'undefined');
    console.log('Current vertex shader length:', currentVertex ? currentVertex.length : 'undefined');
    console.log('Current fragment shader length:', currentFragment ? currentFragment.length : 'undefined');
    console.log('Evaluation:', JSON.stringify(evaluation));
    console.log('Iteration:', iteration);
    console.log('Screenshots count:', screenshots.length);
    if (screenshots.length > 0) {
      console.log('First screenshot length:', screenshots[0].length);
      console.log('Screenshot type:', screenshots[0].substring(0, 30) + '...');
    }
    
    const MAX_ITERATIONS = 5;
    const TARGET_SSIM = 0.85;
    
    // Validate required inputs
    if (!currentVertex || !currentFragment) {
      console.log('ERROR: Missing shader code');
      return res.status(400).json({ error: 'Missing shader code' });
    }
    
    // Create messages array starting with the system prompt
    console.log('Creating messages array for OpenAI API...');
    const messages = [
      {
        "role": "system", 
        "content": "You are an expert GLSL shader programmer implementing Reflexion-style self-improvement. Write high-quality, efficient WebGL shaders based on descriptions and feedback.\nFollow these guidelines:\n- Ensure your code is compilable in WebGL (GLSL ES 1.0)\n- Use precision mediump float; at the start of fragment shaders\n- Return both vertex and fragment shaders\n- Make sure uniforms are consistent between vertex and fragment shaders\n- Available uniforms: uTime (float), uResolution (vec2)\n- Format output with clear separators like #-- VERTEX SHADER --# and #-- FRAGMENT SHADER --#"
      }
    ];
    
    // If this is an iteration (not the first generation)
    if (iteration > 0) {
      console.log(`Processing iteration ${iteration}`);
      
      // Add the previous code as an assistant message
      console.log('Adding previous shader code as assistant message');
      messages.push({
        "role": "assistant",
        "content": `#-- VERTEX SHADER --#\n${currentVertex}\n\n#-- FRAGMENT SHADER --#\n${currentFragment}`
      });
      
      // Create a text feedback message based on the evaluation and user feedback
      console.log('Creating feedback text based on evaluation and user feedback...');
      let feedbackText = `Iteration ${iteration}: Evaluate and improve the previous shader `;
      
      // Add user's specific feedback if available
      if (req.body.userFeedback) {
        console.log('User provided specific feedback:', req.body.userFeedback);
        feedbackText = `Iteration ${iteration}: ${req.body.userFeedback}\n\nEvaluate and improve the shader according to this user feedback. `;
      }
      
      // Add evaluation feedback if available
      if (evaluation) {
        const evalSummary = {
          compiled: evaluation.compiled,
          hasNaNs: evaluation.hasNaNs || false,
          metrics: evaluation.metrics || {}
        };
        
        if (evaluation.infoLog) {
          evalSummary.errors = evaluation.infoLog;
        }
        
        feedbackText += `based on this feedback: ${JSON.stringify(evalSummary, null, 2)}`;
      } else {
        feedbackText += 'to make it more efficient and visually appealing.';
      }
      
      feedbackText += '\n\nWrite a brief one-sentence reflection identifying the key issues. Then provide the complete improved shader code.';
      
      // Check if we can include images
      if (screenshots && screenshots.length > 0) {
        // Use text-only message if we can't process images
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
      // Log the model being used
      console.log('Using model: gpt-4.1-mini');
      
      // Call the API with detailed error handling
      console.log('Making API call...');
      const completion = await openai.createChatCompletion({
        model: "gpt-4.1-mini",
        messages: messages,
      });
      
      console.log('API call successful!');
      console.log('Response status:', completion.status);
      console.log('Response headers:', JSON.stringify(completion.headers));
      
      if (!completion.data || !completion.data.choices || !completion.data.choices[0]) {
        console.error('Unexpected API response structure:', JSON.stringify(completion.data));
        throw new Error('Invalid API response structure');
      }
      
      const responseContent = completion.data.choices[0].message.content;
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
        iteration: iteration
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
