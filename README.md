# Iterative Shader Lab

Enabling LLM-Driven Shader Development with Live Feedback

## Overview

Iterative Shader Lab is an interactive web application that leverages Large Language Models (LLMs) to generate, debug, and refine GLSL shaders based on text descriptions. It provides a seamless workflow for creating WebGL shaders through natural language prompts and iterative feedback, making shader development accessible to both beginners and experienced graphics programmers.

The system enables real-time rendering of shaders and captures performance metrics, compilation errors, and visual results. These are fed back into the LLM to continuously improve the shader code in an interactive loop, empowering users to refine their shader effects through simple text instructions.

## Key Features

### Shader Generation & Rendering
- **Text-to-Shader Generation**: Create complex GLSL shaders from natural language descriptions
- **Real-time WebGL Rendering**: Instantly see your shaders in action with WebGL 1.0 compatibility
- **Interactive Canvas**: View shader effects with automatic animation through uniform time variables
- **Vertex & Fragment Shader Support**: Complete control over both vertex and fragment shaders

### Intelligent Iteration System
- **User-Guided Refinement**: Provide specific feedback on what aspects you want to change
- **Auto-Iteration**: Automatically fixes shader compilation errors without manual intervention
- **Intelligent Error Detection**: Sophisticated detection of compilation errors vs. runtime WebGL errors
- **Screenshot Evidence**: Sends rendered results to the LLM for visual feedback on iterations

### Developer Experience
- **User-Friendly Interface**: Clean three-column layout with Shader Description, Shader Preview & Iteration History, and Shader Code section
- **Helpful Status Messages**: Clear guidance on what's happening and what to do next
- **Visual Iteration History**: Track the evolution of your shader with screenshots and iteration labels
- **Auto-Growing Textareas**: Textareas that automatically expand as you type
- **Speech-to-Text Input**: Dictate shader descriptions and feedback using your microphone

### Architecture & Technical Features
- **Modular Design**: Separation of concerns with dedicated modules for rendering, evaluation, and UI
- **WebGL Integration**: Low-level access to GPU shaders with error handling and diagnostics
- **API-Based Backend**: Node.js server handles communication with OpenAI's API
- **Local Storage**: Save your shader iterations for later reference

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- OpenAI API key (for LLM shader generation and iteration)

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following environment variables:

```
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL_NAME="your_finetuned_model_name" # Optional: name of fine-tuned model
OPENAI_BASE_MODEL="gpt-4.1-mini" # Base model to use (default: gpt-4.1-mini)
USE_FINETUNED_MODEL=false # Set to true to use OPENAI_MODEL_NAME instead of OPENAI_BASE_MODEL
```

### Running the Application

1. Start the development server:

```bash
node server.js
```

2. Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Usage

### Creating Your First Shader

1. **Enter a Descriptive Prompt**: In the "Shader Description" field, enter a detailed description of the shader effect you want to create (e.g., "A water ripple effect with blue tones and refraction").

2. **Generate the Shader**: Click the "Generate Shader" button. The system will use the LLM to create both vertex and fragment shaders based on your description.

3. **View the Result**: The generated shader will be compiled and displayed in the preview canvas. The shader code will appear in the editor tabs (Fragment/Vertex).

### Iterating and Improving Your Shader

1. **Provide Specific Feedback**: After generating or compiling a shader, the feedback input field will appear. Enter specific instructions on how you want to improve the shader (e.g., "make the colors more vibrant" or "fix the distortion at the edges").

2. **Iterate the Shader**: Click "Iterate" to send your feedback to the LLM along with the current shader code and a screenshot of the rendering. The LLM will analyze these inputs and generate an improved version.

3. **Auto-Iteration for Errors**: If your shader has compilation errors, the system will automatically attempt to fix them through multiple iterations until the shader compiles successfully. Auto-iterations don't affect the main iteration numbering, making the history easier to track.

### Advanced Features

1. **Manual Editing**: You can directly edit the shader code in the editor tabs and click "Compile & Render" to see your changes.

