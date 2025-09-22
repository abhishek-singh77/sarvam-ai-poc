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

    constructor(
        private cdr: ChangeDetectorRef,
        @Optional() private dialogRef: MatDialogRef<ImageManipulatorComponent>,
        @Optional() @Inject(MAT_DIALOG_DATA) dialogData?: ImageManipulatorConfig
    ) {
        // Merge with default config
        this.config = { ...DEFAULT_CONFIG, ...this.config, ...dialogData }
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
        if (this.config.mode === 'FRONT_BACK' && !this.config.frontImage) {
            console.log('Mode requires both front and back images')
            this.closeDialog(false, imageInfo)
            return
        }

        this.uploading = true
        this.uploadError = null
        this.uploadSuccess = false

        try {
            console.log('Uploading image...', {
                subActionId,
                mode: this.config.mode,
            })

            // Simulate upload process - replace with actual API call
            await this.simulateUpload(imageInfo, subActionId)

            this.uploading = false
            this.uploadSuccess = true
            console.log('Image upload completed successfully')

            this.closeDialog(true, imageInfo)
        } catch (error) {
            this.uploading = false
            this.handleError(
                `Upload failed: ${
                    error instanceof Error ? error.message : 'Unknown error'
                }`
            )
        }
    }

    private simulateUpload(
        imageInfo: ImageInfo,
        subActionId: string
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate random success/failure for demo
                if (Math.random() > 0.1) {
                    // 90% success rate
                    resolve()
                } else {
                    reject(new Error('Simulated upload failure'))
                }
            }, 2000)
        })
    }

    approveImage({ blob, url }: Readonly<ImageInfo>): void {
        if (!this.canApprove) {
            this.handleError('Cannot approve image at this time')
            return
        }
        this.uploadCroppedImage({ blob, url }, this.config.subActionId)
    }

    retakePhoto(): void {
        if (!this.canRetake) {
            return
        }
        this.closeDialog(false)
    }

    closeDialog(
        showSyncResponse: boolean = false,
        imageInfo?: ImageInfo | null,
        imageUploadActionResponse?: any
    ): void {
        console.log('Closing image manipulator dialog')

        const data: UploadCroppedImageResponse = {
            showSyncResponse,
            imageInfo,
            imageUploadActionResponse,
        }

        // Emit event for parent components
        this.imageProcessed.emit(data)

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
