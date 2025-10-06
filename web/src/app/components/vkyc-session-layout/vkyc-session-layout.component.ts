import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import { take } from 'rxjs/operators'
import { UserInstructionComponent } from '../pre-call-flow/user-instruction.component'
import { UserConsentComponent } from '../pre-call-flow/user-consent.component'
import { HealthCheckComponent } from '../pre-call-flow/health-check.component'
import { DetectionOverlaysComponent } from '../detection-overlays/detection-overlays.component'
// QuestionnaireFormComponent removed - questionnaire is now handled by agent prompt display
import { AgentJoinPopupComponent } from '../agent-join-popup/agent-join-popup.component'
import { MeetingPanelComponent } from '../meeting-panel/meeting-panel.component'
// AgentPromptDisplayComponent removed - using manual step navigation instead
import { JourneyProgressComponent } from '../journey-progress/journey-progress.component'
import { QuestionnaireStepComponent } from '../questionnaire-step/questionnaire-step.component'
import { StepCompletionComponent } from '../step-completion/step-completion.component'
import { MeetingService } from '../../services/meeting.service'
import { VkycJourneyService } from '../../services/vkyc-journey.service'
import { SessionStorageService } from '../../services/session-storage.service'
import { JourneyData } from '../../models/journey.models'

export interface VkycLayoutState {
    phase: 'pre' | 'in_call' | 'post'
    currentStep?: any
    showPreCallFlow: boolean
    preCallStep?: 'instructions' | 'consent' | 'health-check' | 'complete'
    canStartCall?: boolean
    detectionResult?: any
    multipleFaceDetectionResult?: any
    documentDetectionResult?: any
    captureType?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE' | 'QUESTIONNAIRE' | null
    questions?: any[]
    answers?: { [key: string]: any }
    showAgentJoinPopup?: boolean
    agentStreamReady?: boolean
    agentLoadingStep?: number
    roomId?: string
    workflowSteps?: WorkflowStep[]
    isMicMuted?: boolean
    currentPrompt?: any
    isWaitingForResponse?: boolean
    showCaptureLabel?: boolean
    captureLabel?: string
    showImageManipulator?: boolean
}

export interface WorkflowStep {
    id: string
    title: string
    type: string
    status: 'pending' | 'active' | 'completed' | 'skipped' | 'error'
    subActionStep?: 'pre' | 'in_call' | 'post'
    frame_capture_type?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE'
    sub_action_ref?: string
}

@Component({
    selector: 'app-vkyc-session-layout',
    standalone: true,
    imports: [
        CommonModule,
        UserInstructionComponent,
        UserConsentComponent,
        HealthCheckComponent,
        DetectionOverlaysComponent,
        // QuestionnaireFormComponent removed
        AgentJoinPopupComponent,
        MeetingPanelComponent,
        JourneyProgressComponent,
        QuestionnaireStepComponent,
        StepCompletionComponent,
    ],
    templateUrl: './vkyc-session-layout.component.html',
    styleUrls: ['./vkyc-session-layout.component.css'],
})
export class VkycSessionLayoutComponent implements OnInit, OnDestroy {
    @Input() state: VkycLayoutState | null = null
    @Input() preCallFlowService: any = null

    @Output() endSession = new EventEmitter<void>()
    @Output() instructionsProceed = new EventEmitter<void>()
    @Output() instructionsReschedule = new EventEmitter<void>()
    @Output() instructionsCancel = new EventEmitter<void>()
    @Output() consentProceed = new EventEmitter<void>()
    @Output() consentCancel = new EventEmitter<void>()
    @Output() healthCheckProceed = new EventEmitter<{
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }>()
    @Output() chatToggle = new EventEmitter<void>()
    @Output() cameraToggle = new EventEmitter<void>()
    @Output() capturePhoto = new EventEmitter<void>()

    // Local mic state management
    isMicMuted: boolean = false
    isCameraEnabled: boolean = true
    questionnaireAnswers: { [key: string]: any } = {}
    private subscriptions = new Subscription()

    constructor(
        private meetingService: MeetingService,
        private journeyService: VkycJourneyService,
        private sessionStorage: SessionStorageService
    ) {}

    ngOnInit(): void {
        // Subscribe to mic state changes from the meeting service
        this.subscriptions.add(
            this.meetingService.micState$.subscribe((isMicEnabled: boolean) => {
                this.isMicMuted = !isMicEnabled
            })
        )
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
    }

