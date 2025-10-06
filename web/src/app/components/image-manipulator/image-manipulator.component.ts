import {
    Component,
    Inject,
    OnInit,
    Input,
    Optional,
    OnDestroy,
    Output,
    EventEmitter,
    ChangeDetectorRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import {
    Dimensions,
    ImageCroppedEvent,
    ImageCropperComponent,
    ImageTransform,
} from 'ngx-image-cropper'
import { FormsModule } from '@angular/forms'
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog'
import { CustomSpinnerComponent } from '../custom-spinner/custom-spinner.component'
import { ImageUploadService } from '../../services/image-upload.service'
import { VkycWorkflowFacadeService } from '../../services/vkyc-workflow-facade.service'
import { SessionStorageService } from '../../services/session-storage.service'
import {
    AnalysisDisplayComponent,
    AnalysisData,
} from '../analysis-display/analysis-display.component'

// Define interfaces locally
export interface ImageInfo {
    blob: Blob
    url: string
}

export interface UploadCroppedImageResponse {
    showSyncResponse: boolean
    imageInfo?: ImageInfo | null
    imageUploadActionResponse?: any
}

export interface ImageManipulatorConfig {
    base64: string
    subActionId: string
    mode: 'selfie' | 'document' | 'FRONT_BACK'
    frontImage?: Blob
    maxFileSize?: number
    allowedFormats?: string[]
    aspectRatio?: number
    minCropSize?: { width: number; height: number }
}

export interface ManipulationState {
    rotation: number
    scale: number
    canvasRotation: number
    containWithinAspectRatio: boolean
    transform: ImageTransform
}

// Constants
const DEFAULT_CONFIG: Partial<ImageManipulatorConfig> = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    aspectRatio: 1,
    minCropSize: { width: 100, height: 100 },
}

const ROTATION_STEP = 5
const SCALE_STEP = 0.1
const MIN_SCALE = 0.1
const MAX_SCALE = 3

@Component({
    selector: 'lib-image-manipulator',
    standalone: true,
    imports: [
        CommonModule,
        ImageCropperComponent,
        FormsModule,
        CustomSpinnerComponent,
        AnalysisDisplayComponent,
    ],
    templateUrl: './image-manipulator.component.html',
    styleUrl: './image-manipulator.component.css',
})
export class ImageManipulatorComponent implements OnInit, OnDestroy {
    @Input() config: ImageManipulatorConfig = {
        base64: '',
        subActionId: '',
        mode: 'selfie',
        frontImage: new Blob(),
    }

