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
    quality: number
    aspectRatio: number
    message?: string
}

export interface DetectionConstraints {
    minConfidence: number
    minSize: number // percentage of frame
    maxSize: number // percentage of frame
    centerThreshold: number // percentage offset from center
    steadyFrames: number
    minQuality?: number
    aspectRatioRange?: { min: number; max: number }
}

@Injectable({
    providedIn: 'root',
})
export class DetectionService {
    private faceDetector: FaceDetector | null = null
    private blazefaceModel: blazeface.BlazeFaceModel | null = null
    private isInitialized = false
    private detectionHistory: Map<string, DetectionResult[]> = new Map()
    private documentHistory: Map<string, DocumentDetectionResult[]> = new Map()

    // Detection state
    private isDetecting = false
    private detectionLoop: number | null = null
    private currentVideo: HTMLVideoElement | null = null

    // Observables for detection results
    private faceDetectionSubject = new BehaviorSubject<DetectionResult | null>(
        null
    )
    private documentDetectionSubject =
        new BehaviorSubject<DocumentDetectionResult | null>(null)

    public faceDetection$ = this.faceDetectionSubject.asObservable()
    public documentDetection$ = this.documentDetectionSubject.asObservable()

    async initialize(): Promise<void> {
        if (this.isInitialized) return

        try {
            console.log(
                '🎯 DETECTION-SERVICE: Initializing detection models...'
            )

            // Initialize TensorFlow.js backend
            await tf.ready()
            console.log('🎯 DETECTION-SERVICE: TensorFlow.js ready')

            // Initialize BlazeFace model (fallback for face detection)
            this.blazefaceModel = await blazeface.load()
            console.log('🎯 DETECTION-SERVICE: BlazeFace model loaded')

            // Initialize MediaPipe Face Detector
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
            )
            this.faceDetector = await FaceDetector.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
                    delegate: 'GPU',
                },
                runningMode: 'VIDEO',
            })
            console.log('🎯 DETECTION-SERVICE: MediaPipe Face Detector loaded')

            this.isInitialized = true
            console.log(
                '🎯 DETECTION-SERVICE: All detection models initialized successfully'
            )
        } catch (error) {
            console.error(
                '🎯 DETECTION-SERVICE: Failed to initialize detection models:',
                error
            )
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

        if (this.isDetecting) {
            this.stopDetection()
        }

        this.currentVideo = video
        this.isDetecting = true
        this.detectionHistory.set('face', [])

        console.log('🎯 DETECTION-SERVICE: Starting face detection...')
        this.detectionLoop = requestAnimationFrame(() =>
            this.detectFace(constraints)
        )
    }

    async startDocumentDetection(
        video: HTMLVideoElement,
        constraints: DetectionConstraints = this.getDefaultDocumentConstraints()
    ): Promise<void> {
        if (!this.isInitialized) {
            await this.initialize()
        }

        if (this.isDetecting) {
            this.stopDetection()
        }

        this.currentVideo = video
        this.isDetecting = true
        this.documentHistory.set('document', [])

        console.log('🎯 DETECTION-SERVICE: Starting document detection...')
        this.detectionLoop = requestAnimationFrame(() =>
            this.detectDocument(constraints)
        )
    }

    stopDetection(): void {
        if (this.detectionLoop) {
            cancelAnimationFrame(this.detectionLoop)
            this.detectionLoop = null
        }
        this.isDetecting = false
        this.currentVideo = null
        console.log('🎯 DETECTION-SERVICE: Detection stopped')
    }

    private async detectFace(constraints: DetectionConstraints): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) return

        try {
            let result: DetectionResult | null = null

            // Try MediaPipe first, fallback to BlazeFace
            if (this.faceDetector) {
                result = await this.detectFaceWithMediaPipe(constraints)
            } else if (this.blazefaceModel) {
                result = await this.detectFaceWithBlazeFace(constraints)
            }

            if (result) {
                this.updateDetectionHistory('face', result)
                this.faceDetectionSubject.next(result)
            }

            // Continue detection loop
            if (this.isDetecting) {
                this.detectionLoop = requestAnimationFrame(() =>
                    this.detectFace(constraints)
                )
            }
        } catch (error) {
            console.error('🎯 DETECTION-SERVICE: Face detection error:', error)
            if (this.isDetecting) {
                this.detectionLoop = requestAnimationFrame(() =>
                    this.detectFace(constraints)
                )
            }
        }
    }

    private async detectDocument(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) return

        try {
            // For now, simulate document detection
            // In a real implementation, you would use MediaPipe Document Scanner
            const result = await this.simulateDocumentDetection(constraints)

            if (result) {
                this.updateDocumentHistory('document', result)
                this.documentDetectionSubject.next(result)
            }

            // Continue detection loop
            if (this.isDetecting) {
                this.detectionLoop = requestAnimationFrame(() =>
                    this.detectDocument(constraints)
                )
            }
        } catch (error) {
            console.error(
                '🎯 DETECTION-SERVICE: Document detection error:',
                error
            )
            if (this.isDetecting) {
                this.detectionLoop = requestAnimationFrame(() =>
                    this.detectDocument(constraints)
                )
            }
        }
    }

    private async detectFaceWithMediaPipe(
        constraints: DetectionConstraints
    ): Promise<DetectionResult | null> {
        if (!this.faceDetector || !this.currentVideo) return null

        const detections = this.faceDetector.detectForVideo(
            this.currentVideo,
            performance.now()
        )

        if (detections.detections.length === 0) return null

        const detection = detections.detections[0]
        const bbox = detection.boundingBox

        if (!bbox) return null

        const result: DetectionResult = {
            confidence: detection.categories[0]?.score || 0,
            boundingBox: {
                x: bbox.originX,
                y: bbox.originY,
                width: bbox.width,
                height: bbox.height,
            },
            steady: false,
        }

        return this.validateFaceDetection(result, constraints)
    }

    private async detectFaceWithBlazeFace(
        constraints: DetectionConstraints
    ): Promise<DetectionResult | null> {
        if (!this.blazefaceModel || !this.currentVideo) return null

        const predictions = await this.blazefaceModel.estimateFaces(
            this.currentVideo,
            false
        )

        if (predictions.length === 0) return null

        const prediction = predictions[0]
        const topLeft = prediction.topLeft as [number, number]
        const bottomRight = prediction.bottomRight as [number, number]

        const result: DetectionResult = {
            confidence: Array.isArray(prediction.probability)
                ? prediction.probability[0]
                : prediction.probability,
            boundingBox: {
                x: topLeft[0],
                y: topLeft[1],
                width: bottomRight[0] - topLeft[0],
                height: bottomRight[1] - topLeft[1],
            },
            steady: false,
            message: 'Face detected',
        }

        return this.validateFaceDetection(result, constraints)
    }

    private async simulateDocumentDetection(
        constraints: DetectionConstraints
    ): Promise<DocumentDetectionResult | null> {
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

        return this.validateDocumentDetection(mockResult, constraints)
    }

    private validateFaceDetection(
        result: DetectionResult,
        constraints: DetectionConstraints
    ): DetectionResult | null {
        const { confidence, boundingBox } = result
        const { minConfidence, minSize, maxSize, centerThreshold } = constraints

        // Check confidence
        if (confidence < minConfidence) return null

        // Check size constraints (as percentage of frame)
        const frameWidth = this.currentVideo?.videoWidth || 640
        const frameHeight = this.currentVideo?.videoHeight || 480
        const boxArea =
            (boundingBox.width * boundingBox.height) /
            (frameWidth * frameHeight)

        if (boxArea < minSize || boxArea > maxSize) return null

        // Check center alignment
        const centerX = boundingBox.x + boundingBox.width / 2
        const centerY = boundingBox.y + boundingBox.height / 2
        const frameCenterX = frameWidth / 2
        const frameCenterY = frameHeight / 2

        const offsetX = Math.abs(centerX - frameCenterX) / frameWidth
        const offsetY = Math.abs(centerY - frameCenterY) / frameHeight

        if (offsetX > centerThreshold || offsetY > centerThreshold) return null

        return result
    }

    private validateDocumentDetection(
        result: DocumentDetectionResult,
        constraints: DetectionConstraints
    ): DocumentDetectionResult | null {
        const { confidence, quality, aspectRatio } = result
        const { minConfidence, minQuality, aspectRatioRange } = constraints

        // Check confidence
        if (confidence < minConfidence) return null

        // Check quality
        if (minQuality && quality < minQuality) return null

        // Check aspect ratio
        if (aspectRatioRange) {
            if (
                aspectRatio < aspectRatioRange.min ||
                aspectRatio > aspectRatioRange.max
            )
                return null
        }

        return result
    }

    private updateDetectionHistory(
        type: string,
        result: DetectionResult
    ): void {
        const history = this.detectionHistory.get(type) || []
        history.push(result)

        // Keep only recent history
        if (history.length > 20) {
            history.shift()
        }

        this.detectionHistory.set(type, history)

        // Check if detection is steady
        const steadyFrames = this.getSteadyFrames(history)
        result.steady = steadyFrames >= 12 // Default steady threshold
    }

    private updateDocumentHistory(
        type: string,
        result: DocumentDetectionResult
    ): void {
        const history = this.documentHistory.get(type) || []
        history.push(result)

        // Keep only recent history
        if (history.length > 20) {
            history.shift()
        }

        this.documentHistory.set(type, history)

        // Check if detection is steady
        const steadyFrames = this.getDocumentSteadyFrames(history)
        result.steady = steadyFrames >= 12 // Default steady threshold
    }

    private getSteadyFrames(history: DetectionResult[]): number {
        if (history.length < 2) return 0

        let steadyCount = 0
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].confidence >= 0.95) {
                steadyCount++
            } else {
                break
            }
        }
        return steadyCount
    }

    private getDocumentSteadyFrames(
        history: DocumentDetectionResult[]
    ): number {
        if (history.length < 2) return 0

        let steadyCount = 0
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].confidence >= 0.8 && history[i].quality >= 0.7) {
                steadyCount++
            } else {
                break
            }
        }
        return steadyCount
    }

    public getDefaultFaceConstraints(): DetectionConstraints {
        return {
            minConfidence: 0.95,
            minSize: 0.1, // 10% of frame
            maxSize: 0.45, // 45% of frame
            centerThreshold: 0.12, // 12% offset from center
            steadyFrames: 12,
        }
    }

    public getDefaultDocumentConstraints(): DetectionConstraints {
        return {
            minConfidence: 0.8,
            minSize: 0.2, // 20% of frame
            maxSize: 0.8, // 80% of frame
            centerThreshold: 0.15, // 15% offset from center
            steadyFrames: 12,
            minQuality: 0.7,
            aspectRatioRange: { min: 1.4, max: 1.8 }, // PAN/Aadhaar aspect ratios
        }
    }

    getConstraintsForDocumentType(
        documentType: 'pan' | 'aadhaar'
    ): DetectionConstraints {
        const baseConstraints = this.getDefaultDocumentConstraints()

        if (documentType === 'pan') {
            baseConstraints.aspectRatioRange = { min: 1.4, max: 1.6 }
        } else if (documentType === 'aadhaar') {
            baseConstraints.aspectRatioRange = { min: 1.5, max: 1.8 }
        }

        return baseConstraints
    }

    isReady(): boolean {
        return this.isInitialized
    }

    cleanup(): void {
        this.stopDetection()
        this.detectionHistory.clear()
        this.documentHistory.clear()
        this.faceDetectionSubject.next(null)
        this.documentDetectionSubject.next(null)
    }
}
