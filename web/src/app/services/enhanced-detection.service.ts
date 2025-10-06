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

export interface DetectionConstraints {
    minConfidence: number
    minSize: number
    maxSize: number
    centerThreshold: number
    steadyFrames: number
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
    private detectionErrorSubject = new BehaviorSubject<string | null>(null)
    private detectionStatusSubject = new BehaviorSubject<
        'idle' | 'initializing' | 'detecting' | 'error'
    >('idle')

    public faceDetection$ = this.faceDetectionSubject.asObservable()
    public multipleFaceDetection$ =
        this.multipleFaceDetectionSubject.asObservable()
    public detectionError$ = this.detectionErrorSubject.asObservable()
    public detectionStatus$ = this.detectionStatusSubject.asObservable()

    async initialize(): Promise<void> {
        if (this.isInitialized) return

        this.detectionStatusSubject.next('initializing')

        try {
            // Initialize TensorFlow.js
            await tf.ready()
            console.log('🎯 ENHANCED-DETECTION: TensorFlow.js initialized')

            // Try to initialize MediaPipe FaceDetector first
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
                    '🎯 ENHANCED-DETECTION: MediaPipe FaceDetector initialized'
                )
            } catch (mediapipeError) {
                console.warn(
                    '🎯 ENHANCED-DETECTION: MediaPipe initialization failed, falling back to BlazeFace:',
                    mediapipeError
                )

                // Fallback to BlazeFace
                this.blazefaceModel = await blazeface.load()
                console.log(
                    '🎯 ENHANCED-DETECTION: BlazeFace model loaded as fallback'
                )
            }

