import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

// Import MediaPipe and TensorFlow dependencies
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import * as blazeface from '@tensorflow-models/blazeface'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'

export interface DetectionResult {
    confidence: number
    boundingBox: {
        x: number
        y: number
        width: number
        height: number
    }
    steady: boolean
    quality?: number
    message?: string
    faceId?: string // For multiple face tracking
}

export interface MultipleFaceDetectionResult {
    faces: DetectionResult[]
    totalFaces: number
    primaryFace?: DetectionResult // The main face for auto-capture
}

export interface DocumentDetectionResult {
    confidence: number
    quad: {
        topLeft: { x: number; y: number }
        topRight: { x: number; y: number }
        bottomLeft: { x: number; y: number }
        bottomRight: { x: number; y: number }
    }
    boundingBox: { x: number; y: number; width: number; height: number }
    steady: boolean
    quality?: number
    aspectRatio?: number
    message?: string
}

export interface DetectionConstraints {
    minConfidence: number
    minSize: number
    maxSize: number
    centerThreshold: number
    steadyFrames: number
    aspectRatioRange?: { min: number; max: number }
}

@Injectable({
    providedIn: 'root',
})
export class EnhancedDetectionService {
    private faceDetector: FaceDetector | null = null
    private blazefaceModel: blazeface.BlazeFaceModel | null = null
    private isInitialized = false
    private initializationError: string | null = null
    private detectionHistory: Map<string, DetectionResult[]> = new Map()
    private documentHistory: Map<string, DocumentDetectionResult[]> = new Map()

    // Detection state
    private isDetecting = false
    private detectionLoop: number | null = null
    private currentVideo: HTMLVideoElement | null = null
    private faceIdCounter = 0
    private lastDetectionTime = 0
    private detectionInterval = 100 // Detect every 100ms for smooth experience

    // Observables for detection results
    private faceDetectionSubject = new BehaviorSubject<DetectionResult | null>(
        null
    )
    private multipleFaceDetectionSubject =
        new BehaviorSubject<MultipleFaceDetectionResult | null>(null)
    private documentDetectionSubject =
        new BehaviorSubject<DocumentDetectionResult | null>(null)
    private detectionErrorSubject = new BehaviorSubject<string | null>(null)
    private detectionStatusSubject = new BehaviorSubject<
        'idle' | 'initializing' | 'detecting' | 'error'
    >('idle')

    public faceDetection$ = this.faceDetectionSubject.asObservable()
    public multipleFaceDetection$ =
        this.multipleFaceDetectionSubject.asObservable()
    public documentDetection$ = this.documentDetectionSubject.asObservable()
    public detectionError$ = this.detectionErrorSubject.asObservable()
    public detectionStatus$ = this.detectionStatusSubject.asObservable()

    async initialize(): Promise<void> {
        if (this.isInitialized) return

        this.detectionStatusSubject.next('initializing')

        try {
            console.log(
                '🎯 ENHANCED-DETECTION: Initializing detection models...'
            )

            // Initialize TensorFlow.js backend
            await tf.ready()
            console.log('🎯 ENHANCED-DETECTION: TensorFlow.js ready')

            // Initialize BlazeFace model (fallback for face detection)
            try {
                this.blazefaceModel = await blazeface.load()
                console.log('🎯 ENHANCED-DETECTION: BlazeFace model loaded')
            } catch (blazeError) {
                console.warn(
                    '🎯 ENHANCED-DETECTION: BlazeFace model failed to load:',
                    blazeError
                )
                this.detectionErrorSubject.next(
                    'BlazeFace model failed to load. Using MediaPipe only.'
                )
            }

            // Initialize MediaPipe Face Detector
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
                )
                this.faceDetector = await FaceDetector.createFromOptions(
                    vision,
                    {
                        baseOptions: {
                            modelAssetPath:
                                'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                            delegate: 'GPU',
                        },
                        runningMode: 'VIDEO',
                    }
                )
                console.log(
                    '🎯 ENHANCED-DETECTION: MediaPipe Face Detector loaded'
                )
            } catch (mediapipeError) {
                console.warn(
                    '🎯 ENHANCED-DETECTION: MediaPipe model failed to load:',
                    mediapipeError
                )
                this.detectionErrorSubject.next(
                    'MediaPipe model failed to load. Using BlazeFace only.'
                )
            }

            // Check if at least one model loaded
            if (!this.faceDetector && !this.blazefaceModel) {
                throw new Error('Both face detection models failed to load')
            }

