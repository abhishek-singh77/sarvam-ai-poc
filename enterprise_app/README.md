# Enterprise AI Video KYC System

A production-ready, modular, and extensible AI-powered video KYC system built with FastAPI, VideoSDK, and multiple AI providers.

## Architecture Overview

This enterprise application follows a clean, modular architecture with clear separation of concerns:

```
enterprise_app/
├── core/                    # Core framework and base classes
│   ├── agents/             # Base agent framework
│   ├── pipelines/          # Pipeline orchestration
│   ├── workflows/          # Workflow management
│   └── exceptions/         # Custom exceptions
├── api/                    # API layer / controllers
│   ├── v1/                # API version 1
│   └── middleware/        # Custom middleware
├── services/              # Business logic layer
│   ├── session/           # Session management
│   ├── workflow/          # Workflow services
│   └── analytics/         # Analytics and reporting
├── integrations/          # External service integrations
│   ├── videosdk/          # VideoSDK integration
│   ├── ai_providers/      # AI provider integrations
│   └── database/          # Database integrations
├── entities/              # Data models and entities
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   └── enums/             # Enumerations
├── utils/                 # Utilities and helpers
│   ├── logging/           # Structured logging
│   ├── config/            # Configuration management
│   ├── health/            # Health checks
│   └── security/          # Security utilities
├── tests/                 # Test suite
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test fixtures
└── workflows/             # Workflow definitions
    ├── kyc/               # KYC workflows
    ├── interview/         # Interview workflows
    └── survey/            # Survey workflows
```

## Key Features

-   **Modular Architecture**: Highly modular and loosely coupled design
-   **Extensible Framework**: Easy to add new workflows and AI providers
-   **Async Support**: Full async/await support for high concurrency
-   **Structured Logging**: Comprehensive logging with structured data
-   **Health Checks**: Built-in health monitoring for all services
-   **Database Ready**: PostgreSQL/MySQL integration ready
-   **Testing**: Comprehensive test suite with fixtures
-   **Type Safety**: Full type hints and PEP8 compliance
-   **Production Ready**: Docker, environment configs, and deployment ready

## Quick Start

1. **Install Dependencies**:

    ```bash
    pip install -r requirements.txt
    ```

2. **Set Environment Variables**:

    ```bash
    cp .env.example .env
    # Edit .env with your API keys
    ```

3. **Run the Application**:

    ```bash
    python main.py
    ```

4. **Access the API**:
    - Health Check: `GET /health`
    - API Documentation: `GET /docs`
    - Create Session: `POST /api/v1/sessions`

## Extending the System

### Adding a New Workflow

1. Create workflow JSON in `workflows/your_workflow/`
2. Implement workflow handler in `services/workflow/`
3. Add API endpoints in `api/v1/`

### Adding a New AI Provider

1. Implement provider interface in `integrations/ai_providers/`
2. Register provider in `core/agents/providers.py`
3. Update configuration in `utils/config/`

### Adding a New Agent Type

1. Extend base agent class in `core/agents/base.py`
2. Implement specific agent logic
3. Register in agent factory

## Configuration

All configuration is managed through environment variables and Pydantic settings. See `utils/config/settings.py` for all available options.

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=enterprise_app

# Run specific test types
pytest tests/unit/
pytest tests/integration/
```

## Deployment

The application is ready for deployment with:

-   Docker support
-   Environment-based configuration
-   Health checks for monitoring
-   Structured logging for observability
-   Database migration support

## License

MIT License - see LICENSE file for details.
