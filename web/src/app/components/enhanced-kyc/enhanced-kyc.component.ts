import {
    Component,
    OnInit,
    OnDestroy,
    ViewChild,
    ElementRef,
    ChangeDetectorRef,
    Output,
    EventEmitter,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subscription, interval } from 'rxjs'
import { take } from 'rxjs/operators'

import {
    EnhancedKYCService,
    KYCSessionRequest,
    WorkflowStep,
    SessionStatus,
    TaskStatus,
} from '../../services/enhanced-kyc.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { MediaService } from '../../services/media.service'
import { NotificationService } from '../../services/notification.service'
import { RoomCreateResponse } from '../../interfaces/room.interface'

@Component({
    selector: 'app-enhanced-kyc',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './enhanced-kyc.component.html',
    styleUrls: ['./enhanced-kyc.component.css'],
})
export class EnhancedKYCComponent implements OnInit, OnDestroy {
    @ViewChild('userVideoRef') userVideoRef!: ElementRef<HTMLVideoElement>
    @ViewChild('agentVideoRef') agentVideoRef!: ElementRef<HTMLVideoElement>
    @Output() sessionCompleted = new EventEmitter<any>()
    @Output() sessionError = new EventEmitter<any>()

    // Session state
    roomData: RoomCreateResponse | null = null
    kycSession: any = null
    sessionStatus: SessionStatus | null = null
    currentStep: WorkflowStep | null = null
    workflowSteps: WorkflowStep[] = []

    // UI state
    isLoading = false
    isProcessing = false
    progress = 0
    statusMessage = 'Ready to start KYC verification'

    // Media state
    hasMedia = false
    isCameraEnabled = false
    isMicrophoneEnabled = false

    // Task monitoring
    activeTasks: string[] = []
    taskStatuses = new Map<string, TaskStatus>()

    // Form data
    questionnaireAnswers: { [key: string]: any } = {}
    capturedSelfie: string | null = null
    uploadedDocument: File | null = null

    // Subscriptions
    private subscriptions = new Subscription()
    private statusCheckInterval: any = null

    constructor(
        private enhancedKYCService: EnhancedKYCService,
        private roomService: EnterpriseRoomService,
        private mediaService: MediaService,
        private notificationService: NotificationService,
        private cdRef: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        this.initializeComponent()
    }

    ngOnDestroy(): void {
        this.cleanup()
    }

    private initializeComponent(): void {
        // Subscribe to session updates
        this.subscriptions.add(
            this.enhancedKYCService.currentSession$.subscribe((session) => {
                if (session) {
                    this.kycSession = session
                    this.workflowSteps = session.workflow_steps
                    this.activateNextStep()
                }
            })
        )

        // Subscribe to session status updates
        this.subscriptions.add(
            this.enhancedKYCService.sessionStatus$.subscribe((status) => {
                if (status) {
                    this.sessionStatus = status
                    this.progress = this.enhancedKYCService.calculateProgress()
                    this.updateStatusMessage()
                }
            })
        )

        // Subscribe to active tasks
        this.subscriptions.add(
            this.enhancedKYCService.activeTasks$.subscribe((tasks) => {
                this.activeTasks = tasks
                this.isProcessing = tasks.length > 0
            })
        )

        // Subscribe to task statuses
        this.subscriptions.add(
            this.enhancedKYCService.taskStatuses$.subscribe((statuses) => {
                this.taskStatuses = statuses
            })
        )
    }

    async startKYCSession(): Promise<void> {
        try {
            this.isLoading = true
            this.statusMessage = 'Initializing KYC session...'

            // Create room first
            this.roomData = await this.roomService.createRoom()
            if (!this.roomData) {
                throw new Error('Failed to create room')
            }

            // Start enhanced KYC session
            const sessionRequest: KYCSessionRequest = {
                room_id: this.roomData.roomId,
                owner_id: 'system',
                sub_user_id: 'user',
                customer_identifier: `customer_${Date.now()}`,
                customer_name: 'Customer',
                workflow_type: 'complete_kyc',
            }

            await this.enhancedKYCService
                .startKYCSession(sessionRequest)
                .pipe(take(1))
                .toPromise()

            // Start status monitoring
            this.startStatusMonitoring()

            this.showSuccess(
                'KYC Session Started',
                'Enhanced KYC session initialized successfully!'
            )
            this.statusMessage = 'KYC session active - AI agent ready to assist'
        } catch (error) {
            console.error('❌ Failed to start KYC session:', error)
            this.showError(
                'Session Start Failed',
                'Failed to initialize KYC session. Please try again.'
            )
            this.sessionError.emit(error)
        } finally {
            this.isLoading = false
        }
    }

