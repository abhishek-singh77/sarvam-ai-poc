export const environment = {
    production: true,
    apiUrl: 'https://api.yourdomain.com/api/v1',
    websocketUrl: 'wss://api.yourdomain.com/ws',
    enableLogging: false,
    enableDebugMode: false,
    detectionConfig: {
        faceDetectionConfidence: 0.95,
        documentDetectionConfidence: 0.9,
        autoCaptureDelay: 2000,
        maxRetries: 3,
    },
    workflowConfig: {
        maxStepRetries: 3,
        stepTimeout: 30000,
        autoAdvanceDelay: 1000,
    },
}