    @Output() healthCheckCancel = new EventEmitter<void>()
    @Output() voiceRecognition = new EventEmitter<any>()
    @Output() questionnaireRetry = new EventEmitter<void>()
    @Output() questionnaireSubmit = new EventEmitter<void>()
    @Output() startCall = new EventEmitter<void>()
    @Output() agentResponseSubmitted = new EventEmitter<{
        questionId: string
        response: string
    }>()
    @Output() agentResponseUpdated = new EventEmitter<{
        questionId: string
        response: string
    }>()
    @Output() agentProceed = new EventEmitter<void>()
    @Output() nextStep = new EventEmitter<void>()
    @Output() questionnaireCompleted = new EventEmitter<{
        [key: string]: string
    }>()
    @Output() startImageCapture = new EventEmitter<void>()
    @Output() finishKyc = new EventEmitter<void>()

    // Meeting panel event handlers
    onStreamsActive(active: boolean): void {
        // Note: Face detection is now handled directly in the vkyc-session component
        // No need to emit startCall here as it would cause infinite loops
    }

    onEndCall(): void {
        this.endSession.emit()
    }

    onChatToggle(): void {
        this.chatToggle.emit()
    }

    onCameraToggle(): void {
        this.cameraToggle.emit()
    }

    onMicToggle(): void {
        // Directly call the meeting service to toggle mic
        this.meetingService
            .toggleLocalMic()
            .then((isMicEnabled: boolean) => {
                // The mic state will be updated via the subscription in ngOnInit
            })
            .catch((error: any) => {
                console.error('🎯 LAYOUT: Error toggling mic:', error)
            })
    }

    onCapturePhoto(): void {
        this.capturePhoto.emit()
    }

    isCaptureButtonEnabled(): boolean {
        // Always enable capture button regardless of step type or status
        return true
    }

    onVoiceRecognition(question: any): void {
        console.log(
            '🎯 LAYOUT: Voice recognition requested for question:',
            question
        )
        this.voiceRecognition.emit(question)
    }

    onQuestionnaireRetry(): void {
        this.questionnaireRetry.emit()
    }

    onQuestionnaireSubmit(answers: { [key: string]: any }): void {
        // Store answers in component state for access by parent
        this.questionnaireAnswers = answers
        this.questionnaireSubmit.emit()
    }

    // Workflow step helper methods
    getStepCircleClass(step: WorkflowStep): string {
        // Check if this is the current step
        const isCurrentStep = this.state?.currentStep?.id === step.id
        // Debug logging (can be removed in production)
        if (step.type === 'QUESTIONNAIRE') {
        }

        switch (step.status) {
            case 'completed':
                return 'bg-green-500'
            case 'active':
                return 'bg-blue-600 ring-4 ring-blue-200' // Enhanced blue with ring for current step
            case 'pending':
                if (isCurrentStep) {
                    return 'bg-blue-600 ring-4 ring-blue-200' // Highlight current step even if pending
                }
                return 'bg-gray-400'
            case 'error':
                // If it's the current step and has error status, still highlight it as current
                if (isCurrentStep) {
                    return 'bg-blue-600 ring-4 ring-blue-200' // Highlight current step even if error
                }
                return 'bg-red-500' // Show error status for non-current steps
            case 'skipped':
            default:
                return 'bg-gray-400'
        }
    }

    getStepTextClass(step: WorkflowStep): string {
        switch (step.status) {
            case 'completed':
                return 'text-green-600'
            case 'active':
                return 'text-blue-600'
            case 'pending':
            case 'skipped':
            case 'error':
            default:
                return 'text-gray-500'
        }
    }

    getStepDisplayTitle(step: WorkflowStep): string {
        // Map step types to display titles
        switch (step.type) {
            case 'FRAME_CAPTURE':
                if (step.frame_capture_type === 'FACE_CAPTURE') {
                    return 'Capture'
                } else if (step.frame_capture_type === 'DOCUMENT_CAPTURE') {
                    return 'ID Proof Capture'
                }
                return step.title || 'Capture'
            case 'QUESTIONNAIRE':
                return 'Questionnaire'
            default:
                return step.title || step.type
        }
    }

    getStepIcon(step: WorkflowStep): string {
        switch (step.type) {
            case 'FRAME_CAPTURE':
                if (step.frame_capture_type === 'FACE_CAPTURE') {
                    // Camera icon for face capture
                    return 'M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
                } else if (step.frame_capture_type === 'DOCUMENT_CAPTURE') {
                    // ID card icon for document capture
                    return 'M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z'
                }
                return 'M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
            case 'QUESTIONNAIRE':
                // Document with question mark icon
                return 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            case 'GEO_TAGGING':
                return 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
            case 'USER_INSTRUCTION':
                return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            default:
                return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        }
    }