    @Output() imageProcessed = new EventEmitter<UploadCroppedImageResponse>()
    @Output() error = new EventEmitter<string>()
    @Output() imageRetake = new EventEmitter<void>()
    @Output() imageClosed = new EventEmitter<void>()

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) public dialogData: any,
        @Optional() private dialogRef: MatDialogRef<ImageManipulatorComponent>,
        private cdr: ChangeDetectorRef,
        private imageUploadService: ImageUploadService,
        private workflowFacade: VkycWorkflowFacadeService,
        private sessionStorage: SessionStorageService
    ) {
        // Initialize config from dialog data if available
        if (this.dialogData) {
            this.config = { ...this.config, ...this.dialogData }
        }
    }

    // State management
    private _manipulationState: ManipulationState = {
        rotation: 0,
        scale: 1,
        canvasRotation: 0,
        containWithinAspectRatio: false,
        transform: {},
    }

    // UI State
    croppedImage?: ImageInfo
    showCropper = false
    loading = true
    uploading = false
    uploadError: string | null = null
    uploadSuccess = false
    validationErrors: string[] = []
    uploadResponse: any = null
    showAnalysisResults = false
    analysisData: AnalysisData | null = null

    // Computed properties
    get manipulationState(): ManipulationState {
        return { ...this._manipulationState }
    }

    get isProcessing(): boolean {
        return this.loading || this.uploading
    }

    get canApprove(): boolean {
        return !this.isProcessing && !!this.croppedImage && !this.uploadSuccess
    }

    get canRetake(): boolean {
        return !this.isProcessing && !this.uploadSuccess
    }

    get hasErrors(): boolean {
        return this.validationErrors.length > 0 || !!this.uploadError
    }

    ngOnInit(): void {
        this.validateConfig()
        if (this.hasErrors) {
            this.error.emit(this.validationErrors.join(', '))
            return
        }
        console.log(
            'ImageManipulatorComponent loaded with config:',
            this.config
        )
    }

    ngOnDestroy(): void {
        // Clean up any resources
        if (this.croppedImage?.url) {
            URL.revokeObjectURL(this.croppedImage.url)
        }
    }

    // Validation
    private validateConfig(): void {
        this.validationErrors = []

        if (!this.config.base64) {
            this.validationErrors.push('Base64 image data is required')
        }

        if (!this.config.subActionId) {
            this.validationErrors.push('Sub action ID is required')
        }

        if (!this.config.mode) {
            this.validationErrors.push('Mode is required')
        }

        if (this.config.maxFileSize && this.config.base64) {
            const sizeInBytes = (this.config.base64.length * 3) / 4
            if (sizeInBytes > this.config.maxFileSize) {
                this.validationErrors.push(
                    `File size exceeds ${
                        this.config.maxFileSize / (1024 * 1024)
                    }MB limit`
                )
            }
        }
    }

    // Image cropper events
    imageCropped(event: ImageCroppedEvent): void {
        if (!event.blob || !event.objectUrl) {
            this.handleError('Failed to crop image')
            return
        }

        this.croppedImage = { blob: event.blob, url: event.objectUrl }
        this.uploadError = null
    }

    imageLoaded(): void {
        this.showCropper = true
        this.loading = false
    }

    cropperReady(sourceImageDimensions: Dimensions): void {
        this.loading = false
        console.log('Cropper ready with dimensions:', sourceImageDimensions)
    }

    loadImageFailed(): void {
        this.loading = false
        this.handleError('Failed to load image. Please try again.')
    }

    // Manipulation methods
    rotateLeft(): void {
        this.updateManipulationState({
            canvasRotation: this._manipulationState.canvasRotation - 90,
            transform: this.flipAfterRotate(this._manipulationState.transform),
        })
    }

    rotateRight(): void {
        this.updateManipulationState({
            canvasRotation: this._manipulationState.canvasRotation + 90,
            transform: this.flipAfterRotate(this._manipulationState.transform),
        })
    }

    private flipAfterRotate(transform: ImageTransform): ImageTransform {
        return {
            ...transform,
            flipH: transform.flipV,
            flipV: transform.flipH,
        }
    }

    zoomOut(): void {
        const newScale = Math.max(
            MIN_SCALE,
            this._manipulationState.scale - SCALE_STEP
        )
        this.updateManipulationState({
            scale: newScale,
            transform: {
                ...this._manipulationState.transform,
                scale: newScale,
            },
        })
    }

    zoomIn(): void {
        const newScale = Math.min(
            MAX_SCALE,
            this._manipulationState.scale + SCALE_STEP
        )
        this.updateManipulationState({
            scale: newScale,
            transform: {
                ...this._manipulationState.transform,
                scale: newScale,
            },
        })
    }

    toggleContainWithinAspectRatio(): void {
        this.updateManipulationState({
            containWithinAspectRatio:
                !this._manipulationState.containWithinAspectRatio,
        })
    }

    updateRotation(event: Event): void {
        const target = event.target as HTMLInputElement
        const rotation = parseInt(target.value, 10)

        this.updateManipulationState({
            rotation,
            transform: {
                ...this._manipulationState.transform,
                rotate: rotation,
            },
        })
    }

    // State management
    private updateManipulationState(updates: Partial<ManipulationState>): void {
        this._manipulationState = { ...this._manipulationState, ...updates }
        this.cdr.detectChanges()
    }

    // Error handling
    private handleError(message: string): void {
        this.uploadError = message
        this.error.emit(message)
        console.error('ImageManipulator Error:', message)
    }

    // Upload methods
    private async uploadCroppedImage(
        imageInfo: Readonly<ImageInfo>,
        subActionId: string
    ): Promise<void> {
        console.log('🎯 IMAGE-MANIPULATOR: uploadCroppedImage called', {
            subActionId,
            mode: this.config.mode,
            alreadyUploading: this.uploading,
            alreadyUploaded: this.uploadSuccess,
        })

        if (this.config.mode === 'FRONT_BACK' && !this.config.frontImage) {
            console.log('Mode requires both front and back images')
            this.closeDialog(false, imageInfo)
            return
        }

        // Prevent duplicate uploads
        if (this.uploading || this.uploadSuccess) {
            console.warn(
                '🎯 IMAGE-MANIPULATOR: Upload already in progress or completed, skipping'
            )
            return
        }

        this.uploading = true
        this.uploadError = null
        this.uploadSuccess = false

        try {
            console.log('🎯 IMAGE-MANIPULATOR: Starting image upload...', {
                subActionId,
                mode: this.config.mode,
            })

            // Get room ID from session storage
            const sessionData = this.sessionStorage.getSessionData()
            if (!sessionData?.roomId) {
                throw new Error('No room ID found in session storage')
            }
            const roomId = sessionData.roomId

            // Convert blob to base64
            const base64Image = await this.blobToBase64(imageInfo.blob)

            // Determine capture type based on mode
            const captureType =
                this.config.mode === 'selfie'
                    ? 'FACE_CAPTURE'
                    : 'DOCUMENT_CAPTURE'

            // Upload image using the real API
            const uploadResponse = await this.imageUploadService
                .uploadImage(roomId, {
                    image_data: base64Image,
                    step_id: subActionId,
                    capture_type: captureType,
                    timestamp: new Date().toISOString(),
                })
                .toPromise()

            if (uploadResponse?.status === 'success') {
                this.uploading = false
                this.uploadSuccess = true
                this.uploadResponse = uploadResponse
                this.showAnalysisResults = true

                // Create analysis data for the display component
                this.analysisData = {
                    captureType: uploadResponse.capture_type,
                    analysisResult: uploadResponse.analysis_result,
                    parsedAnalysis: this.parseAnalysisResult(
                        uploadResponse.analysis_result
                    ),
                    recommendations:
                        this.parseAnalysisResult(uploadResponse.analysis_result)
                            ?.recommendations || [],
                }

                console.log(
                    '🎯 IMAGE-MANIPULATOR: Image upload completed successfully',
                    uploadResponse
                )

                // Save analysis data to session storage for accordion display
                this.saveAnalysisData(subActionId, uploadResponse)

                // Complete the workflow step (don't let this fail the upload)
                try {
                    await this.completeWorkflowStep(subActionId, uploadResponse)
                } catch (stepError) {
                    console.warn(
                        '🎯 IMAGE-MANIPULATOR: Step completion failed, but upload was successful:',
                        stepError
                    )
                    // Don't throw here - the image upload was successful
                }

                // Don't close dialog immediately - show analysis results first
                // User will click Continue to close and see results in accordion
            } else {
                throw new Error(uploadResponse?.message || 'Upload failed')
            }
        } catch (error) {
            this.uploading = false
            console.error('🎯 IMAGE-MANIPULATOR: Upload failed:', error)
            this.handleError(
                `Upload failed: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }
    }

    private async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
                const result = reader.result as string
                // Remove data URL prefix if present
                const base64 = result.includes(',')
                    ? result.split(',')[1]
                    : result
                resolve(base64)
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    }

    private saveAnalysisData(stepId: string, uploadResponse: any): void {
        try {
            const analysisData = {
                stepId: stepId,
                timestamp: new Date().toISOString(),
                captureType: uploadResponse.capture_type,
                status: uploadResponse.status,
                message: uploadResponse.message,
                analysisResult: uploadResponse.analysis_result,
                // Parse the analysis JSON if it's a string
                parsedAnalysis: this.parseAnalysisResult(
                    uploadResponse.analysis_result
                ),
            }

            // Save to session storage
            this.sessionStorage.saveStepData({
                stepId: stepId,
                stepType: 'image_capture',
                data: analysisData,
                timestamp: Date.now(),
                success: true,
            })

            console.log(
                '🎯 IMAGE-MANIPULATOR: Analysis data saved:',
                analysisData
            )

            // Verify the data was saved
            const savedData = this.sessionStorage.getStepData(stepId)
            console.log('🎯 IMAGE-MANIPULATOR: Verified saved data:', savedData)

            // Also update the current step with analysis results for the step completion component
            this.updateCurrentStepWithAnalysis(
                stepId,
                uploadResponse.analysis_result
            )
        } catch (error) {
            console.error(
                '🎯 IMAGE-MANIPULATOR: Failed to save analysis data:',
                error
            )
        }
    }

    private updateCurrentStepWithAnalysis(
        stepId: string,
        analysisResult: any
    ): void {
        try {
            // Get the current workflow state
            const currentState = this.workflowFacade.state$.value
            if (
                currentState?.currentStep &&
                currentState.currentStep.id === stepId
            ) {
                // Update the current step with analysis results
                currentState.currentStep.analysisResult = analysisResult
                currentState.currentStep.status = 'completed'

                // Emit the updated state
                this.workflowFacade.state$.next(currentState)

                console.log(
                    '🎯 IMAGE-MANIPULATOR: Updated current step with analysis results'
                )
            }
        } catch (error) {
            console.error(
                '🎯 IMAGE-MANIPULATOR: Failed to update current step with analysis:',
                error
            )
        }
    }

    private parseAnalysisResult(analysisResult: any): any {
        try {
            if (
                analysisResult?.analysis &&
                typeof analysisResult.analysis === 'string'
            ) {
                return JSON.parse(analysisResult.analysis)
            }
            return analysisResult
        } catch (error) {
            console.error(
                '🎯 IMAGE-MANIPULATOR: Failed to parse analysis result:',
                error
            )
            return analysisResult
        }
    }

    private async completeWorkflowStep(
        stepId: string,
        uploadResponse: any
    ): Promise<void> {
        try {
            console.log(
                '🎯 IMAGE-MANIPULATOR: Completing workflow step:',
                stepId
            )

            // Only complete the step if it hasn't been completed already
            if (!this.uploadSuccess) {
                console.warn(
                    '🎯 IMAGE-MANIPULATOR: Upload not successful, skipping step completion'
                )
                return
            }

            await this.workflowFacade.completeCurrentStep()
            console.log(
                '🎯 IMAGE-MANIPULATOR: Workflow step completed successfully'
            )
        } catch (error) {
            console.warn(
                '🎯 IMAGE-MANIPULATOR: Step completion failed (non-critical):',
                error
            )
            // Don't throw here - the image upload was successful, just step completion failed
            // This is not a critical error that should show to the user
        }
    }

    approveImage({ blob, url }: Readonly<ImageInfo>): void {
        if (!this.canApprove) {
            this.handleError('Cannot approve image at this time')
            return
        }

        // Prevent duplicate uploads
        if (this.uploading || this.uploadSuccess) {
            console.warn(
                '🎯 IMAGE-MANIPULATOR: Upload already in progress or completed'
            )
            return
        }

        this.uploadCroppedImage({ blob, url }, this.config.subActionId)
    }

    retakePhoto(): void {
        if (!this.canRetake) {
            return
        }
        this.imageRetake.emit()
        this.closeDialog(false)
    }

    async continueAfterAnalysis(): Promise<void> {
        console.log('🎯 IMAGE-MANIPULATOR: Continuing after analysis review')

        // Prevent multiple calls
        if (this.uploading) {
            console.warn(
                '🎯 IMAGE-MANIPULATOR: Upload still in progress, cannot continue'
            )
            return
        }

        // Just close the dialog without triggering any additional API calls
        // The upload and step completion were already handled during the initial upload
        this.closeDialog(false)
    }

    getAnalysisSummary(): string {
        if (!this.uploadResponse?.analysis_result) {
            return 'Analysis completed successfully'
        }

        const analysis = this.parseAnalysisResult(
            this.uploadResponse.analysis_result
        )
        const captureType = this.uploadResponse.capture_type

        if (captureType === 'FACE_CAPTURE') {
            return `Face detected: ${
                analysis.face_detected ? 'Yes' : 'No'
            } | Quality: ${analysis.image_quality || 'Unknown'} | Confidence: ${
                (analysis.confidence_score * 100)?.toFixed(1) || 'Unknown'
            }%`
        } else if (captureType === 'DOCUMENT_CAPTURE') {
            return `Document detected: ${
                analysis.document_detected ? 'Yes' : 'No'
            } | Quality: ${
                (analysis.quality_score * 100)?.toFixed(1) || 'Unknown'
            }% | OCR: ${(analysis.confidence * 100)?.toFixed(1) || 'Unknown'}%`
        }

        return 'Analysis completed successfully'
    }

    getRecommendations(): string[] {
        if (!this.uploadResponse?.analysis_result) {
            return []
        }

        const analysis = this.parseAnalysisResult(
            this.uploadResponse.analysis_result
        )
        return analysis.recommendations || []
    }

    onAnalysisRetake(): void {
        console.log(
            '🎯 IMAGE-MANIPULATOR: Retake requested from analysis display'
        )
        this.retakePhoto()
    }

    async onAnalysisContinue(): Promise<void> {
        console.log(
            '🎯 IMAGE-MANIPULATOR: Continue requested from analysis display'
        )
        await this.continueAfterAnalysis()
    }

    closeDialog(
        showSyncResponse: boolean = false,
        imageInfo?: ImageInfo | null,
        imageUploadActionResponse?: any
    ): void {
        console.log('🎯 IMAGE-MANIPULATOR: Closing dialog with params:', {
            showSyncResponse,
            hasImageInfo: !!imageInfo,
            hasUploadResponse: !!imageUploadActionResponse,
        })

        const data: UploadCroppedImageResponse = {
            showSyncResponse,
            imageInfo,
            imageUploadActionResponse,
        }

        // Emit event for parent components
        this.imageProcessed.emit(data)

        // Emit close event for auto-restart
        this.imageClosed.emit()

        if (this.dialogRef) {
            this.dialogRef.close(data)
        } else {
            // If not used as dialog, emit a custom event
            window.dispatchEvent(
                new CustomEvent('imageManipulatorClose', { detail: data })
            )
        }
    }

    // Utility methods
    resetManipulation(): void {
        this.updateManipulationState({
            rotation: 0,
            scale: 1,
            canvasRotation: 0,
            containWithinAspectRatio: false,
            transform: {},
        })
        this.croppedImage = undefined
        this.uploadError = null
        this.uploadSuccess = false
    }

    // Keyboard navigation
    onKeyDown(event: KeyboardEvent): void {
        switch (event.key) {
            case 'Escape':
                this.closeDialog(false)
                break
            case 'Enter':
                if (this.canApprove) {
                    this.approveImage(this.croppedImage!)
                }
                break
            case 'r':
            case 'R':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault()
                    this.resetManipulation()
                }
                break
        }
    }
}