            this.isInitialized = true
            this.initializationError = null
            this.detectionStatusSubject.next('idle')
            console.log(
                '🎯 ENHANCED-DETECTION: Detection models initialized successfully'
            )
        } catch (error) {
            const errorMessage = `Failed to initialize face detection: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`
            console.error('🎯 ENHANCED-DETECTION:', errorMessage)
            this.initializationError = errorMessage
            this.detectionErrorSubject.next(errorMessage)
            this.detectionStatusSubject.next('error')
            throw error
        }
    }

    async startFaceDetection(
        video: HTMLVideoElement,
        constraints: DetectionConstraints = this.getDefaultFaceConstraints()
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize()
        }

        if (this.initializationError) {
            throw new Error(this.initializationError)
        }

        this.currentVideo = video
        this.isDetecting = true
        this.detectionStatusSubject.next('detecting')

        console.log(
            '🎯 ENHANCED-DETECTION: Starting continuous face detection...'
        )

        // Start detection loop
        this.detectFaces(constraints)
    }

    async startDocumentDetection(
        video: HTMLVideoElement,
        constraints: DetectionConstraints = this.getDefaultDocumentConstraints()
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize()
        }

        if (this.initializationError) {
            throw new Error(this.initializationError)
        }

        this.currentVideo = video
        this.isDetecting = true
        this.detectionStatusSubject.next('detecting')

        console.log('🎯 ENHANCED-DETECTION: Starting document detection...')

        // For now, simulate document detection
        // In a real implementation, you would use MediaPipe Document Scanner
        this.simulateDocumentDetection(constraints)
    }

    stopDetection(): void {
        this.isDetecting = false
        this.detectionStatusSubject.next('idle')

        if (this.detectionLoop) {
            cancelAnimationFrame(this.detectionLoop)
            this.detectionLoop = null
        }

        // Clear detection results
        this.faceDetectionSubject.next(null)
        this.multipleFaceDetectionSubject.next(null)
        this.documentDetectionSubject.next(null)

        console.log('🎯 ENHANCED-DETECTION: Detection stopped')
    }

    private async detectFaces(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) return

        const now = performance.now()

        // Throttle detection to avoid overwhelming the system
        if (now - this.lastDetectionTime < this.detectionInterval) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectFaces(constraints)
            )
            return
        }

        this.lastDetectionTime = now

        try {
            let result: MultipleFaceDetectionResult | null = null

            // Try MediaPipe first, fallback to BlazeFace
            if (this.faceDetector) {
                result = await this.detectFaceWithMediaPipe(constraints)
            } else if (this.blazefaceModel) {
                result = await this.detectFaceWithBlazeFace(constraints)
            }

            if (result) {
                // Update detection history for each face
                result.faces.forEach((face) => {
                    if (face.faceId) {
                        this.updateDetectionHistory(face.faceId, face)
                    }
                })

                // Emit multiple face detection result
                this.multipleFaceDetectionSubject.next(result)

                // Emit primary face for backward compatibility
                if (result.primaryFace) {
                    this.faceDetectionSubject.next(result.primaryFace)
                }
            } else {
                // No faces detected
                this.multipleFaceDetectionSubject.next(null)
                this.faceDetectionSubject.next(null)
            }
        } catch (error) {
            console.error('🎯 ENHANCED-DETECTION: Face detection error:', error)
            this.detectionErrorSubject.next(
                `Detection error: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }

        // Continue detection loop
        if (this.isDetecting) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectFaces(constraints)
            )
        }
    }

    private async detectFaceWithMediaPipe(
        constraints: DetectionConstraints
    ): Promise<MultipleFaceDetectionResult | null> {
        if (!this.faceDetector || !this.currentVideo) return null

        try {
            const detections = this.faceDetector.detectForVideo(
                this.currentVideo,
                performance.now()
            )

            if (detections.detections.length === 0) return null

            const faces: DetectionResult[] = []
            let primaryFace: DetectionResult | null = null

            // Process all detected faces
            for (let i = 0; i < detections.detections.length; i++) {
                const detection = detections.detections[i]
                const bbox = detection.boundingBox

                if (!bbox) continue

                // Transform coordinates to match video display size
                const transformedBbox = this.transformBoundingBoxToDisplay(
                    bbox.originX,
                    bbox.originY,
                    bbox.width,
                    bbox.height
                )

                const result: DetectionResult = {
                    confidence: detection.categories[0]?.score || 0,
                    boundingBox: transformedBbox,
                    steady: false,
                    faceId: `mediapipe_face_${this.faceIdCounter++}`,
                    message: `Face ${i + 1} detected`,
                }

                const validatedResult = this.validateFaceDetection(
                    result,
                    constraints
                )
                if (validatedResult) {
                    faces.push(validatedResult)

                    // Set the first valid face as primary
                    if (!primaryFace) {
                        primaryFace = validatedResult
                    }
                }
            }

            if (faces.length === 0) return null

            return {
                faces,
                totalFaces: faces.length,
                primaryFace: primaryFace || undefined,
            }
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: MediaPipe detection error:',
                error
            )
            return null
        }
    }

    private async detectFaceWithBlazeFace(
        constraints: DetectionConstraints
    ): Promise<MultipleFaceDetectionResult | null> {
        if (!this.blazefaceModel || !this.currentVideo) return null

        try {
            const predictions = await this.blazefaceModel.estimateFaces(
                this.currentVideo,
                false
            )

            if (predictions.length === 0) return null

            const faces: DetectionResult[] = []
            let primaryFace: DetectionResult | null = null

            // Process all detected faces
            for (let i = 0; i < predictions.length; i++) {
                const prediction = predictions[i]
                const topLeft = prediction.topLeft as [number, number]
                const bottomRight = prediction.bottomRight as [number, number]

                // Transform coordinates to match video display size
                const transformedBbox = this.transformBoundingBoxToDisplay(
                    topLeft[0],
                    topLeft[1],
                    bottomRight[0] - topLeft[0],
                    bottomRight[1] - topLeft[1]
                )

                const result: DetectionResult = {
                    confidence: Array.isArray(prediction.probability)
                        ? prediction.probability[0]
                        : prediction.probability,
                    boundingBox: transformedBbox,
                    steady: false, // Will be set by validateFaceDetection
                    faceId: `blazeface_face_${this.faceIdCounter++}`,
                    message: `Face ${i + 1} detected`,
                }

                const validatedResult = this.validateFaceDetection(
                    result,
                    constraints
                )
                if (validatedResult) {
                    faces.push(validatedResult)

                    // Set the largest/most centered face as primary for auto-capture
                    if (
                        !primaryFace ||
                        this.isBetterPrimaryFace(validatedResult, primaryFace)
                    ) {
                        primaryFace = validatedResult
                    }
                }
            }

            if (faces.length === 0) return null

            return {
                faces,
                totalFaces: faces.length,
                primaryFace: primaryFace || undefined,
            }
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: BlazeFace detection error:',
                error
            )
            return null
        }
    }

    private transformBoundingBoxToDisplay(
        x: number,
        y: number,
        width: number,
        height: number
    ): { x: number; y: number; width: number; height: number } {
        if (!this.currentVideo) {
            return { x, y, width, height }
        }

        // Get the video's natural dimensions
        const videoWidth = this.currentVideo.videoWidth
        const videoHeight = this.currentVideo.videoHeight

        // Get the video's display dimensions
        const displayWidth = this.currentVideo.clientWidth
        const displayHeight = this.currentVideo.clientHeight

        // Calculate scaling factors
        const scaleX = displayWidth / videoWidth
        const scaleY = displayHeight / videoHeight

        // Transform coordinates to display space
        return {
            x: x * scaleX,
            y: y * scaleY,
            width: width * scaleX,
            height: height * scaleY,
        }
    }

    private isBetterPrimaryFace(
        newFace: DetectionResult,
        currentPrimary: DetectionResult
    ): boolean {
        // Prefer faces that are more centered
        const videoWidth = this.currentVideo?.clientWidth || 640
        const videoHeight = this.currentVideo?.clientHeight || 480

        const newCenterX = newFace.boundingBox.x + newFace.boundingBox.width / 2
        const newCenterY =
            newFace.boundingBox.y + newFace.boundingBox.height / 2
        const currentCenterX =
            currentPrimary.boundingBox.x + currentPrimary.boundingBox.width / 2
        const currentCenterY =
            currentPrimary.boundingBox.y + currentPrimary.boundingBox.height / 2

        const videoCenterX = videoWidth / 2
        const videoCenterY = videoHeight / 2

        const newDistanceFromCenter = Math.sqrt(
            Math.pow(newCenterX - videoCenterX, 2) +
                Math.pow(newCenterY - videoCenterY, 2)
        )
        const currentDistanceFromCenter = Math.sqrt(
            Math.pow(currentCenterX - videoCenterX, 2) +
                Math.pow(currentCenterY - videoCenterY, 2)
        )

        // Prefer face that is closer to center
        if (Math.abs(newDistanceFromCenter - currentDistanceFromCenter) > 50) {
            return newDistanceFromCenter < currentDistanceFromCenter
        }

        // If similar distance from center, prefer larger face
        const newArea = newFace.boundingBox.width * newFace.boundingBox.height
        const currentArea =
            currentPrimary.boundingBox.width * currentPrimary.boundingBox.height

        return newArea > currentArea
    }

    private validateFaceDetection(
        result: DetectionResult,
        constraints: DetectionConstraints
    ): DetectionResult | null {
        if (result.confidence < constraints.minConfidence) {
            return null
        }

        const { boundingBox } = result
        const videoWidth = this.currentVideo?.videoWidth || 640
        const videoHeight = this.currentVideo?.videoHeight || 480

        // Convert to relative coordinates
        const relativeWidth = boundingBox.width / videoWidth
        const relativeHeight = boundingBox.height / videoHeight

        // Check size constraints
        if (
            relativeWidth < constraints.minSize ||
            relativeWidth > constraints.maxSize
        ) {
            return null
        }

        if (
            relativeHeight < constraints.minSize ||
            relativeHeight > constraints.maxSize
        ) {
            return null
        }

        // Check if face is centered
        const centerX = (boundingBox.x + boundingBox.width / 2) / videoWidth
        const centerY = (boundingBox.y + boundingBox.height / 2) / videoHeight
        const videoCenterX = 0.5
        const videoCenterY = 0.5

        const distanceFromCenter = Math.sqrt(
            Math.pow(centerX - videoCenterX, 2) +
                Math.pow(centerY - videoCenterY, 2)
        )

        if (distanceFromCenter > constraints.centerThreshold) {
            result.message = 'Please center your face in the frame'
            return result
        }

        // Check if face is steady
        const history =
            this.detectionHistory.get(result.faceId || 'unknown') || []
        const steadyCount = this.getSteadyFrames(
            history,
            result,
            constraints.steadyFrames
        )

        result.steady = false // Not using steady logic anymore
        result.message = `Face detected (confidence: ${(
            result.confidence * 100
        ).toFixed(1)}%)`

        return result
    }

    private updateDetectionHistory(
        faceId: string,
        result: DetectionResult
    ): void {
        const history = this.detectionHistory.get(faceId) || []

        // Add timestamp to the result
        const resultWithTimestamp = {
            ...result,
            timestamp: Date.now(),
        }

        history.push(resultWithTimestamp)

        // Keep only recent history
        if (history.length > 30) {
            history.shift()
        }

        this.detectionHistory.set(faceId, history)
    }

    private getSteadyFrames(
        history: DetectionResult[],
        currentResult: DetectionResult,
        requiredFrames: number
    ): number {
        let steadyCount = 0

        for (let i = history.length - 1; i >= 0; i--) {
            const pastResult = history[i]
            const timeDiff = Date.now() - ((pastResult as any).timestamp || 0)

            // Only consider recent detections (within 2 seconds)
            if (timeDiff > 2000) break

            // Check if face position is similar
            const positionDiff = Math.sqrt(
                Math.pow(
                    pastResult.boundingBox.x - currentResult.boundingBox.x,
                    2
                ) +
                    Math.pow(
                        pastResult.boundingBox.y - currentResult.boundingBox.y,
                        2
                    )
            )

            if (positionDiff < 20) {
                // 20 pixel threshold
                steadyCount++
            } else {
                break
            }
        }

        return Math.min(steadyCount, requiredFrames)
    }

    public getDefaultFaceConstraints(): DetectionConstraints {
        return {
            minConfidence: 0.4, // Lowered for better auto-capture responsiveness
            minSize: 0.1, // 10% of frame
            maxSize: 0.6, // 60% of frame
            centerThreshold: 0.3, // 30% offset from center (more lenient)
            steadyFrames: 1, // Not used anymore, but kept for compatibility
        }
    }

    public getDefaultDocumentConstraints(): DetectionConstraints {
        return {
            minConfidence: 0.8,
            minSize: 0.2,
            maxSize: 0.8,
            centerThreshold: 0.3,
            steadyFrames: 10,
            aspectRatioRange: { min: 1.2, max: 2.0 },
        }
    }

    private async simulateDocumentDetection(
        constraints: DetectionConstraints
    ): Promise<void> {
        // Simulate document detection for now
        // In real implementation, use MediaPipe Document Scanner
        const mockResult: DocumentDetectionResult = {
            confidence: 0.85,
            quad: {
                topLeft: { x: 0.1, y: 0.1 },
                topRight: { x: 0.9, y: 0.1 },
                bottomLeft: { x: 0.1, y: 0.8 },
                bottomRight: { x: 0.9, y: 0.8 },
            },
            boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.7 },
            steady: false,
            quality: 0.8,
            aspectRatio: 1.6,
            message: 'Document detected',
        }

        // Update detection history
        this.updateDocumentHistory('document', mockResult)

        // Emit result
        this.documentDetectionSubject.next(mockResult)

        console.log(
            '🎯 ENHANCED-DETECTION: Document detection simulated:',
            mockResult
        )
    }

    private updateDocumentHistory(
        documentId: string,
        result: DocumentDetectionResult
    ): void {
        const history = this.documentHistory.get(documentId) || []
        history.push(result)

        // Keep only recent history
        if (history.length > 30) {
            history.shift()
        }

        this.documentHistory.set(documentId, history)
    }

    // Getters for current state
    get isDetectingFaces(): boolean {
        return this.isDetecting
    }

    get hasInitializationError(): boolean {
        return !!this.initializationError
    }

    get initializationErrorMessage(): string | null {
        return this.initializationError
    }
}