    getInCallSteps(): WorkflowStep[] {
        if (!this.state?.workflowSteps) return []

        // Show the main workflow steps: Capture, ID Proof Capture, Questionnaire
        const mainSteps = this.state.workflowSteps.filter(
            (step) =>
                step.type === 'FRAME_CAPTURE' || step.type === 'QUESTIONNAIRE'
        )

        // Sort by order or by type to ensure consistent display
        const sortedSteps = mainSteps.sort((a, b) => {
            // Questionnaire first, then face capture, then document capture
            if (a.type === 'QUESTIONNAIRE') return -1
            if (
                a.type === 'FRAME_CAPTURE' &&
                ((a as any).data?.frame_capture_type === 'FACE_CAPTURE' ||
                    (a as any).data?.captureType === 'FACE_CAPTURE')
            )
                return 0
            if (
                a.type === 'FRAME_CAPTURE' &&
                ((a as any).data?.frame_capture_type === 'DOCUMENT_CAPTURE' ||
                    (a as any).data?.captureType === 'DOCUMENT_CAPTURE')
            )
                return 1
            return 0
        })

        return sortedSteps
    }

    getCompletedStepsCount(): number {
        if (!this.state?.workflowSteps) return 0
        return this.state.workflowSteps.filter(
            (step) => step.status === 'completed'
        ).length
    }

    getTotalStepsCount(): number {
        if (!this.state?.workflowSteps) return 0
        return this.state.workflowSteps.length
    }

    getProgressPercentage(): number {
        const completed = this.getCompletedStepsCount()
        const total = this.getTotalStepsCount()
        return total > 0 ? Math.round((completed / total) * 100) : 0
    }

    hasWorkflowSteps(): boolean {
        return !!(
            this.state?.workflowSteps && this.state.workflowSteps.length > 0
        )
    }

    onAgentResponseSubmitted(event: {
        questionId: string
        response: string
    }): void {
        this.agentResponseSubmitted.emit(event)
    }

    onAgentResponseUpdated(event: {
        questionId: string
        response: string
    }): void {
        this.agentResponseUpdated.emit(event)
    }

    onAgentProceed(): void {
        this.agentProceed.emit()
    }

    getAgentWorkflowState(): any {
        // Convert VkycLayoutState to AgentWorkflowState format
        return {
            currentStep: this.state?.currentStep,
            completedSteps: [], // This would need to be tracked separately
            currentPrompt: this.state?.currentPrompt,
            isWaitingForResponse: this.state?.isWaitingForResponse,
            currentQuestion: null, // This would need to be tracked separately
            customerResponses: {}, // This would need to be tracked separately
        }
    }

    getJourneyData(): JourneyData | null {
        // Return the current journey data from the journey service
        let currentData: JourneyData | null = null
        this.journeyService.journeyData$
            .pipe(take(1))
            .subscribe((data) => (currentData = data))
        return currentData
    }

    onAutoCaptureTriggered(): void {
        console.log(
            '🎯 VKYC-SESSION-LAYOUT: Auto-capture triggered from detection overlays'
        )
        // Emit the capture photo event to the parent component
        this.capturePhoto.emit()
    }

    // Manual step navigation methods
    getCurrentStepTitle(): string {
        const currentStep = this.state?.currentStep
        if (!currentStep) {
            return 'Welcome to KYC Verification'
        }

        switch (currentStep.type) {
            case 'QUESTIONNAIRE':
                return 'Questionnaire'
            case 'FRAME_CAPTURE':
                if (currentStep.data?.captureType === 'FACE_CAPTURE') {
                    return 'Take Selfie'
                } else if (
                    currentStep.data?.captureType === 'DOCUMENT_CAPTURE'
                ) {
                    return 'Document Capture'
                }
                return 'Image Capture'
            default:
                return currentStep.title || 'Next Step'
        }
    }

    getCurrentStepDescription(): string {
        const currentStep = this.state?.currentStep
        if (!currentStep) {
            return 'Click Next to start your KYC verification process'
        }

        switch (currentStep.type) {
            case 'QUESTIONNAIRE':
                return 'Review the verification questions. Click Next to proceed through each question.'
            case 'FRAME_CAPTURE':
                if (currentStep.data?.captureType === 'FACE_CAPTURE') {
                    return 'Take a clear selfie for identity verification. Click Start to open camera.'
                } else if (
                    currentStep.data?.captureType === 'DOCUMENT_CAPTURE'
                ) {
                    return 'Capture your identity document (PAN/Aadhaar). Click Start to open camera.'
                }
                return 'Capture the required image. Click Start to open camera.'
            default:
                return (
                    currentStep.description ||
                    'Click Next to proceed with this step'
                )
        }
    }

    getNextButtonText(): string {
        const currentStep = this.state?.currentStep

        // Check if all steps are completed
        if (!currentStep && this.areAllStepsCompleted()) {
            return 'End KYC'
        }

        if (!currentStep) {
            return 'Start KYC'
        }

        switch (currentStep.type) {
            case 'QUESTIONNAIRE':
                return 'Start Questions'
            case 'FRAME_CAPTURE':
                if (currentStep.data?.captureType === 'FACE_CAPTURE') {
                    return 'Take Selfie'
                } else if (
                    currentStep.data?.captureType === 'DOCUMENT_CAPTURE'
                ) {
                    return 'Capture Document'
                }
                return 'Capture Image'
            default:
                return 'Next Step'
        }
    }