2. **Iteration History**: The middle column shows your shader's evolution through different iterations. Each entry displays:
   - A thumbnail of the rendered result
   - Iteration label ("Initial Generation" or "Iteration X") and success status
   - Click on any thumbnail to restore that shader version

3. **Speech Recognition**: Click the microphone icon to dictate your shader description or iteration feedback instead of typing.

4. **Auto-Growing Textareas**: Description and feedback textareas automatically expand as you type or dictate text, providing a seamless user experience.

## Implementation Details

### Architecture

The application follows a modular design with clear separation of concerns:

- **Client-Side**:
  - `main.js`: Core application logic and UI interactions
  - `shaderRenderer.js`: WebGL initialization and shader rendering
  - `shaderEvaluator.js`: Shader evaluation and metrics calculation

- **Server-Side**:
  - `server.js`: Express server with API endpoints for shader generation and iteration

### Key Components

1. **Shader Generation**: Uses OpenAI's API to generate GLSL code from natural language descriptions.

2. **Shader Rendering**: WebGL-based rendering system that handles shader compilation, uniform updates, and canvas drawing.

3. **Shader Evaluation**: Analyzes shaders for compilation errors, performance issues, and quality metrics.

4. **Iteration System**: Combines LLM capabilities with user feedback to progressively improve shaders. Includes smart iteration numbering that maintains "Initial Generation" label regardless of auto-iterations and numbers manual iterations correctly.

## Troubleshooting

### Common Issues

- **WebGL Not Supported**: Make sure your browser supports WebGL. Try using Chrome or Firefox.
- **API Key Issues**: Verify your OpenAI API key is correct in the .env file.
- **Shader Compilation Errors**: Check the console for detailed error messages from the WebGL compiler.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Project Structure

```
/public
  /assets      # Test scene images and textures
  /css
    styles.css        # Main stylesheet for the application
  /js
    main.js            # Application orchestration logic and UI interactions
    shaderRenderer.js  # WebGL initialization and shader rendering module
    shaderEvaluator.js # Shader evaluation, metrics, and quality assessment
  index.html   # Main UI with three-column layout
/logs          # Directory for LLM interaction logs
/screenshots   # Directory for shader render screenshots
server.js      # Express server and API endpoints with LLM integration
package.json   # Dependencies and project configuration
.env           # Environment variables (API keys and model configuration)
```

## Development

### LLM Model Configuration

The application connects to OpenAI's API and can be configured to use different models:

- Set `USE_FINETUNED_MODEL=true` to use a custom fine-tuned model specified in `OPENAI_MODEL_NAME`
- Set `USE_FINETUNED_MODEL=false` to use the base model specified in `OPENAI_BASE_MODEL`
- If values are missing, the system falls back to using GPT-4.1-mini

### Comprehensive Logging System

The application includes a detailed logging system that captures:

- Timestamped JSON log files for all LLM interactions
- Complete request messages sent to the LLM
- Full LLM responses
- Performance metrics and evaluation data
- Screenshot data (when included in iterations)

Logs are stored in a dedicated 'logs' directory with unique filenames that include the interaction type and timestamp.

### Available Shader Uniforms

The following uniforms are available for use in your shaders:

- `uTime` (float): Time in seconds for animations
- `uResolution` (vec2): Canvas dimensions in pixels
- `uMouse` (vec2): Normalized mouse position (0.0-1.0)
- `uMouseClick` (vec2): Normalized position of the last mouse click
- `uIsMouseDown` (int): Boolean flag for mouse button state
- `uFrame` (int): Frame counter for animation control
- `uAspect` (float): Canvas aspect ratio for proper proportions
- `uTexture0`, `uTexture1` (sampler2D): Texture samplers for image inputs

## Evaluation Points

Shader success is evaluated based on:

- Compilation success in WebGL environment
- Visual output rendering correctly
- Meeting the user's described requirements
- Performance optimizations

## License

MIT