            this.isInitialized = true
            this.detectionStatusSubject.next('idle')
            console.log(
                '🎯 ENHANCED-DETECTION: Service initialized successfully'
            )
        } catch (error) {
            this.initializationError = `Failed to initialize detection service: ${error}`
            this.detectionStatusSubject.next('error')
            this.detectionErrorSubject.next(this.initializationError)
            console.error(
                '🎯 ENHANCED-DETECTION: Initialization failed:',
                error
            )
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

        console.log('🎯 ENHANCED-DETECTION: Starting face detection')
        this.performFaceDetection(constraints)
    }

    stopDetection(): void {
        this.isDetecting = false
        this.detectionStatusSubject.next('idle')

        if (this.detectionLoop) {
            cancelAnimationFrame(this.detectionLoop)
            this.detectionLoop = null
        }

        console.log('🎯 ENHANCED-DETECTION: Face detection stopped')
    }

    getDefaultFaceConstraints(): DetectionConstraints {
        return {
            minConfidence: 0.7,
            minSize: 0.1,
            maxSize: 0.9,
            centerThreshold: 0.3,
            steadyFrames: 3,
        }
    }

    private async performFaceDetection(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) return

        const now = performance.now()

        // Throttle detection to avoid overwhelming the system
        if (now - this.lastDetectionTime < this.detectionInterval) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.performFaceDetection(constraints)
            )
            return
        }

        this.lastDetectionTime = now

        try {
            let result: DetectionResult | null = null

            // Use the appropriate detection method
            if (this.faceDetector) {
                result = await this.detectUsingMediaPipe(constraints)
            } else if (this.blazefaceModel) {
                result = await this.detectUsingBlazeFace(constraints)
            }

            if (result) {
                this.faceDetectionSubject.next(result)
                this.updateDetectionHistory('face', result)

                // Create multiple face detection result
                const multipleFaceResult: MultipleFaceDetectionResult = {
                    faces: [result],
                    totalFaces: 1,
                    primaryFace: result,
                }
                this.multipleFaceDetectionSubject.next(multipleFaceResult)
            } else {
                this.faceDetectionSubject.next(null)
                this.multipleFaceDetectionSubject.next(null)
            }

            // Continue detection loop
            this.detectionLoop = requestAnimationFrame(() =>
                this.performFaceDetection(constraints)
            )
        } catch (error) {
            console.error('🎯 ENHANCED-DETECTION: Face detection error:', error)
            this.detectionErrorSubject.next(`Face detection error: ${error}`)
            this.detectionLoop = requestAnimationFrame(() =>
                this.performFaceDetection(constraints)
            )
        }
    }

    private async detectUsingMediaPipe(
        constraints: DetectionConstraints
    ): Promise<DetectionResult | null> {
        if (!this.faceDetector || !this.currentVideo) return null

        try {
            const detections = this.faceDetector.detectForVideo(
                this.currentVideo,
                performance.now()
            )

            if (detections.detections.length === 0) return null

            // Get the largest face (most likely to be the primary subject)
            const largestFace = detections.detections.reduce(
                (largest, current) => {
                    const currentArea =
                        (current.boundingBox?.width || 0) *
                        (current.boundingBox?.height || 0)
                    const largestArea =
                        (largest.boundingBox?.width || 0) *
                        (largest.boundingBox?.height || 0)
                    return currentArea > largestArea ? current : largest
                }
            )

            const confidence = largestFace.categories[0]?.score || 0

            if (confidence < constraints.minConfidence) return null

            // Get video dimensions for proper positioning
            const videoWidth = this.currentVideo.videoWidth
            const videoHeight = this.currentVideo.videoHeight
            const displayWidth = this.currentVideo.clientWidth
            const displayHeight = this.currentVideo.clientHeight

            // Calculate scale factors
            const scaleX = displayWidth / videoWidth
            const scaleY = displayHeight / videoHeight

            // Get original bounding box coordinates
            const origX = largestFace.boundingBox?.originX || 0
            const origY = largestFace.boundingBox?.originY || 0
            const origWidth = largestFace.boundingBox?.width || 0
            const origHeight = largestFace.boundingBox?.height || 0

            // Scale and center the bounding box
            const scaledX = origX * scaleX
            const scaledY = origY * scaleY
            const scaledWidth = origWidth * scaleX
            const scaledHeight = origHeight * scaleY

            // Center the bounding box by adjusting position
            const centeredX = scaledX + scaledWidth * 0.1 // Slight adjustment for better centering
            const centeredY = scaledY + scaledHeight * 0.1 // Slight adjustment for better centering
            const centeredWidth = scaledWidth * 0.8 // Slightly smaller for better visual
            const centeredHeight = scaledHeight * 0.8 // Slightly smaller for better visual

            const result: DetectionResult = {
                confidence,
                boundingBox: {
                    x: Math.max(0, centeredX),
                    y: Math.max(0, centeredY),
                    width: Math.min(centeredWidth, displayWidth - centeredX),
                    height: Math.min(centeredHeight, displayHeight - centeredY),
                },
                steady: this.isFaceSteady(largestFace, constraints),
                quality: this.calculateFaceQuality(largestFace),
                message: this.generateFaceMessage(confidence, constraints),
                faceId: `face_${this.faceIdCounter++}`,
            }

            return result
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: MediaPipe detection error:',
                error
            )
            return null
        }
    }

    private async detectUsingBlazeFace(
        constraints: DetectionConstraints
    ): Promise<DetectionResult | null> {
        if (!this.blazefaceModel || !this.currentVideo) return null

        try {
            const predictions = await this.blazefaceModel.estimateFaces(
                this.currentVideo,
                false
            )

            if (predictions.length === 0) return null

            // Get the largest face
            const largestFace = predictions.reduce((largest, current) => {
                const currentTopLeft = (current as any).topLeft || [0, 0]
                const currentTopRight = (current as any).topRight || [0, 0]
                const currentBottomLeft = (current as any).bottomLeft || [0, 0]

                const largestTopLeft = (largest as any).topLeft || [0, 0]
                const largestTopRight = (largest as any).topRight || [0, 0]
                const largestBottomLeft = (largest as any).bottomLeft || [0, 0]

                const currentArea =
                    (currentTopRight[0] - currentTopLeft[0]) *
                    (currentBottomLeft[1] - currentTopLeft[1])
                const largestArea =
                    (largestTopRight[0] - largestTopLeft[0]) *
                    (largestBottomLeft[1] - largestTopLeft[1])
                return currentArea > largestArea ? current : largest
            })

            const confidence = (largestFace as any).probability?.[0] || 0

            if (confidence < constraints.minConfidence) return null

            const topLeft = (largestFace as any).topLeft || [0, 0]
            const topRight = (largestFace as any).topRight || [0, 0]
            const bottomLeft = (largestFace as any).bottomLeft || [0, 0]

            // Get video dimensions for proper positioning
            const displayWidth = this.currentVideo.clientWidth
            const displayHeight = this.currentVideo.clientHeight

            // Get original bounding box coordinates (BlazeFace uses pixel coordinates)
            const origX = topLeft[0]
            const origY = topLeft[1]
            const origWidth = topRight[0] - topLeft[0]
            const origHeight = bottomLeft[1] - topLeft[1]

            // Center the bounding box by adjusting position
            const centeredX = origX + origWidth * 0.1 // Slight adjustment for better centering
            const centeredY = origY + origHeight * 0.1 // Slight adjustment for better centering
            const centeredWidth = origWidth * 0.8 // Slightly smaller for better visual
            const centeredHeight = origHeight * 0.8 // Slightly smaller for better visual

            const result: DetectionResult = {
                confidence,
                boundingBox: {
                    x: Math.max(0, centeredX),
                    y: Math.max(0, centeredY),
                    width: Math.min(centeredWidth, displayWidth - centeredX),
                    height: Math.min(centeredHeight, displayHeight - centeredY),
                },
                steady: this.isBlazeFaceSteady(largestFace, constraints),
                quality: this.calculateBlazeFaceQuality(largestFace),
                message: this.generateFaceMessage(confidence, constraints),
                faceId: `face_${this.faceIdCounter++}`,
            }

            return result
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: BlazeFace detection error:',
                error
            )
            return null
        }
    }

    private isFaceSteady(
        face: any,
        constraints: DetectionConstraints
    ): boolean {
        const history = this.detectionHistory.get('face') || []
        if (history.length < constraints.steadyFrames) return false

        const recentFaces = history.slice(-constraints.steadyFrames)
        const currentCenter = {
            x: face.boundingBox.originX + face.boundingBox.width / 2,
            y: face.boundingBox.originY + face.boundingBox.height / 2,
        }

        return recentFaces.every((prevFace) => {
            const prevCenter = {
                x: prevFace.boundingBox.x + prevFace.boundingBox.width / 2,
                y: prevFace.boundingBox.y + prevFace.boundingBox.height / 2,
            }

            const distance = Math.sqrt(
                Math.pow(currentCenter.x - prevCenter.x, 2) +
                    Math.pow(currentCenter.y - prevCenter.y, 2)
            )

            return distance < constraints.centerThreshold * 100
        })
    }

    private isBlazeFaceSteady(
        face: any,
        constraints: DetectionConstraints
    ): boolean {
        const history = this.detectionHistory.get('face') || []
        if (history.length < constraints.steadyFrames) return false

        const recentFaces = history.slice(-constraints.steadyFrames)
        const topLeft = (face as any).topLeft || [0, 0]
        const topRight = (face as any).topRight || [0, 0]
        const bottomLeft = (face as any).bottomLeft || [0, 0]

        const currentCenter = {
            x: (topLeft[0] + topRight[0]) / 2,
            y: (topLeft[1] + bottomLeft[1]) / 2,
        }

        return recentFaces.every((prevFace) => {
            const prevCenter = {
                x: prevFace.boundingBox.x + prevFace.boundingBox.width / 2,
                y: prevFace.boundingBox.y + prevFace.boundingBox.height / 2,
            }

            const distance = Math.sqrt(
                Math.pow(currentCenter.x - prevCenter.x, 2) +
                    Math.pow(currentCenter.y - prevCenter.y, 2)
            )

            return distance < constraints.centerThreshold * 100
        })
    }

    private calculateFaceQuality(face: any): number {
        // Simple quality calculation based on size and confidence
        const size =
            (face.boundingBox?.width || 0) * (face.boundingBox?.height || 0)
        const confidence = face.categories[0]?.score || 0
        return Math.min(1.0, (size / 10000) * confidence)
    }

    private calculateBlazeFaceQuality(face: any): number {
        // Simple quality calculation for BlazeFace
        const topLeft = (face as any).topLeft || [0, 0]
        const topRight = (face as any).topRight || [0, 0]
        const bottomLeft = (face as any).bottomLeft || [0, 0]

        const size = (topRight[0] - topLeft[0]) * (bottomLeft[1] - topLeft[1])
        const confidence = (face as any).probability?.[0] || 0
        return Math.min(1.0, (size / 10000) * confidence)
    }

    private generateFaceMessage(
        confidence: number,
        constraints: DetectionConstraints
    ): string {
        if (confidence > 0.8) {
            return 'Face detected! Hold steady for capture'
        } else if (confidence > constraints.minConfidence) {
            return 'Face detected, position better'
        } else {
            return 'Please position your face in the camera view'
        }
    }

    private updateDetectionHistory(
        type: string,
        result: DetectionResult
    ): void {
        const history = this.detectionHistory.get(type) || []
        history.push(result)

        // Keep only last 10 detections
        if (history.length > 10) {
            history.shift()
        }

        this.detectionHistory.set(type, history)
    }

    // Cleanup method
    ngOnDestroy(): void {
        this.stopDetection()
        this.faceDetectionSubject.complete()
        this.multipleFaceDetectionSubject.complete()
        this.detectionErrorSubject.complete()
        this.detectionStatusSubject.complete()
    }
}
