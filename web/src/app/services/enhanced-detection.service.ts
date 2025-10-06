import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

// Import MediaPipe and TensorFlow dependencies
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'
import * as blazeface from '@tensorflow-models/blazeface'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-cpu'
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
    private cocoSsdModel: any | null = null
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
    private detectionInterval = 150 // Slightly slower to reduce load and stabilize results

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
            // Initialization logs reduced for production

            // Initialize TensorFlow.js backend
            await tf.ready()
            // console.log('🎯 ENHANCED-DETECTION: TensorFlow.js ready')

            // Initialize BlazeFace model (fallback for face detection)
            try {
                this.blazefaceModel = await blazeface.load()
                // console.log('🎯 ENHANCED-DETECTION: BlazeFace model loaded')
            } catch (blazeError) {
                // console.warn('🎯 ENHANCED-DETECTION: BlazeFace model failed to load:', blazeError)
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
                // console.log('🎯 ENHANCED-DETECTION: MediaPipe Face Detector loaded')
            } catch (mediapipeError) {
                // console.warn('🎯 ENHANCED-DETECTION: MediaPipe model failed to load:', mediapipeError)
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
            // console.log('🎯 ENHANCED-DETECTION: Detection models initialized successfully')
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

        // Stop any existing detection first
        this.stopDetection()

        this.currentVideo = video
        this.isDetecting = true
        this.detectionStatusSubject.next('detecting')

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

        // Stop any existing detection first
        this.stopDetection()

        this.currentVideo = video
        this.isDetecting = true
        this.detectionStatusSubject.next('detecting')

        // Prefer WebGL if available to avoid CPU fallback; ensure backends are registered
        try {
            if (tf.getBackend() !== 'webgl') {
                await (tf as any).setBackend('webgl')
            }
        } catch (_) {
            // Ignore backend switch errors; coco-ssd will try available backends
        }

        // Attempt to lazy-load coco-ssd; if unavailable, fall back to heuristic
        try {
            if (!this.cocoSsdModel) {
                const cocoModule: any = await import(
                    /* webpackChunkName: "coco-ssd" */ '@tensorflow-models/coco-ssd'
                )
                // Use the light base for better perf on browsers
                this.cocoSsdModel = await cocoModule.load({
                    base: 'lite_mobilenet_v2',
                })
            }

            this.detectDocumentWithCoco(constraints)
        } catch (e) {
            console.warn(
                '🎯 ENHANCED-DETECTION: coco-ssd not available, using heuristic. Ensure @tensorflow/tfjs and @tensorflow-models/coco-ssd are installed.',
                e
            )
            this.detectDocumentHeuristic(constraints)
        }
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

        // Detection stopped
    }

    private async detectDocumentWithCoco(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) {
            return
        }

        const now = performance.now()
        if (now - this.lastDetectionTime < this.detectionInterval) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectDocumentWithCoco(constraints)
            )
            return
        }

        this.lastDetectionTime = now

        try {
            if (!this.cocoSsdModel || !this.currentVideo) {
                this.documentDetectionSubject.next(null)
            } else {
                const predictions: any[] = await this.cocoSsdModel.detect(
                    this.currentVideo
                )

                const videoWidth = this.currentVideo.videoWidth || 640
                const videoHeight = this.currentVideo.videoHeight || 480

                // Choose best rectangular candidate by confidence and constraints
                let best: { pred: any; score: number } | null = null
                for (const pred of predictions) {
                    const [x, y, w, h] = pred.bbox as [
                        number,
                        number,
                        number,
                        number
                    ]

                    // Relative area and aspect ratio checks
                    const areaRatio = (w * h) / (videoWidth * videoHeight)
                    const aspect = w / Math.max(1, h)

                    const aspectOk =
                        !constraints.aspectRatioRange ||
                        (aspect >= constraints.aspectRatioRange.min &&
                            aspect <= constraints.aspectRatioRange.max)
                    const sizeOk =
                        areaRatio >= constraints.minSize &&
                        areaRatio <= constraints.maxSize

                    if (!aspectOk || !sizeOk) continue

                    // Prefer more rectangular classes if available, but don't restrict
                    // Score blend: model score with aspect closeness and size fit
                    const modelScore: number = pred.score || 0
                    const aspectCenter = constraints.aspectRatioRange
                        ? (constraints.aspectRatioRange.min +
                              constraints.aspectRatioRange.max) /
                          2
                        : aspect
                    const aspectCloseness =
                        1 -
                        Math.min(
                            1,
                            Math.abs(aspect - aspectCenter) / aspectCenter
                        )
                    const sizeCloseness =
                        1 -
                        Math.min(
                            1,
                            Math.abs(
                                areaRatio -
                                    (constraints.minSize +
                                        constraints.maxSize) /
                                        2
                            ) /
                                ((constraints.maxSize - constraints.minSize) /
                                    2 || 1)
                        )
                    // Additional rectangularness and texture variance checks to reduce false positives
                    const displayBBox = this.transformBoundingBoxToDisplay(
                        x,
                        y,
                        w,
                        h
                    )
                    const checks = this.computeDocRectChecks(displayBBox)
                    if (checks.rectangularness < 0.7) continue
                    if (checks.variance < 20) continue

                    // Center check: prefer candidates near video center
                    const vw = this.currentVideo.clientWidth || 640
                    const vh = this.currentVideo.clientHeight || 480
                    const cx = displayBBox.x + displayBBox.width / 2
                    const cy = displayBBox.y + displayBBox.height / 2
                    const dx = Math.abs(cx - vw / 2) / (vw / 2)
                    const dy = Math.abs(cy - vh / 2) / (vh / 2)
                    const centerPenalty = Math.min(1, (dx + dy) / 2)

                    const score =
                        modelScore * 0.5 +
                        aspectCloseness * 0.15 +
                        sizeCloseness * 0.1 +
                        checks.rectangularness * 0.2 +
                        (1 - centerPenalty) * 0.05

                    if (!best || score > best.score) {
                        best = { pred, score }
                    }
                }

                if (best) {
                    const [x, y, w, h] = best.pred.bbox as [
                        number,
                        number,
                        number,
                        number
                    ]
                    const displayBBox = this.transformBoundingBoxToDisplay(
                        x,
                        y,
                        w,
                        h
                    )

                    // Require brief steadiness across recent frames (documentHistory)
                    const validated = this.validateDocSteady(
                        displayBBox,
                        best.score,
                        constraints
                    )
                    if (!validated) {
                        this.documentDetectionSubject.next(null)
                    } else {
                        const result: DocumentDetectionResult = {
                            confidence: validated.confidence,
                            quad: {
                                topLeft: { x: displayBBox.x, y: displayBBox.y },
                                topRight: {
                                    x: displayBBox.x + displayBBox.width,
                                    y: displayBBox.y,
                                },
                                bottomLeft: {
                                    x: displayBBox.x,
                                    y: displayBBox.y + displayBBox.height,
                                },
                                bottomRight: {
                                    x: displayBBox.x + displayBBox.width,
                                    y: displayBBox.y + displayBBox.height,
                                },
                            },
                            boundingBox: displayBBox,
                            steady: validated.steady,
                            quality: validated.quality,
                            aspectRatio: Math.max(1e-6, w / Math.max(1, h)),
                            message: `Document candidate detected (${(
                                validated.confidence * 100
                            ).toFixed(1)}%)`,
                        }

                        this.updateDocumentHistory('document', result)
                        this.documentDetectionSubject.next(result)
                    }
                } else {
                    // If model returned any predictions, emit the top one for debug visualization
                    if (predictions && predictions.length > 0) {
                        let top = predictions[0]
                        for (const p of predictions) {
                            if ((p.score || 0) > (top.score || 0)) top = p
                        }
                        const [dx, dy, dw, dh] = top.bbox as [
                            number,
                            number,
                            number,
                            number
                        ]
                        const dbgBBox = this.transformBoundingBoxToDisplay(
                            dx,
                            dy,
                            dw,
                            dh
                        )
                        const dbgResult: DocumentDetectionResult = {
                            confidence: Math.min(0.5, (top.score || 0) * 0.5),
                            quad: {
                                topLeft: { x: dbgBBox.x, y: dbgBBox.y },
                                topRight: {
                                    x: dbgBBox.x + dbgBBox.width,
                                    y: dbgBBox.y,
                                },
                                bottomLeft: {
                                    x: dbgBBox.x,
                                    y: dbgBBox.y + dbgBBox.height,
                                },
                                bottomRight: {
                                    x: dbgBBox.x + dbgBBox.width,
                                    y: dbgBBox.y + dbgBBox.height,
                                },
                            },
                            boundingBox: dbgBBox,
                            steady: false,
                            quality: top.score || 0,
                            aspectRatio: Math.max(1e-6, dw / Math.max(1, dh)),
                            message: 'Document candidate (debug)',
                        }
                        this.updateDocumentHistory('document', dbgResult)
                        console.log(
                            '🎯 ENHANCED-DETECTION: Debug document bbox emitted',
                            dbgResult
                        )
                        this.documentDetectionSubject.next(dbgResult)
                    } else {
                        // Fallback: run a quick heuristic check this frame
                        const heuristic =
                            this.estimateDocumentFromEdges(constraints)
                        if (heuristic) {
                            this.updateDocumentHistory('document', heuristic)
                            console.log(
                                '🎯 ENHANCED-DETECTION: Heuristic document bbox emitted',
                                heuristic
                            )
                            this.documentDetectionSubject.next(heuristic)
                        } else {
                            this.documentDetectionSubject.next(null)
                        }
                    }
                }
            }
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: coco-ssd detection error:',
                error
            )
            this.detectionErrorSubject.next(
                `Document detection error: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }

        if (this.isDetecting) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectDocumentWithCoco(constraints)
            )
        }
    }
    private async detectFaces(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) {
            return
        }

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

    private async detectDocumentHeuristic(
        constraints: DetectionConstraints
    ): Promise<void> {
        if (!this.isDetecting || !this.currentVideo) {
            return
        }

        const now = performance.now()
        if (now - this.lastDetectionTime < this.detectionInterval) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectDocumentHeuristic(constraints)
            )
            return
        }

        this.lastDetectionTime = now

        try {
            const result = this.estimateDocumentFromEdges(constraints)
            if (result) {
                this.updateDocumentHistory('document', result)
                this.documentDetectionSubject.next(result)
            } else {
                this.documentDetectionSubject.next(null)
            }
        } catch (error) {
            console.error(
                '🎯 ENHANCED-DETECTION: Document detection error:',
                error
            )
            this.detectionErrorSubject.next(
                `Document detection error: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }

        if (this.isDetecting) {
            this.detectionLoop = requestAnimationFrame(() =>
                this.detectDocumentHeuristic(constraints)
            )
        }
    }

    private estimateDocumentFromEdges(
        constraints: DetectionConstraints
    ): DocumentDetectionResult | null {
        if (!this.currentVideo) return null

        const video = this.currentVideo
        const targetWidth = 192
        const scale = targetWidth / (video.videoWidth || 640)
        const targetHeight = Math.max(
            1,
            Math.round((video.videoHeight || 480) * scale)
        )

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return null

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight)
        const { data, width, height } = ctx.getImageData(
            0,
            0,
            targetWidth,
            targetHeight
        )

        // Convert to grayscale and compute simple gradient magnitude |dx|+|dy|
        const edge = new Uint8ClampedArray(width * height)
        const toGray = (i: number) => {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            return (0.299 * r + 0.587 * g + 0.114 * b) | 0
        }

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x
                const i = idx * 4
                const gx = toGray(i + 4) - toGray(i - 4)
                const gy = toGray(i + width * 4) - toGray(i - width * 4)
                const mag = Math.abs(gx) + Math.abs(gy)
                edge[idx] = mag > 60 ? 255 : 0 // threshold tuned for edges
            }
        }

        // Find bounding box of edge pixels
        let minX = width,
            minY = height,
            maxX = -1,
            maxY = -1
        let edgeCount = 0
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const idx = y * width + x
                if (edge[idx] === 255) {
                    edgeCount++
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                }
            }
        }

        if (maxX <= minX || maxY <= minY) {
            return null
        }

        const bboxW = maxX - minX + 1
        const bboxH = maxY - minY + 1
        const areaRatio = (bboxW * bboxH) / (width * height)
        const aspect = bboxW / bboxH

        // Check expected aspect and size
        const aspectOk =
            !constraints.aspectRatioRange ||
            (aspect >= constraints.aspectRatioRange.min &&
                aspect <= constraints.aspectRatioRange.max)

        const sizeOk =
            areaRatio >= constraints.minSize && areaRatio <= constraints.maxSize

        // Estimate rectangularness: proportion of edge pixels near the bbox border
        let borderEdge = 0
        let borderSamples = 0
        const borderThickness = 2
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const onBorder =
                    x - minX < borderThickness ||
                    maxX - x < borderThickness ||
                    y - minY < borderThickness ||
                    maxY - y < borderThickness
                if (onBorder) {
                    borderSamples++
                    const idx = y * width + x
                    if (edge[idx] === 255) borderEdge++
                }
            }
        }
        const rectangularness =
            borderSamples > 0 ? borderEdge / borderSamples : 0

        // Confidence heuristic: combine rectangularness, size, and aspect closeness
        let confidence = rectangularness
        if (aspectOk) confidence = confidence * 0.7 + 0.3
        if (sizeOk) confidence = confidence * 0.7 + 0.3
        confidence = Math.max(0, Math.min(1, confidence))

        if (confidence < (constraints.minConfidence || 0)) {
            return null
        }

        // Map bbox from downscaled canvas to video display coordinates
        const scaleX = (video.clientWidth || video.videoWidth || 1) / width
        const scaleY = (video.clientHeight || video.videoHeight || 1) / height
        const displayBBox = {
            x: minX * scaleX,
            y: minY * scaleY,
            width: bboxW * scaleX,
            height: bboxH * scaleY,
        }

        const result: DocumentDetectionResult = {
            confidence,
            quad: {
                topLeft: { x: displayBBox.x, y: displayBBox.y },
                topRight: {
                    x: displayBBox.x + displayBBox.width,
                    y: displayBBox.y,
                },
                bottomLeft: {
                    x: displayBBox.x,
                    y: displayBBox.y + displayBBox.height,
                },
                bottomRight: {
                    x: displayBBox.x + displayBBox.width,
                    y: displayBBox.y + displayBBox.height,
                },
            },
            boundingBox: displayBBox,
            steady: false,
            quality: rectangularness,
            aspectRatio: aspect,
            message: 'Document-like rectangle detected',
        }

        return result
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

    private computeDocRectChecks(bbox: {
        x: number
        y: number
        width: number
        height: number
    }): { rectangularness: number; variance: number } {
        if (!this.currentVideo) return { rectangularness: 0, variance: 0 }

        const video = this.currentVideo
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return { rectangularness: 0, variance: 0 }

        const sampleW = Math.max(32, Math.round(bbox.width))
        const sampleH = Math.max(24, Math.round(bbox.height))
        canvas.width = sampleW
        canvas.height = sampleH

        // Draw the bbox region into the canvas
        ctx.drawImage(
            video,
            (bbox.x / (video.clientWidth || 1)) * video.videoWidth,
            (bbox.y / (video.clientHeight || 1)) * video.videoHeight,
            (bbox.width / (video.clientWidth || 1)) * video.videoWidth,
            (bbox.height / (video.clientHeight || 1)) * video.videoHeight,
            0,
            0,
            sampleW,
            sampleH
        )

        const { data, width, height } = ctx.getImageData(0, 0, sampleW, sampleH)

        // Edge density near borders vs interior
        let borderEdges = 0
        let borderSamples = 0
        let interiorEdges = 0
        let interiorSamples = 0
        let sum = 0
        let sumSq = 0

        const toGray = (i: number) =>
            0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]

        const thickness = Math.max(
            1,
            Math.round(Math.min(width, height) * 0.06)
        )

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const p = (y * width + x) * 4
                const gx = toGray(p + 4) - toGray(p - 4)
                const gy = toGray(p + width * 4) - toGray(p - width * 4)
                const mag = Math.abs(gx) + Math.abs(gy)

                const onBorder =
                    x < thickness ||
                    y < thickness ||
                    width - 1 - x < thickness ||
                    height - 1 - y < thickness

                if (onBorder) {
                    borderSamples++
                    if (mag > 60) borderEdges++
                } else {
                    interiorSamples++
                    if (mag > 60) interiorEdges++
                }

                const g = toGray(p)
                sum += g
                sumSq += g * g
            }
        }

        const rectangularness = borderSamples ? borderEdges / borderSamples : 0
        const n = width * height
        const mean = n ? sum / n : 0
        const variance = n ? Math.max(0, sumSq / n - mean * mean) : 0

        return { rectangularness, variance }
    }

    private validateDocSteady(
        bbox: { x: number; y: number; width: number; height: number },
        confidence: number,
        constraints: DetectionConstraints
    ): { confidence: number; steady: boolean; quality: number } | null {
        // Track simple steadiness using last few document entries
        const history = this.documentHistory.get('document') || []
        const recent = history.slice(-constraints.steadyFrames)
        let steadyCount = 0
        for (const item of recent) {
            const dx = Math.abs(item.boundingBox.x - bbox.x)
            const dy = Math.abs(item.boundingBox.y - bbox.y)
            const dw = Math.abs(item.boundingBox.width - bbox.width)
            const dh = Math.abs(item.boundingBox.height - bbox.height)
            if (dx < 20 && dy < 20 && dw < 20 && dh < 20) steadyCount++
        }
        const isSteady =
            steadyCount >= Math.max(2, constraints.steadyFrames - 1)
        if (!isSteady) {
            // Require higher confidence if not steady yet
            if (confidence < Math.max(0.9, constraints.minConfidence))
                return null
        }
        return { confidence, steady: isSteady, quality: confidence }
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
            minConfidence: 0.75,
            minSize: 0.1,
            maxSize: 0.6,
            centerThreshold: 0.25,
            steadyFrames: 3,
            aspectRatioRange: { min: 1.3, max: 2.0 },
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

        // Document detection simulated
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