    private areAllStepsCompleted(): boolean {
        try {
            const workflowSteps = this.state?.workflowSteps || []
            const inCallSteps = workflowSteps.filter(
                (step: any) => step.phase === 'in_call'
            )

            // If no steps are loaded yet, return false (workflow not started)
            if (inCallSteps.length === 0) {
                return false
            }

            // Check if all in-call steps are completed
            return inCallSteps.every((step: any) => {
                if (step.type === 'QUESTIONNAIRE') {
                    const questionnaireData = this.sessionStorage.getStepData(
                        'questionnaire-answers'
                    )
                    return (
                        step.status === 'completed' ||
                        questionnaireData?.success === true
                    )
                } else if (step.type === 'FRAME_CAPTURE') {
                    return (
                        step.status === 'completed' ||
                        step.analysisResult ||
                        this.isStepDataCompleted(step.id)
                    )
                }
                return step.status === 'completed'
            })
        } catch (error) {
            console.warn(
                '🎯 LAYOUT: Error checking if all steps completed:',
                error
            )
            return false
        }
    }

    onNextStep(): void {
        const currentStep = this.state?.currentStep

        if (!currentStep) {
            // Check if all steps are completed
            if (this.areAllStepsCompleted()) {
                this.finishKyc.emit()
                return
            }

            // Start the workflow
            this.nextStep.emit()
            return
        }

        switch (currentStep.type) {
            case 'QUESTIONNAIRE':
                // For questionnaire, just mark as completed and move to next
                this.nextStep.emit()
                break
            case 'FRAME_CAPTURE':
                // For image capture, trigger the start image capture
                console.log(
                    '🎯 LAYOUT: Triggering start image capture for FRAME_CAPTURE step'
                )
                this.startImageCapture.emit()
                break
            default:
                // For other steps, just move to next
                this.nextStep.emit()
                break
        }
    }

    // New event handlers for step components
    onQuestionnaireCompleted(answers: { [key: string]: string }): void {
        this.questionnaireCompleted.emit(answers)
    }

    onStartImageCapture(): void {
        this.startImageCapture.emit()
    }

    onFinishKyc(): void {
        this.finishKyc.emit()
    }

    // Helper methods for step components
    isQuestionnaireStep(): boolean {
        return this.state?.currentStep?.type === 'QUESTIONNAIRE'
    }

    isImageCaptureStep(): boolean {
        return this.state?.currentStep?.type === 'FRAME_CAPTURE'
    }

    getQuestionnaireData(): any {
        const currentStep = this.state?.currentStep
        if (!currentStep || currentStep.type !== 'QUESTIONNAIRE') {
            return null
        }
        return currentStep.data?.questionnaire || null
    }

    getStepCompletionData(): any {
        const currentStep = this.state?.currentStep
        if (
            !currentStep ||
            (currentStep.type !== 'FRAME_CAPTURE' &&
                currentStep.type !== 'QUESTIONNAIRE')
        ) {
            return {
                stepTitle: '',
                stepDescription: '',
                isCompleted: false,
                isLastStep: false,
            }
        }

        // Get all in-call steps (the main workflow steps)
        const workflowSteps = this.state?.workflowSteps || []
        const inCallSteps = workflowSteps.filter(
            (step: any) => step.phase === 'in_call'
        )

        // Check if this is the last in-call step
        const currentStepIndex = inCallSteps.findIndex(
            (step) => step.id === currentStep.id
        )
        const isLastStep = currentStepIndex === inCallSteps.length - 1

        // Check if step is completed
        let isCompleted = false
        if (currentStep.type === 'FRAME_CAPTURE') {
            isCompleted =
                currentStep.status === 'completed' ||
                currentStep.analysisResult ||
                this.isStepDataCompleted(currentStep.id)
        } else if (currentStep.type === 'QUESTIONNAIRE') {
            // For questionnaire, check if answers are saved
            const questionnaireData = this.sessionStorage.getStepData(
                'questionnaire-answers'
            )
            isCompleted =
                currentStep.status === 'completed' ||
                questionnaireData?.success === true
        }

        return {
            stepTitle: currentStep.title || this.getCurrentStepTitle(),
            stepDescription:
                currentStep.description || this.getCurrentStepDescription(),
            isCompleted: isCompleted,
            isLastStep: isLastStep,
            analysisResult: currentStep.analysisResult,
            stepType: currentStep.type,
        }
    }

    private isStepDataCompleted(stepId: string): boolean {
        try {
            const stepData = this.sessionStorage.getStepData(stepId)
            return stepData?.success === true
        } catch (error) {
            console.warn('🎯 LAYOUT: Error checking step completion:', error)
            return false
        }
    }
}
