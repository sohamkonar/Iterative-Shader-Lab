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
- **User-Friendly Interface**: Clean UI with separate code editor, rendering canvas, and feedback panels
- **Helpful Status Messages**: Clear guidance on what's happening and what to do next
- **Visual Iteration History**: Track the evolution of your shader with screenshots and metrics
- **Compilation Metrics**: Get detailed information on compilation success, warnings, and performance

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

3. Create a `.env` file in the root directory with your OpenAI API key:

```
OPENAI_API_KEY=your_api_key_here
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

3. **Auto-Iteration for Errors**: If your shader has compilation errors, the system will automatically attempt to fix them through multiple iterations until the shader compiles successfully.

### Advanced Features

1. **Manual Editing**: You can directly edit the shader code in the editor tabs and click "Compile & Render" to see your changes.

2. **Iteration History**: The right panel shows your shader's evolution through different iterations. Each entry displays:
   - A thumbnail of the rendered result
   - Iteration number and success status
   - Performance metrics

3. **Shader Metrics**: View compiled metrics about your shader's performance characteristics and complexity.

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

4. **Iteration System**: Combines LLM capabilities with user feedback to progressively improve shaders.

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
  /css         # Stylesheets
  /js
    main.js            # Application orchestration logic and UI interactions
    shaderRenderer.js  # WebGL initialization and shader rendering module
    shaderEvaluator.js # Shader evaluation, metrics, and quality assessment
  index.html   # Main UI
server.js      # Express server and API endpoints
package.json   # Dependencies and project configuration
.env           # Environment variables (API keys)
```

## Development

### Mock Mode

For development purposes, the application includes a mock LLM API that returns predefined shaders based on keywords in the prompt. To use a real LLM API, you'll need to modify the `/api/generate-shader` endpoint in `server.js` to connect to your preferred LLM provider.

### Adding New Shader Effects

To add new shader effects to the mock LLM:

1. Open `server.js`
2. Find the `/api/generate-shader` route
3. Add a new condition and shader template based on keywords

## Evaluation Metrics

The system evaluates shaders based on the following metrics:

- Compilation success
- Performance characteristics (heavy operations, loops, etc.)
- Code complexity
- Visual interest heuristics

## License

MIT
