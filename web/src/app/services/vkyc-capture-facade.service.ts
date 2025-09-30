import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { DetectionService, DetectionResult, DocumentDetectionResult } from './detection.service'

@Injectable({ providedIn: 'root' })
export class VkycCaptureFacadeService {
    faceDetection$ = new BehaviorSubject<DetectionResult | null>(null)
    documentDetection$ = new BehaviorSubject<DocumentDetectionResult | null>(null)
    isAutoCaptureEnabled$ = new BehaviorSubject<boolean>(true)
    isCapturing$ = new BehaviorSubject<boolean>(false)

    constructor(private detectionService: DetectionService) {}

    startFaceDetection(video: HTMLVideoElement): void {
        this.detectionService.startFaceDetection(video)
        this.detectionService.faceDetection$.subscribe(result => {
            this.faceDetection$.next(result)
        })
    }

    startDocumentDetection(video: HTMLVideoElement): void {
        this.detectionService.startDocumentDetection(video)
        this.detectionService.documentDetection$.subscribe(result => {
            this.documentDetection$.next(result)
        })
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
