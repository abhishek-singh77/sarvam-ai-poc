import { Injectable } from '@angular/core'
import { Observable, BehaviorSubject, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'
import {
    DetectionService,
    DetectionResult,
    DocumentDetectionResult,
} from '../detection.service'
import {
    SubmissionService,
    ArtifactPayload,
    ValidationPayload,
} from '../submission.service'

@Injectable({
    providedIn: 'root',
})
export class FrameCaptureHandler implements StepHandler {
    private currentStep: WorkflowStep | null = null
    private detectionResult = new BehaviorSubject<
        DetectionResult | DocumentDetectionResult | null
    >(null)
    private isCapturing = false

    constructor(
        private detectionService: DetectionService,
        private submissionService: SubmissionService
    ) {}

    canHandle(step: WorkflowStep): boolean {
        return step.type === 'FRAME_CAPTURE'
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        this.currentStep = step
        const captureType = step.data?.captureType

        console.log(
            '🎯 FRAME-CAPTURE-HANDLER: Starting frame capture:',
            captureType
        )

        if (captureType === 'FACE_CAPTURE') {
            return this.startFaceCapture(step)
        } else if (captureType === 'DOCUMENT_CAPTURE') {
            return this.startDocumentCapture(step)
        }

        return of({
            success: false,
            error: 'Unknown capture type',
        })
    }

    private startFaceCapture(
        step: WorkflowStep
    ): Observable<StepHandlerResult> {
        return new Observable((observer) => {
            // Start face detection
            this.detectionService
                .startFaceDetection(this.getVideoElement())
                .then(() => {
                    // Subscribe to detection results
                    const subscription =
                        this.detectionService.faceDetection$.subscribe(
                            (result) => {
                                this.detectionResult.next(result)

                                if (
                                    result?.steady &&
                                    result.confidence >= 0.95
                                ) {
                                    // Auto-capture when face is steady and confident
                                    this.performCapture(step, result).then(
                                        (captureResult) => {
                                            observer.next(captureResult)
                                            observer.complete()
                                        }
                                    )
                                }
                            }
                        )

                    // Cleanup subscription when observable completes
                    observer.add(() => subscription.unsubscribe())
                })
                .catch((error) => {
                    observer.next({
                        success: false,
                        error: error.message,
                    })
                    observer.complete()
                })
        })
    }

    private startDocumentCapture(
        step: WorkflowStep
    ): Observable<StepHandlerResult> {
        return new Observable((observer) => {
            const documentType = step.data?.documentType
            const constraints = documentType
                ? this.detectionService.getConstraintsForDocumentType(
                      documentType as 'pan' | 'aadhaar'
                  )
                : this.detectionService.getDefaultDocumentConstraints()

            // Start document detection
            this.detectionService
                .startDocumentDetection(this.getVideoElement())
                .then(() => {
                    // Subscribe to detection results
                    const subscription =
                        this.detectionService.documentDetection$.subscribe(
                            (result) => {
                                this.detectionResult.next(result)

                                if (
                                    result?.steady &&
                                    result.confidence >= 0.8
                                ) {
                                    // Auto-capture when document is steady and confident
                                    this.performCapture(step, result).then(
                                        (captureResult) => {
                                            observer.next(captureResult)
                                            observer.complete()
                                        }
                                    )
                                }
                            }
                        )

                    // Cleanup subscription when observable completes
                    observer.add(() => subscription.unsubscribe())
                })
                .catch((error) => {
                    observer.next({
                        success: false,
                        error: error.message,
                    })
                    observer.complete()
                })
        })
    }

    private async performCapture(
        step: WorkflowStep,
        detectionResult: DetectionResult | DocumentDetectionResult
    ): Promise<StepHandlerResult> {
        if (this.isCapturing) {
            return { success: false, error: 'Capture already in progress' }
        }

        this.isCapturing = true
        console.log(
            '🎯 FRAME-CAPTURE-HANDLER: Performing capture for step:',
            step.id
        )

        try {
            // Capture image from video
            const base64Data = await this.captureImageFromVideo()

            if (!base64Data) {
                return { success: false, error: 'Failed to capture image' }
            }

            // Submit artifact
            const artifactPayload: ArtifactPayload = {
                stepRef: step.id,
                artifactType:
                    step.data?.captureType === 'FACE_CAPTURE'
                        ? 'selfie'
                        : 'document',
                base64Data: base64Data,
                metadata: {
                    captureType: step.data?.captureType,
                    documentType: step.data?.documentType,
                    imageUploadMode: step.data?.imageUploadMode,
                    quality: detectionResult.quality,
                    confidence: detectionResult.confidence,
                },
            }

            const submissionResult =
                await this.submissionService.submitArtifact(artifactPayload)

            if (!submissionResult.success) {
                return { success: false, error: submissionResult.error }
            }

            // Handle validations if required
            if (step.data?.performFaceMatch || step.data?.performDbCheck) {
                const validationResult = await this.performValidations(
                    step,
                    submissionResult.artifactId!
                )
                if (!validationResult.success) {
                    return validationResult
                }
            }

            // Complete the step
            const completeResult = await this.submissionService.completeStep(
                this.getSessionId(),
                step.id,
                {
                    artifactId: submissionResult.artifactId,
                    detectionResult: detectionResult,
                    submissionResult: submissionResult,
                }
            )

            return {
                success: true,
                data: {
                    artifactId: submissionResult.artifactId,
                    detectionResult: detectionResult,
                    submissionResult: submissionResult,
                    completeResult: completeResult,
                },
                shouldProceed: true,
            }
        } catch (error) {
            console.error('🎯 FRAME-CAPTURE-HANDLER: Capture failed:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        } finally {
            this.isCapturing = false
            this.detectionService.stopDetection()
        }
    }

    private async performValidations(
        step: WorkflowStep,
        artifactId: string
    ): Promise<StepHandlerResult> {
        const validations: Promise<any>[] = []

        // Face match validation
        if (step.data?.performFaceMatch && step.data?.faceMatchSources) {
            const faceMatchPayload: ValidationPayload = {
                stepRef: step.id,
                validationType: 'face_match',
                sourceArtifactId: step.data.faceMatchSources[0], // Use first source
                targetArtifactId: artifactId,
            }
            validations.push(
                this.submissionService.submitValidation(faceMatchPayload)
            )
        }

        // Central DB validation
        if (step.data?.performDbCheck) {
            const dbPayload: ValidationPayload = {
                stepRef: step.id,
                validationType: 'central_db',
                sourceArtifactId: artifactId,
            }
            validations.push(this.submissionService.submitValidation(dbPayload))
        }

        try {
            const results = await Promise.all(validations)
            const failedValidations = results.filter(
                (r) => !r.success || !r.validationResult?.passed
            )

            if (failedValidations.length > 0) {
                return {
                    success: false,
                    error: 'Validation failed',
                    data: { validationResults: results },
                }
            }

            return {
                success: true,
                data: { validationResults: results },
            }
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error ? error.message : 'Validation error',
            }
        }
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log('🎯 FRAME-CAPTURE-HANDLER: Completing step:', step.id)
        return of({
            success: true,
            data: data,
            shouldProceed: true,
        })
    }

    retry(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log('🎯 FRAME-CAPTURE-HANDLER: Retrying step:', step.id)

        // Clear previous submission state
        this.submissionService.clearSubmissionState(step.id)

        // Restart the step
        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log('🎯 FRAME-CAPTURE-HANDLER: Cancelling step:', step.id)
        this.detectionService.stopDetection()
        this.isCapturing = false
    }

    getUIState(step: WorkflowStep): any {
        return {
            detectionResult: this.detectionResult.value,
            isCapturing: this.isCapturing,
            canRetry: !this.isCapturing,
            showManualCapture: !this.detectionResult.value?.steady,
        }
    }

    private async captureImageFromVideo(): Promise<string | null> {
        const video = this.getVideoElement()
        if (!video) return null

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')

        if (!ctx) return null

        ctx.drawImage(video, 0, 0)
        return canvas.toDataURL('image/jpeg', 0.8)
    }

    private getVideoElement(): HTMLVideoElement {
        // This should be injected or accessed through a service
        // For now, we'll assume it's available globally
        return document.querySelector('video') as HTMLVideoElement
    }

    private getSessionId(): string {
        // This should come from the session service
        return 'current-session'
    }
}
