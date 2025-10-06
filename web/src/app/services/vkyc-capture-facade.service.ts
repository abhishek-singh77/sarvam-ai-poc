import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import {
    EnhancedDetectionService,
    DetectionResult,
    MultipleFaceDetectionResult,
} from './enhanced-detection.service'

@Injectable({ providedIn: 'root' })
export class VkycCaptureFacadeService {
    faceDetection$ = new BehaviorSubject<DetectionResult | null>(null)
    multipleFaceDetection$ =
        new BehaviorSubject<MultipleFaceDetectionResult | null>(null)
    detectionError$ = new BehaviorSubject<string | null>(null)
    detectionStatus$ = new BehaviorSubject<
        'idle' | 'initializing' | 'detecting' | 'error'
    >('idle')
    isAutoCaptureEnabled$ = new BehaviorSubject<boolean>(true)
    isCapturing$ = new BehaviorSubject<boolean>(false)

    constructor(private detectionService: EnhancedDetectionService) {
        // Subscribe to detection service results and forward them
        this.detectionService.faceDetection$.subscribe((result) => {
            this.faceDetection$.next(result)
        })

        this.detectionService.multipleFaceDetection$.subscribe((result) => {
            this.multipleFaceDetection$.next(result)
        })

        this.detectionService.detectionError$.subscribe((error) => {
            this.detectionError$.next(error)
        })

        this.detectionService.detectionStatus$.subscribe((status) => {
            this.detectionStatus$.next(status)
        })
    }

    async startFaceDetection(video: HTMLVideoElement): Promise<void> {
        try {
            await this.detectionService.startFaceDetection(video)
            console.log(
                '🎯 CAPTURE-FACADE: Face detection started successfully'
            )
        } catch (error) {
            console.error(
                '🎯 CAPTURE-FACADE: Failed to start face detection:',
                error
            )
            this.detectionError$.next(
                `Failed to start face detection: ${error}`
            )
        }
    }

    stopDetection(): void {
        this.detectionService.stopDetection()
        this.faceDetection$.next(null)
        this.multipleFaceDetection$.next(null)
    }

    toggleAutoCapture(): void {
        const current = this.isAutoCaptureEnabled$.value
        this.isAutoCaptureEnabled$.next(!current)
    }

    setAutoCaptureEnabled(enabled: boolean): void {
        this.isAutoCaptureEnabled$.next(enabled)
    }

    setCapturing(capturing: boolean): void {
        this.isCapturing$.next(capturing)
    }
}
