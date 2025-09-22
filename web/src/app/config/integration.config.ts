/**
 * Integration Configuration
 *
 * This file contains configuration settings for integrating the existing UI
 * with the new enterprise backend. It provides a centralized place to manage
 * API endpoints, feature flags, and service configurations.
 */

export interface IntegrationConfig {
    // Backend Configuration
    backend: {
        enterprise: {
            baseUrl: string
            endpoints: {
                sessions: string
                workflows: string
                agents: string
                health: string
            }
        }
    }

    // Feature Flags
    features: {
        enableHealthMonitoring: boolean
        enableAdvancedAnalytics: boolean
        enableWorkflowManagement: boolean
        enableAgentManagement: boolean
        enableSessionManagement: boolean
    }

    // UI Configuration
    ui: {
        showEnterpriseDashboard: boolean
        defaultRoute: string
    }

    // VideoSDK Configuration
    videosdk: {
        version: string
        tokenVersion: string
        enableMultiStream: boolean
        enableScreenShare: boolean
        enableRecording: boolean
    }

    // Logging Configuration
    logging: {
        level: 'debug' | 'info' | 'warn' | 'error'
        enableConsoleLogging: boolean
        enableRemoteLogging: boolean
        remoteLoggingEndpoint?: string
    }
}

export const INTEGRATION_CONFIG: IntegrationConfig = {
    backend: {
        enterprise: {
            baseUrl: 'http://localhost:8000/api/v1',
            endpoints: {
                sessions: '/sessions',
                workflows: '/workflows',
                agents: '/agents',
                health: '/health',
            },
        },
    },

    features: {
        enableHealthMonitoring: true,
        enableAdvancedAnalytics: true,
        enableWorkflowManagement: true,
        enableAgentManagement: true,
        enableSessionManagement: true,
    },

    ui: {
        showEnterpriseDashboard: true,
        defaultRoute: '/home',
    },

    videosdk: {
        version: '0.3.1',
        tokenVersion: '2',
        enableMultiStream: false,
        enableScreenShare: false,
        enableRecording: false,
    },

    logging: {
        level: 'info',
        enableConsoleLogging: true,
        enableRemoteLogging: false,
        remoteLoggingEndpoint: undefined,
    },
}

/**
 * Environment-specific configurations
 */
export const getEnvironmentConfig = (): Partial<IntegrationConfig> => {
    const environment = (window as any).environment || 'development'

    switch (environment) {
        case 'production':
            return {
                backend: {
                    enterprise: {
                        baseUrl: 'https://api.yourdomain.com/api/v1',
                        endpoints: {
                            sessions: '/sessions',
                            workflows: '/workflows',
                            agents: '/agents',
                            health: '/health',
                        },
                    },
                },
                logging: {
                    level: 'warn',
                    enableConsoleLogging: false,
                    enableRemoteLogging: true,
                    remoteLoggingEndpoint:
                        'https://logs.yourdomain.com/api/logs',
                },
            }

        case 'staging':
            return {
                backend: {
                    enterprise: {
                        baseUrl: 'https://staging-api.yourdomain.com/api/v1',
                        endpoints: {
                            sessions: '/sessions',
                            workflows: '/workflows',
                            agents: '/agents',
                            health: '/health',
                        },
                    },
                },
                logging: {
                    level: 'info',
                    enableConsoleLogging: true,
                    enableRemoteLogging: true,
                    remoteLoggingEndpoint:
                        'https://staging-logs.yourdomain.com/api/logs',
                },
            }

        case 'development':
        default:
            return {
                backend: {
                    enterprise: {
                        baseUrl: 'http://localhost:8000/api/v1',
                        endpoints: {
                            sessions: '/sessions',
                            workflows: '/workflows',
                            agents: '/agents',
                            health: '/health',
                        },
                    },
                },
                logging: {
                    level: 'debug',
                    enableConsoleLogging: true,
                    enableRemoteLogging: false,
                },
            }
    }
}

/**
 * Get the complete configuration for the current environment
 */
export const getConfig = (): IntegrationConfig => {
    const baseConfig = INTEGRATION_CONFIG
    const envConfig = getEnvironmentConfig()

    return {
        ...baseConfig,
        ...envConfig,
        backend: {
            ...baseConfig.backend,
            ...envConfig.backend,
        },
        logging: {
            ...baseConfig.logging,
            ...envConfig.logging,
        },
    }
}

/**
 * Configuration utility functions
 */
export const ConfigUtils = {
    /**
     * Get the enterprise API base URL
     */
    getApiBaseUrl: (): string => {
        const config = getConfig()
        return config.backend.enterprise.baseUrl
    },

    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled: (
        feature: keyof IntegrationConfig['features']
    ): boolean => {
        const config = getConfig()
        return config.features[feature]
    },

    /**
     * Get the enterprise endpoint URL
     */
    getEndpointUrl: (endpoint: string): string => {
        const config = getConfig()
        const baseUrl = config.backend.enterprise.baseUrl
        const endpoints = config.backend.enterprise.endpoints

        return `${baseUrl}${(endpoints as any)[endpoint] || `/${endpoint}`}`
    },

    /**
     * Log configuration information
     */
    logConfiguration: (): void => {
        const config = getConfig()
        console.group('🔧 Integration Configuration')
        console.log('Backend Mode: Enterprise')
        console.log('API Base URL:', ConfigUtils.getApiBaseUrl())
        console.log('Features:', config.features)
        console.log('UI Settings:', config.ui)
        console.log('VideoSDK Settings:', config.videosdk)
        console.log('Logging Level:', config.logging.level)
        console.groupEnd()
    },
}
