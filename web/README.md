# KYC Enterprise Platform - Angular Frontend

This is an enterprise-grade Angular application for the KYC Video Verification system with VideoSDK integration.

## 🚀 Enterprise Features

-   **🔐 Secure Session Management**: Enterprise-grade room creation and management
-   **📹 Advanced Media Handling**: Professional camera/microphone access with error handling
-   **🎥 Real-time Video Conferencing**: High-quality video meetings with VideoSDK JS SDK
-   **🤖 AI Agent Integration**: Seamless KYC processes with intelligent agents
-   **💾 Session Persistence**: Robust data persistence across page refreshes
-   **📊 Activity Monitoring**: Real-time session activity logging and monitoring
-   **🎨 Enterprise UI/UX**: Professional, responsive design with modern styling
-   **⚡ Performance Optimized**: Efficient memory management and fast loading

## Prerequisites

-   **Node.js 22+** (Latest LTS version)
-   **npm 10+** package manager
-   **Angular CLI 18+** (installed as dev dependency)

## Installation

1. **Install dependencies:**

```bash
npm install
```

2. **Start the development server:**

```bash
npm start
```

3. **Open your browser and navigate to `http://localhost:4200`**

## Build for Production

```bash
# Development build
npm run build:dev

# Production build
npm run build
```

The build artifacts will be stored in the `dist/` directory.

## 🎯 Key Improvements

### Enterprise-Grade Design

-   **Modern UI**: Clean, professional interface with enterprise styling
-   **Responsive Layout**: Optimized for desktop, tablet, and mobile devices
-   **Accessibility**: WCAG compliant with proper focus management
-   **Performance**: Optimized bundle size and loading times

### Simplified Architecture

-   **Single Component**: Streamlined app component with integrated functionality
-   **Service-Based**: Clean separation of concerns with dedicated services
-   **Reactive Programming**: RxJS observables for state management
-   **Type Safety**: Full TypeScript support with strict typing

### VideoSDK Integration

-   **No Loop Issues**: Fixed continuous loop problems with proper event handling
-   **Media Validation**: Ensures camera and microphone access before joining
-   **Error Recovery**: Graceful error handling and recovery mechanisms
-   **Stream Management**: Efficient video stream handling for all participants

## API Endpoints

The application connects to the following backend endpoints:

-   `POST /api/v1/sessions/create` - Create a new verification session
-   `POST /api/v1/sessions/join-agent` - Join AI agent to session
-   `POST /api/kyc/start_worker_pipeline` - Start KYC verification process

## Environment Configuration

Update the API base URL in the following files if needed:

-   `src/app/services/room.service.ts` (line 12)
-   `src/app/app.component.ts` (line 25)

## 🛠️ Development

### Available Scripts

```bash
# Development server
npm start

# Build for development
npm run build:dev

# Build for production
npm run build

# Run tests
npm test

# Run tests in CI mode
npm run test:ci

# Lint code
npm run lint

# End-to-end tests
npm run e2e
```

### Project Structure

```
src/
├── app/
│   ├── services/           # Business logic services
│   │   ├── room.service.ts      # Room management
│   │   ├── media.service.ts     # Media handling
│   │   └── meeting.service.ts   # VideoSDK integration
│   ├── interfaces/         # TypeScript interfaces
│   │   └── room.interface.ts    # Data models
│   └── app.component.ts    # Main application component
├── styles.css             # Enterprise styling system
└── index.html            # HTML with VideoSDK script
```

## 🔧 Troubleshooting

### Media Permission Issues

-   Ensure your browser has camera and microphone permissions
-   Check that HTTPS is enabled (required for media access in production)
-   Verify browser compatibility with WebRTC

### VideoSDK Issues

-   Verify the VideoSDK script is loading correctly in browser console
-   Check that meeting tokens are valid and not expired
-   Ensure stable internet connection for video streaming

### Build Issues

-   Clear node_modules and reinstall: `rm -rf node_modules && npm install`
-   Update Angular CLI: `npm install -g @angular/cli@latest`
-   Check Node.js version: `node --version` (should be 22+)

### Performance Issues

-   Check browser developer tools for memory leaks
-   Verify that video streams are properly cleaned up on component destroy
-   Monitor network tab for API call performance

## 📱 Browser Support

-   **Chrome 90+** (Recommended)
-   **Firefox 88+**
-   **Safari 14+**
-   **Edge 90+**

## 🔒 Security Considerations

-   All API communications should use HTTPS in production
-   VideoSDK tokens are stored in session storage (cleared on browser close)
-   Media permissions are requested explicitly with user consent
-   No sensitive data is logged in browser console

## 📄 License

This project is proprietary software for enterprise use.