    private startStatusMonitoring(): void {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval)
        }

        this.statusCheckInterval = setInterval(() => {
            if (this.kycSession?.session_id) {
                this.enhancedKYCService
                    .getSessionStatus(this.kycSession.session_id)
                    .pipe(take(1))
                    .subscribe()
            }
        }, 5000) // Check every 5 seconds
    }

    private activateNextStep(): void {
        const nextStep = this.workflowSteps.find(
            (step) => step.status === 'pending'
        )
        if (nextStep) {
            this.currentStep = nextStep
            nextStep.status = 'active'
            this.updateStatusMessage()
            this.cdRef.detectChanges()
        }
    }

    private updateStatusMessage(): void {
        if (this.currentStep) {
            this.statusMessage = `Current step: ${this.currentStep.title}`
        } else if (this.sessionStatus) {
            const { completed_steps, total_steps } =
                this.sessionStatus.workflow_progress
            if (completed_steps === total_steps) {
                this.statusMessage = 'KYC verification completed successfully!'
            } else {
                this.statusMessage = `Progress: ${completed_steps}/${total_steps} steps completed`
            }
        }
    }

    // Step-specific handlers
    async handleSelfieCapture(): Promise<void> {
        if (!this.currentStep || this.currentStep.type !== 'selfie_capture')
            return

        try {
            this.isProcessing = true
            this.statusMessage =
                'Capturing selfie and performing liveness detection...'

            // Capture selfie from video
            const selfieBlob = await this.captureSelfieFromVideo()
            if (!selfieBlob) {
                throw new Error('Failed to capture selfie')
            }

            // Convert to File for API
            const selfieFile = new File([selfieBlob], 'selfie.jpg', {
                type: 'image/jpeg',
            })

            // Perform enhanced liveness detection
            const result = await this.enhancedKYCService
                .enhancedLivenessDetection(
                    this.kycSession.session_id,
                    selfieFile,
                    0.8,
                    true
                )
                .pipe(take(1))
                .toPromise()

            if (result.status === 'success') {
                this.capturedSelfie = URL.createObjectURL(selfieBlob)
                this.completeCurrentStep({
                    selfie: this.capturedSelfie,
                    liveness_result: result.liveness_result,
                    timestamp: new Date().toISOString(),
                })

                this.showSuccess(
                    'Selfie Captured',
                    `Liveness detection passed with score: ${(
                        result.liveness_result.liveness_score * 100
                    ).toFixed(1)}%`
                )
            } else {
                throw new Error(result.error || 'Liveness detection failed')
            }
        } catch (error) {
            console.error('❌ Selfie capture failed:', error)
            this.showError(
                'Selfie Capture Failed',
                'Failed to capture selfie or perform liveness detection. Please try again.'
            )
        } finally {
            this.isProcessing = false
        }
    }

    async handleDocumentUpload(event: Event): Promise<void> {
        if (!this.currentStep || this.currentStep.type !== 'document_upload')
            return

        const input = event.target as HTMLInputElement
        if (!input.files || input.files.length === 0) return

        try {
            this.isProcessing = true
            this.statusMessage =
                'Uploading document and performing verification...'

            const documentFile = input.files[0]
            this.uploadedDocument = documentFile

            // Perform enhanced document verification
            const result = await this.enhancedKYCService
                .enhancedDocumentVerification(
                    this.kycSession.session_id,
                    documentFile,
                    0.8
                )
                .pipe(take(1))
                .toPromise()

            if (result.status === 'success') {
                this.completeCurrentStep({
                    document: documentFile.name,
                    document_verification_result:
                        result.document_verification_result,
                    timestamp: new Date().toISOString(),
                })

                this.showSuccess(
                    'Document Verified',
                    'Document uploaded and verified successfully'
                )
            } else {
                throw new Error(result.error || 'Document verification failed')
            }
        } catch (error) {
            console.error('❌ Document upload failed:', error)
            this.showError(
                'Document Upload Failed',
                'Failed to upload or verify document. Please try again.'
            )
        } finally {
            this.isProcessing = false
        }
    }

    async handleQuestionnaireSubmit(): Promise<void> {
        if (!this.currentStep || this.currentStep.type !== 'questionnaire')
            return

        try {
            this.isProcessing = true
            this.statusMessage = 'Processing questionnaire responses...'

            // Validate required questions
            const requiredQuestions =
                this.currentStep.questions?.filter((q) => q.required) || []
            const missingAnswers = requiredQuestions.filter(
                (q) => !this.questionnaireAnswers[q.id]
            )

            if (missingAnswers.length > 0) {
                throw new Error(
                    `Please answer all required questions: ${missingAnswers
                        .map((q) => q.question)
                        .join(', ')}`
                )
            }

            this.completeCurrentStep({
                questionnaire_answers: this.questionnaireAnswers,
                timestamp: new Date().toISOString(),
            })

            this.showSuccess(
                'Questionnaire Completed',
                'All questions answered successfully'
            )
        } catch (error) {
            console.error('❌ Questionnaire submission failed:', error)
            this.showError(
                'Questionnaire Failed',
                error.message ||
                    'Failed to submit questionnaire. Please try again.'
            )
        } finally {
            this.isProcessing = false
        }
    }

    async handleComprehensiveVerification(): Promise<void> {
        if (
            !this.currentStep ||
            this.currentStep.type !== 'verification_processing'
        )
            return

        try {
            this.isProcessing = true
            this.statusMessage = 'Performing comprehensive verification...'

            if (!this.capturedSelfie || !this.uploadedDocument) {
                throw new Error('Missing selfie or document for verification')
            }

            // Convert selfie back to File
            const selfieResponse = await fetch(this.capturedSelfie)
            const selfieBlob = await selfieResponse.blob()
            const selfieFile = new File([selfieBlob], 'selfie.jpg', {
                type: 'image/jpeg',
            })

            // Perform comprehensive verification
            const result = await this.enhancedKYCService
                .comprehensiveVerification(
                    this.kycSession.session_id,
                    selfieFile,
                    this.uploadedDocument,
                    this.questionnaireAnswers,
                    0.8,
                    0.75,
                    0.8
                )
                .pipe(take(1))
                .toPromise()

            if (result.status === 'success') {
                this.completeCurrentStep({
                    verification_results: result.verification_results,
                    timestamp: new Date().toISOString(),
                })

                this.showSuccess(
                    'Verification Complete',
                    'All verification checks completed successfully'
                )
            } else {
                throw new Error(
                    result.error || 'Comprehensive verification failed'
                )
            }
        } catch (error) {
            console.error('❌ Comprehensive verification failed:', error)
            this.showError(
                'Verification Failed',
                'Failed to complete verification. Please try again.'
            )
        } finally {
            this.isProcessing = false
        }
    }

    private async captureSelfieFromVideo(): Promise<Blob | null> {
        try {
            const video = this.userVideoRef.nativeElement
            const canvas = document.createElement('canvas')
            const context = canvas.getContext('2d')

            if (!context) return null

            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            context.drawImage(video, 0, 0)

            return new Promise<Blob | null>((resolve) => {
                canvas.toBlob(resolve, 'image/jpeg', 0.8)
            })
        } catch (error) {
            console.error('❌ Failed to capture selfie:', error)
            return null
        }
    }

    private completeCurrentStep(data: any): void {
        if (!this.currentStep) return

        this.currentStep.status = 'completed'
        this.currentStep = null
        this.activateNextStep()

        // Check if all steps are completed
        const allCompleted = this.workflowSteps.every(
            (step) => step.status === 'completed'
        )
        if (allCompleted) {
            this.handleSessionCompletion()
        }
    }

    private handleSessionCompletion(): void {
        this.statusMessage = 'KYC verification completed successfully!'
        this.showSuccess(
            'KYC Complete',
            'Your KYC verification has been completed successfully. Thank you!'
        )

        setTimeout(() => {
            this.sessionCompleted.emit({
                session_id: this.kycSession?.session_id,
                verification_results: this.sessionStatus?.verification_results,
                risk_score: this.sessionStatus?.risk_score,
            })
        }, 2000)
    }

    // Media controls
    async toggleCamera(): Promise<void> {
        try {
            if (this.isCameraEnabled) {
                await this.mediaService.disableCamera()
                this.isCameraEnabled = false
            } else {
                await this.mediaService.enableCamera()
                this.isCameraEnabled = true
            }
        } catch (error) {
            console.error('❌ Failed to toggle camera:', error)
            this.showError(
                'Camera Error',
                'Failed to toggle camera. Please check permissions.'
            )
        }
    }

    async toggleMicrophone(): Promise<void> {
        try {
            if (this.isMicrophoneEnabled) {
                await this.mediaService.disableMicrophone()
                this.isMicrophoneEnabled = false
            } else {
                await this.mediaService.enableMicrophone()
                this.isMicrophoneEnabled = true
            }
        } catch (error) {
            console.error('❌ Failed to toggle microphone:', error)
            this.showError(
                'Microphone Error',
                'Failed to toggle microphone. Please check permissions.'
            )
        }
    }

    // AI Agent Communication
    async sendMessageToAgent(message: string): Promise<void> {
        if (!this.kycSession?.session_id) return

        try {
            const response = await this.enhancedKYCService
                .sendAgentMessage(this.kycSession.session_id, message)
                .pipe(take(1))
                .toPromise()

            console.log('💬 Agent response:', response.agent_response)
            // Handle agent response (could be displayed in UI)
        } catch (error) {
            console.error('❌ Failed to send message to agent:', error)
        }
    }

    // Utility methods
    getTaskStatus(taskId: string): TaskStatus | undefined {
        return this.taskStatuses.get(taskId)
    }

    getTaskProgress(taskId: string): number {
        const task = this.getTaskStatus(taskId)
        if (!task) return 0

        switch (task.status) {
            case 'pending':
                return 0
            case 'running':
                return 50
            case 'completed':
                return 100
            case 'failed':
                return 0
            case 'cancelled':
                return 0
            default:
                return 0
        }
    }

    getRiskLevel(riskScore: number): string {
        if (riskScore < 0.3) return 'low'
        if (riskScore < 0.6) return 'medium'
        return 'high'
    }

    isStepActive(stepType: string): boolean {
        return this.currentStep?.type === stepType
    }

    isStepCompleted(stepType: string): boolean {
        return this.workflowSteps.some(
            (step) => step.type === stepType && step.status === 'completed'
        )
    }

    getStepStatus(stepType: string): string {
        const step = this.workflowSteps.find((s) => s.type === stepType)
        return step?.status || 'pending'
    }

    // Notification methods
    private showSuccess(title: string, message: string): void {
        this.notificationService.showSuccess(title, message)
    }

    private showError(title: string, message: string): void {
        this.notificationService.showError(title, message)
    }

    private showInfo(title: string, message: string): void {
        this.notificationService.showInfo(title, message)
    }

    private showWarning(title: string, message: string): void {
        this.notificationService.showWarning(title, message)
    }

    // Cleanup
    private cleanup(): void {
        this.subscriptions.unsubscribe()

        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval)
        }

        if (this.kycSession?.session_id) {
            this.enhancedKYCService
                .endKYCSession(this.kycSession.session_id)
                .pipe(take(1))
                .subscribe()
        }

        this.enhancedKYCService.cleanup()
    }

    // Public cleanup method
    async endSession(): Promise<void> {
        this.cleanup()
    }
}
