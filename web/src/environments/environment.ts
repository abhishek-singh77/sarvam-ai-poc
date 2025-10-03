export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api/v1',
    websocketUrl: 'ws://localhost:8080/ws',
    enableLogging: true,
    enableDebugMode: true,
    detectionConfig: {
        faceDetectionConfidence: 0.85,
        documentDetectionConfidence: 0.8,
        autoCaptureDelay: 1500,
        maxRetries: 3,
    },
    workflowConfig: {
        maxStepRetries: 3,
        stepTimeout: 30000,
        autoAdvanceDelay: 1000,
    },
}
