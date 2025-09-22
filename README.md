# Sarvam AI VideoSDK - KYC Virtual Agent

A real-time KYC (Know Your Customer) verification system using VideoSDK and AI agents for identity verification.

## 🚀 Quick Start

### Backend Setup & Execution

```bash
# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp enterprise_app/env.example enterprise_app/.env
# Edit enterprise_app/.env with your API keys

# Run the backend server
cd enterprise_app
python main.py
```

### Frontend Setup & Execution

```bash
# Navigate to web directory
cd web

# Install dependencies
npm install

# Start the frontend development server
npm start
```

The frontend will be available at `http://localhost:4200` and the backend at `http://localhost:8000`.

## 🔧 Environment Configuration

Create `enterprise_app/.env` with the following variables:

```env
# VideoSDK Configuration
VIDEOSDK_API_KEY=your_videosdk_api_key
VIDEOSDK_API_SECRET=your_videosdk_api_secret
VIDEOSDK_BASE_URL=https://api.videosdk.live/

# AI Services
SARVAMAI_API_KEY=your_sarvam_ai_api_key
GOOGLE_API_KEY=your_google_ai_api_key
```

## 🎯 Features

-   🤖 **AI-Powered KYC Agent**: Real-time voice interaction for identity verification
-   🎥 **VideoSDK Integration**: Seamless video/audio communication
-   🗣️ **Speech-to-Text**: SarvamAI for accurate speech recognition
-   🧠 **AI Responses**: Google Gemini for intelligent conversation
-   🔊 **Text-to-Speech**: Google TTS for natural voice responses
-   🎯 **Voice Activity Detection**: Smart conversation flow management
-   🔇 **Noise Reduction**: Enhanced audio quality

## 🏗️ Tech Stack

### Backend

-   **FastAPI**: Modern Python web framework
-   **VideoSDK**: Real-time communication platform
-   **VideoSDK Agents**: AI agent framework
-   **SarvamAI**: Speech-to-text processing
-   **Google AI**: LLM and TTS services

### Frontend

-   **Angular**: Modern web framework
-   **TypeScript**: Type-safe development
-   **Tailwind CSS**: Utility-first styling
-   **VideoSDK JavaScript SDK**: Real-time communication

## 📡 API Endpoints

### Room Management

-   `POST /api/room/create` - Create a new VideoSDK room with tokens
-   `POST /api/room/join-agent` - Join AI agent to room for KYC verification
-   `GET /health` - Health check endpoint

## 🎮 Usage

### Simple 2-Step Process

1. **Create Room**: Use the frontend to create a new VideoSDK room
2. **Join AI Agent**: The agent will automatically join the room for KYC verification

### Frontend Integration

```typescript
// Complete KYC session initialization
async initializeKYCSession() {
    try {
        // Step 1: Create room
        const roomData = await this.createRoom();

        // Step 2: Join agent
        await this.joinAgent(roomData);

        console.log('KYC session ready!');
    } catch (error) {
        console.error('KYC session failed:', error);
    }
}
```

## 🏛️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   AI Services   │
│   (Angular)     │◄──►│   (FastAPI)     │◄──►│   (SarvamAI,    │
│                 │    │                 │    │    Google AI)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   VideoSDK      │    │   VideoSDK      │    │   VideoSDK      │
│   JavaScript    │    │   Python SDK    │    │   Agents        │
│   SDK           │    │                 │    │   Framework     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📁 Project Structure

```
├── enterprise_app/               # Enterprise backend application
│   ├── api/                      # API endpoints
│   │   └── v1/                  # API version 1 endpoints
│   │       └── sessions.py      # Session management endpoints
│   ├── services/                 # Business logic services
│   │   ├── proper_agent_service.py  # VideoSDK agent service
│   │   ├── videosdk_service.py  # VideoSDK utilities
│   │   ├── conversation_logger.py  # Conversation logging
│   │   └── workflow_service.py  # Workflow management
│   ├── models/                   # Data models
│   ├── workflow/                 # Workflow configurations
│   ├── config.py                # Configuration
│   └── main.py                  # FastAPI application
├── web/                          # Frontend application
│   ├── src/app/                 # Angular components
│   │   ├── components/          # UI components
│   │   │   ├── vkyc-session/    # Main KYC session component
│   │   │   ├── meeting-panel/   # Video meeting interface
│   │   │   ├── activity-panel/  # Activity logging
│   │   │   └── info-panel/      # Information display
│   │   ├── services/            # Angular services
│   │   └── interfaces/          # TypeScript interfaces
│   └── package.json             # Frontend dependencies
└── requirements.txt             # Python dependencies
```

## 🔐 Authentication & Tokens

The system uses VideoSDK's unified token authentication:

-   **Multi-participant tokens**: Same token can be used by multiple participants
-   **Room-specific security**: Tokens include `roomId` for room-level security
-   **Simplified payload**: Only required fields (`apikey`, `permissions`)
-   **No participant restrictions**: Flexible token usage across participants

## 🧪 Development

### Running Tests

```bash
# Backend tests
python -m pytest

# Frontend tests
cd web
npm test
```

### Code Quality

```bash
# Backend linting
flake8 enterprise_app/
black enterprise_app/

# Frontend linting
cd web
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

1. **Agent not visible in room**

    - Check VideoSDK API keys in `.env`
    - Verify room ID is valid
    - Check backend logs for connection errors

2. **Audio not working**

    - Enable microphone permissions in browser
    - Check TTS API keys
    - Verify system audio is working

3. **Import errors**
    - Install requirements: `pip install -r requirements.txt`
    - Use Python 3.12 or higher
    - Check VideoSDK packages are installed

### Debug Steps

1. Check browser console for JavaScript errors
2. Check network tab for failed API calls
3. Check backend logs for service errors
4. Verify API endpoints are accessible

## 📋 Key Implementation Details

### VideoSDK Agent Integration

-   Uses proper Worker pattern with `WorkerJob` and `JobContext`
-   Implements thread-safe authentication token management
-   Includes complete pipeline: STT → LLM → TTS → VAD → Denoise
-   Follows VideoSDK documentation for AI agents

### Token Management

-   Environment variable approach for framework initialization
-   Unified tokens for multi-participant support
-   Proper cleanup and restoration of authentication state
-   Room-specific security with participant flexibility

### Error Handling

-   Comprehensive error handling in both frontend and backend
-   Detailed logging for debugging
-   User-friendly error messages
-   Graceful fallbacks for service failures

## 🚀 Deployment

### Production Considerations

-   Set up proper environment variables
-   Configure CORS for production domains
-   Set up logging and monitoring
-   Configure auto-scaling for VideoSDK agents
-   Set up health checks and monitoring

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions, please open an issue in the repository.

---

**Note**: This system requires valid API keys for VideoSDK, SarvamAI, and Google AI services. Make sure to configure these in your `.env` file before running the application.
