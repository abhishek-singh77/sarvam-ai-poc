import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import {
    EnhancedDetectionService,
    DetectionResult,
    DocumentDetectionResult,
    MultipleFaceDetectionResult,
} from './enhanced-detection.service'

@Injectable({ providedIn: 'root' })
export class VkycCaptureFacadeService {
    faceDetection$ = new BehaviorSubject<DetectionResult | null>(null)
    multipleFaceDetection$ =
        new BehaviorSubject<MultipleFaceDetectionResult | null>(null)
    documentDetection$ = new BehaviorSubject<DocumentDetectionResult | null>(
        null
    )
    detectionError$ = new BehaviorSubject<string | null>(null)
    detectionStatus$ = new BehaviorSubject<
        'idle' | 'initializing' | 'detecting' | 'error'
    >('idle')
    isAutoCaptureEnabled$ = new BehaviorSubject<boolean>(true)
    isCapturing$ = new BehaviorSubject<boolean>(false)

    constructor(private detectionService: EnhancedDetectionService) {
        // Subscribe to detection service results and forward them
        this.detectionService.faceDetection$.subscribe((result) => {
            console.log(
                '🎯 CAPTURE-FACADE: Forwarding face detection result:',
                result
            )
            this.faceDetection$.next(result)
        })

        this.detectionService.multipleFaceDetection$.subscribe((result) => {
            console.log(
                '🎯 CAPTURE-FACADE: Forwarding multiple face detection result:',
                result
            )
            this.multipleFaceDetection$.next(result)
        })

        this.detectionService.documentDetection$.subscribe((result) => {
            console.log(
                '🎯 CAPTURE-FACADE: Forwarding document detection result:',
                result
            )
            this.documentDetection$.next(result)
        })

        this.detectionService.detectionError$.subscribe((error) => {
            console.log('🎯 CAPTURE-FACADE: Detection error:', error)
            this.detectionError$.next(error)
        })

        this.detectionService.detectionStatus$.subscribe((status) => {
            console.log('🎯 CAPTURE-FACADE: Detection status:', status)
            this.detectionStatus$.next(status)
        })
    }

    startFaceDetection(video: HTMLVideoElement): void {
        this.detectionService.startFaceDetection(video)
    }

    startDocumentDetection(video: HTMLVideoElement): void {
        this.detectionService.startDocumentDetection(video)
    }

    stopDetection(): void {
        this.detectionService.stopDetection()
        this.faceDetection$.next(null)
        this.documentDetection$.next(null)
    }

    toggleAutoCapture(): void {
        const current = this.isAutoCaptureEnabled$.value
        this.isAutoCaptureEnabled$.next(!current)
    }

    setCapturing(capturing: boolean): void {
        this.isCapturing$.next(capturing)
    }
}
