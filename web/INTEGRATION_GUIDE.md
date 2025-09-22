# Enterprise Backend Integration Guide

This guide explains how the Angular UI integrates with the enterprise backend application.

## 🏗️ Architecture Overview

The application uses the enterprise backend exclusively for all API operations.

### Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Angular UI Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Components         │  Services           │  Shared        │
│  - VkycSession      │  - EnterpriseApiService │  - Home    │
│  - KYC              │  - EnterpriseRoomService│  - Common  │
│  - MeetingPanel     │  - IntegrationConfig    │  - Utils   │
│  - EnterpriseDashboard│  - MeetingService     │  - Config  │
│                     │  - MediaService         │            │
├─────────────────────────────────────────────────────────────┤
│                    Backend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Enterprise Backend                                        │
│  - /api/v1/sessions/*                                      │
│  - /api/v1/workflows/*                                     │
│  - /api/v1/agents/*                                        │
│  - /api/v1/health/*                                        │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Backend Setup

First, ensure the enterprise backend is running:

```bash
cd enterprise_app
cp env.example .env
# Edit .env with your API keys
pip install -r requirements.txt
python main.py
```

The enterprise backend will be available at `http://localhost:8000`

### 2. Frontend Configuration

The application is configured through the `integration.config.ts` file:

```typescript
// web/src/app/config/integration.config.ts
export const INTEGRATION_CONFIG: IntegrationConfig = {
    features: {
        enableHealthMonitoring: true,
        enableAdvancedAnalytics: true,
        enableWorkflowManagement: true,
        enableAgentManagement: true,
        enableSessionManagement: true,
    },
}
```

## 📁 File Structure

### Key Files

```
web/src/app/
├── services/
│   ├── enterprise-api.service.ts          # Enterprise API client
│   └── enterprise-room.service.ts         # Enterprise room management
├── components/
│   └── enterprise-dashboard/              # Enterprise dashboard
│       ├── enterprise-dashboard.component.ts
│       ├── enterprise-dashboard.component.html
│       └── enterprise-dashboard.component.css
└── config/
    └── integration.config.ts              # Integration configuration
```

### Modified Files

```
web/src/app/
├── app-routing.module.ts                  # Added enterprise route
├── components/
│   └── home/
│       ├── home.component.html            # Added enterprise dashboard link
│       └── home.component.ts              # Added RouterModule import
```

## 🔧 Configuration Options

### Backend Configuration

```typescript
backend: {
  enterprise: {
    baseUrl: 'http://localhost:8000/api/v1',
    endpoints: {
      sessions: '/sessions',
      workflows: '/workflows',
      agents: '/agents',
      health: '/health'
    }
  }
}
```

### Feature Flags

```typescript
features: {
  enableHealthMonitoring: true,         // Enable health monitoring
  enableAdvancedAnalytics: true,        // Enable analytics
  enableWorkflowManagement: true,       // Enable workflow management
  enableAgentManagement: true,          // Enable agent management
  enableSessionManagement: true         // Enable session management
}
```

### UI Configuration

```typescript
ui: {
  showEnterpriseDashboard: true,        // Show enterprise dashboard
  defaultRoute: '/home'                 // Default route
}
```

## 🎯 Usage Examples

### Using the Enterprise Dashboard

1. Navigate to `/enterprise` in your browser
2. The dashboard will show:
    - System health status
    - Session management
    - Workflow progress
    - Agent status
    - Advanced controls

### Using Components with Enterprise Backend

The existing components (VkycSession, KYC, etc.) use the enterprise backend directly through the EnterpriseRoomService.

### Direct Service Usage

```typescript
// In your component
constructor(private roomService: EnterpriseRoomService) {}

ngOnInit() {
  // Use enterprise features directly
  this.roomService.createRoom();
  this.roomService.joinAgent();
}
```

## 🏗️ Architecture

The application now uses the enterprise backend exclusively:

-   All components use EnterpriseRoomService directly
-   Enterprise backend provides all API endpoints
-   Simplified architecture with no service switching
-   Clean separation of concerns

## 🧪 Testing

### Testing with Enterprise Backend

```bash
# Start enterprise backend
cd enterprise_app
python main.py

# Start frontend
cd web
npm start
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**

    - Ensure the enterprise backend has CORS configured
    - Check that the frontend is making requests to the correct backend

2. **API Endpoint Errors**

    - Verify that the enterprise backend is running
    - Check the API endpoint URLs in the configuration

3. **Component Not Loading**
    - Ensure all required modules are imported
    - Check the routing configuration

### Debug Mode

Enable debug logging by setting the logging level to 'debug' in the configuration:

```typescript
logging: {
  level: 'debug',
  enableConsoleLogging: true
}
```

## 📊 Monitoring

### Health Monitoring

The enterprise backend provides comprehensive health monitoring:

-   System health status
-   Component health checks
-   Performance metrics
-   Error tracking

### Analytics

The enterprise backend includes advanced analytics:

-   Session metrics
-   Agent performance
-   Workflow completion rates
-   User interaction tracking

## 🔒 Security

### Authentication

The enterprise backend supports JWT authentication and can be configured with:

-   API key authentication
-   OAuth integration
-   Role-based access control

### Data Protection

-   All data is encrypted in transit
-   Sensitive data is encrypted at rest
-   Audit logging for all operations

## 🚀 Deployment

### Development

```bash
# Start enterprise backend
cd enterprise_app
python main.py

# Start frontend
cd web
npm start
```

### Production

```bash
# Build frontend
cd web
npm run build

# Deploy enterprise backend
cd enterprise_app
# Follow deployment guide in DEPLOYMENT_GUIDE.md
```

## 📚 Additional Resources

-   [Enterprise Backend Documentation](../enterprise_app/README.md)
-   [Deployment Guide](../enterprise_app/DEPLOYMENT_GUIDE.md)
-   [Migration Summary](../enterprise_app/MIGRATION_SUMMARY.md)
-   [API Documentation](http://localhost:8000/docs) (when backend is running)

## 🤝 Support

For issues or questions:

1. Check the troubleshooting section above
2. Review the logs for error messages
3. Verify the configuration settings
4. Test with the enterprise backend

## 🔄 Updates

To update the integration:

1. Pull the latest changes
2. Update the configuration if needed
3. Test with the enterprise backend
4. Deploy the changes

The application now uses the enterprise backend exclusively, providing a streamlined and simplified architecture.
