import {
    Component,
    Input,
    Output,
    EventEmitter,
    ViewChild,
    ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { HttpClient } from '@angular/common/http'

interface WorkflowStep {
    id: string
    type: string
    title: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    data: any
    instructions?: string
    questions?: any[]
    document_types?: string[]
}

@Component({
    selector: 'app-step-actions',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div
            class="step-actions-container"
            *ngIf="step && step.status === 'in_progress'">
            <!-- Selfie Capture Step -->
            <div *ngIf="step.type === 'selfie_capture'" class="selfie-capture">
                <h4 class="text-lg font-semibold mb-4">{{ step.title }}</h4>
                <p class="text-gray-600 mb-4">{{ step.description }}</p>

                <div class="camera-container">
                    <video
                        #videoElement
                        class="camera-preview"
                        autoplay
                        playsinline
                        muted></video>
                    <canvas #canvasElement class="hidden"></canvas>
                </div>

                <div class="capture-controls">
                    <button
                        class="capture-btn"
                        (click)="captureSelfie()"
                        [disabled]="!isCameraReady">
                        <svg
                            class="w-6 h-6 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        Capture Selfie
                    </button>

                    <button
                        class="retry-btn"
                        (click)="retryCapture()"
                        *ngIf="capturedImage">
                        Retry
                    </button>
                </div>

                <div *ngIf="capturedImage" class="captured-image">
                    <h5 class="text-md font-medium mb-2">Captured Image:</h5>
                    <img
                        [src]="capturedImage"
                        alt="Captured Selfie"
                        class="preview-image" />
                    <button class="submit-btn" (click)="submitSelfie()">
                        Submit Selfie
                    </button>
                </div>
            </div>

            <!-- Questionnaire Step -->
            <div *ngIf="step.type === 'questionnaire'" class="questionnaire">
                <h4 class="text-lg font-semibold mb-4">{{ step.title }}</h4>
                <p class="text-gray-600 mb-4">{{ step.description }}</p>

                <form
                    (ngSubmit)="submitQuestionnaire()"
                    #questionnaireForm="ngForm">
                    <div
                        *ngFor="let question of step.questions"
                        class="question-item">
                        <label class="question-label">{{
                            question.question
                        }}</label>

                        <input
                            *ngIf="question.type === 'text'"
                            type="text"
                            [(ngModel)]="questionnaireAnswers[question.id]"
                            [name]="question.id"
                            class="question-input"
                            [required]="question.required"
                            placeholder="Enter your answer" />

                        <input
                            *ngIf="question.type === 'number'"
                            type="number"
                            [(ngModel)]="questionnaireAnswers[question.id]"
                            [name]="question.id"
                            class="question-input"
                            [required]="question.required"
                            placeholder="Enter your answer" />

                        <input
                            *ngIf="question.type === 'date'"
                            type="date"
                            [(ngModel)]="questionnaireAnswers[question.id]"
                            [name]="question.id"
                            class="question-input"
                            [required]="question.required" />
                    </div>

                    <button
                        type="submit"
                        class="submit-btn"
                        [disabled]="!questionnaireForm.form.valid">
                        Submit Answers
                    </button>
                </form>
            </div>

            <!-- Room ID Input Step -->
            <div *ngIf="step.type === 'room_id_input'" class="room-id-input">
                <h4 class="text-lg font-semibold mb-4">{{ step.title }}</h4>
                <p class="text-gray-600 mb-4">{{ step.description }}</p>

                <div class="input-section">
                    <div class="mb-4">
                        <label
                            for="roomIdInput"
                            class="block text-sm font-medium text-gray-700 mb-2">
                            Room ID
                        </label>
                        <input
                            type="text"
                            id="roomIdInput"
                            [(ngModel)]="inputRoomId"
                            placeholder="Enter the Room ID"
                            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>

                    <button
                        class="submit-btn"
                        (click)="submitRoomId()"
                        [disabled]="!inputRoomId.trim()">
                        Submit Room ID
                    </button>
                </div>
            </div>

            <!-- Document Upload Step -->
            <div *ngIf="step.type === 'id_upload'" class="document-upload">
                <h4 class="text-lg font-semibold mb-4">{{ step.title }}</h4>
                <p class="text-gray-600 mb-4">{{ step.description }}</p>

                <div
                    class="upload-area"
                    (dragover)="onDragOver($event)"
                    (dragleave)="onDragLeave($event)"
                    (drop)="onDrop($event)"
                    [class.drag-over]="isDragOver">
                    <input
                        #fileInput
                        type="file"
                        accept="image/*"
                        (change)="onFileSelected($event)"
                        class="hidden" />

                    <div class="upload-content">
                        <svg
                            class="w-12 h-12 text-gray-400 mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>

                        <p class="text-lg font-medium text-gray-700 mb-2">
                            Drop your ID document here or click to browse
                        </p>
                        <p class="text-sm text-gray-500 mb-4">
                            Supported formats: JPG, PNG, PDF
                        </p>

                        <button
                            type="button"
                            class="browse-btn"
                            (click)="fileInput.click()">
                            Browse Files
                        </button>
                    </div>
                </div>

                <div *ngIf="selectedFile" class="selected-file">
                    <div class="file-info">
                        <div class="file-name">{{ selectedFile.name }}</div>
                        <div class="file-size">
                            {{ formatFileSize(selectedFile.size) }}
                        </div>
                    </div>

                    <div class="file-preview" *ngIf="isImageFile(selectedFile)">
                        <img
                            [src]="filePreview"
                            alt="Document Preview"
                            class="preview-image" />
                    </div>

                    <div class="file-actions">
                        <button
                            class="submit-btn"
                            (click)="uploadDocument()"
                            [disabled]="isUploading">
                            <span
                                *ngIf="isUploading"
                                class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                            {{
                                isUploading ? 'Uploading...' : 'Upload Document'
                            }}
                        </button>

                        <button
                            class="cancel-btn"
                            (click)="clearFile()"
                            [disabled]="isUploading">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .step-actions-container {
                @apply bg-white rounded-lg shadow-md p-6;
            }

            .camera-container {
                @apply relative mb-4;
            }

            .camera-preview {
                @apply w-full max-w-md h-64 bg-gray-200 rounded-lg object-cover;
            }

            .capture-controls {
                @apply flex gap-3 mb-4;
            }

            .capture-btn,
            .retry-btn,
            .submit-btn,
            .browse-btn {
                @apply px-4 py-2 rounded-lg font-medium transition-colors;
            }

            .capture-btn {
                @apply bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center;
            }

            .retry-btn {
                @apply bg-gray-600 text-white hover:bg-gray-700;
            }

            .submit-btn {
                @apply bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center;
            }

            .browse-btn {
                @apply bg-blue-600 text-white hover:bg-blue-700;
            }

            .cancel-btn {
                @apply bg-red-600 text-white hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors;
            }

            .captured-image {
                @apply mt-4 p-4 bg-gray-50 rounded-lg;
            }

            .preview-image {
                @apply w-full max-w-xs h-auto rounded-lg border border-gray-300 mb-3;
            }

            .question-item {
                @apply mb-4;
            }

            .question-label {
                @apply block text-sm font-medium text-gray-700 mb-2;
            }

            .question-input {
                @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent;
            }

            .upload-area {
                @apply border-2 border-dashed border-gray-300 rounded-lg p-8 text-center transition-colors;
            }

            .upload-area.drag-over {
                @apply border-blue-500 bg-blue-50;
            }

            .upload-content {
                @apply space-y-2;
            }

            .selected-file {
                @apply mt-4 p-4 bg-gray-50 rounded-lg;
            }

            .file-info {
                @apply mb-3;
            }

            .file-name {
                @apply font-medium text-gray-800;
            }

            .file-size {
                @apply text-sm text-gray-600;
            }

            .file-preview {
                @apply mb-3;
            }

            .file-actions {
                @apply flex gap-3;
            }

            .animate-spin {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `,
    ],
})
export class StepActionsComponent {
    @Input() step: WorkflowStep | null = null
    @Input() roomId: string = ''
    @Output() stepCompleted = new EventEmitter<{ stepId: string; data: any }>()

    @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>
    @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>

    // Selfie capture
    isCameraReady: boolean = false
    capturedImage: string | null = null
    private stream: MediaStream | null = null

    // Questionnaire
    questionnaireAnswers: { [key: string]: any } = {}

    // Document upload
    selectedFile: File | null = null
    filePreview: string | null = null
    isUploading: boolean = false
    isDragOver: boolean = false

    // Room ID input
    showRoomIdInput: boolean = false
    inputRoomId: string = ''

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        if (this.step?.type === 'selfie_capture') {
            this.initializeCamera()
        }
    }

    ngOnDestroy(): void {
        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop())
        }
    }

    // Selfie Capture Methods
    private async initializeCamera(): Promise<void> {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            })

            if (this.videoElement) {
                this.videoElement.nativeElement.srcObject = this.stream
                this.isCameraReady = true
            }
        } catch (error) {
            console.error('Error accessing camera:', error)
        }
    }

    captureSelfie(): void {
        if (!this.videoElement || !this.canvasElement) return

        const video = this.videoElement.nativeElement
        const canvas = this.canvasElement.nativeElement
        const context = canvas.getContext('2d')

        if (!context) return

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        context.drawImage(video, 0, 0)
        this.capturedImage = canvas.toDataURL('image/jpeg', 0.8)
    }

    retryCapture(): void {
        this.capturedImage = null
    }

    submitSelfie(): void {
        if (this.capturedImage && this.step) {
            const data = {
                image_url: this.capturedImage,
                timestamp: new Date().toISOString(),
            }
            this.stepCompleted.emit({ stepId: this.step.id, data })
        }
    }

    // Questionnaire Methods
    submitQuestionnaire(): void {
        if (this.step) {
            const answers = Object.keys(this.questionnaireAnswers).map(
                (key) => ({
                    question_id: key,
                    question:
                        this.step?.questions?.find((q) => q.id === key)
                            ?.question || '',
                    answer: this.questionnaireAnswers[key],
                })
            )

            const data = {
                answers: answers,
                timestamp: new Date().toISOString(),
            }
            this.stepCompleted.emit({ stepId: this.step.id, data })
        }
    }

    // Document Upload Methods
    onDragOver(event: DragEvent): void {
        event.preventDefault()
        this.isDragOver = true
    }

    onDragLeave(event: DragEvent): void {
        event.preventDefault()
        this.isDragOver = false
    }

    onDrop(event: DragEvent): void {
        event.preventDefault()
        this.isDragOver = false

        const files = event.dataTransfer?.files
        if (files && files.length > 0) {
            this.handleFile(files[0])
        }
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement
        if (input.files && input.files.length > 0) {
            this.handleFile(input.files[0])
        }
    }

    private handleFile(file: File): void {
        this.selectedFile = file

        if (this.isImageFile(file)) {
            const reader = new FileReader()
            reader.onload = (e) => {
                this.filePreview = e.target?.result as string
            }
            reader.readAsDataURL(file)
        }
    }

    isImageFile(file: File): boolean {
        return file.type.startsWith('image/')
    }

    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    uploadDocument(): void {
        if (!this.selectedFile || !this.step) return

        this.isUploading = true

        // Simulate upload process
        setTimeout(() => {
            const data = {
                document_type: this.step?.document_types?.[0] || 'ID Document',
                document_url: this.filePreview,
                file_name: this.selectedFile?.name,
                file_size: this.selectedFile?.size,
                timestamp: new Date().toISOString(),
            }

            this.stepCompleted.emit({ stepId: this.step?.id || '', data })
            this.isUploading = false
        }, 2000)
    }

    clearFile(): void {
        this.selectedFile = null
        this.filePreview = null
    }

    // Room ID input methods
    toggleRoomIdInput(): void {
        this.showRoomIdInput = !this.showRoomIdInput
        if (!this.showRoomIdInput) {
            this.inputRoomId = ''
        }
    }

    submitRoomId(): void {
        if (this.inputRoomId.trim() && this.step) {
            const data = {
                room_id: this.inputRoomId.trim(),
                timestamp: new Date().toISOString(),
            }
            this.stepCompleted.emit({ stepId: this.step.id, data })
        }
    }
}
