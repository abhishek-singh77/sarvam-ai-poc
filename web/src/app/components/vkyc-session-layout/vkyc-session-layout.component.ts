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
import { QuestionnaireFormComponent } from '../questionnaire-form/questionnaire-form.component'
import { AgentJoinPopupComponent } from '../agent-join-popup/agent-join-popup.component'
import { MeetingPanelComponent } from '../meeting-panel/meeting-panel.component'
import { AgentPromptDisplayComponent } from '../agent-prompt-display/agent-prompt-display.component'
import { JourneyProgressComponent } from '../journey-progress/journey-progress.component'
import { MeetingService } from '../../services/meeting.service'
import { VkycJourneyService } from '../../services/vkyc-journey.service'
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
        QuestionnaireFormComponent,
        AgentJoinPopupComponent,
        MeetingPanelComponent,
        AgentPromptDisplayComponent,
        JourneyProgressComponent,
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
    questionnaireAnswers: { [key: string]: any } = {}
    private subscriptions = new Subscription()

    constructor(
        private meetingService: MeetingService,
        private journeyService: VkycJourneyService
    ) {}

    ngOnInit(): void {
        // Subscribe to mic state changes from the meeting service
        this.subscriptions.add(
            this.meetingService.micState$.subscribe((isMicEnabled: boolean) => {
                console.log('🎯 LAYOUT: Mic state changed to:', isMicEnabled)
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

    // Meeting panel event handlers
    onStreamsActive(active: boolean): void {
        console.log('🎯 LAYOUT: Streams active:', active)
        // Note: Face detection is now handled directly in the vkyc-session component
        // No need to emit startCall here as it would cause infinite loops
    }

    onEndCall(): void {
        console.log('🎯 LAYOUT: End call requested')
        this.endSession.emit()
    }

    onChatToggle(): void {
        console.log('🎯 LAYOUT: Chat toggle requested')
        this.chatToggle.emit()
    }

    onCameraToggle(): void {
        console.log('🎯 LAYOUT: Camera toggle requested')
        this.cameraToggle.emit()
    }

    onMicToggle(): void {
        console.log('🎯 LAYOUT: Mic toggle requested')
        // Directly call the meeting service to toggle mic
        this.meetingService
            .toggleLocalMic()
            .then((isMicEnabled: boolean) => {
                console.log('🎯 LAYOUT: Mic toggled, enabled:', isMicEnabled)
                // The mic state will be updated via the subscription in ngOnInit
            })
            .catch((error: any) => {
                console.error('🎯 LAYOUT: Error toggling mic:', error)
            })
    }

    onCapturePhoto(): void {
        console.log('🎯 LAYOUT: Capture photo requested')
        this.capturePhoto.emit()
    }

    isCaptureButtonEnabled(): boolean {
        const currentStep = this.state?.currentStep
        return (
            currentStep?.type === 'FRAME_CAPTURE' &&
            currentStep?.status === 'active'
        )
    }

    onVoiceRecognition(question: any): void {
        console.log(
            '🎯 LAYOUT: Voice recognition requested for question:',
            question
        )
        this.voiceRecognition.emit(question)
    }

    onQuestionnaireRetry(): void {
        console.log('🎯 LAYOUT: Questionnaire retry requested')
        this.questionnaireRetry.emit()
    }

    onQuestionnaireSubmit(answers: { [key: string]: any }): void {
        console.log('🎯 LAYOUT: Questionnaire submitted with answers:', answers)
        // Store answers in component state for access by parent
        this.questionnaireAnswers = answers
        this.questionnaireSubmit.emit()
    }

    // Workflow step helper methods
    getStepCircleClass(step: WorkflowStep): string {
        switch (step.status) {
            case 'completed':
                return 'bg-green-500'
            case 'active':
                return 'bg-blue-500'
            case 'pending':
            case 'skipped':
            case 'error':
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
        return mainSteps.sort((a, b) => {
            // Face capture first, then document capture, then questionnaire
            if (
                a.type === 'FRAME_CAPTURE' &&
                a.frame_capture_type === 'FACE_CAPTURE'
            )
                return -1
            if (
                a.type === 'FRAME_CAPTURE' &&
                a.frame_capture_type === 'DOCUMENT_CAPTURE'
            )
                return 0
            if (a.type === 'QUESTIONNAIRE') return 1
            return 0
        })
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
        console.log('🎯 LAYOUT: Agent response submitted:', event)
        this.agentResponseSubmitted.emit(event)
    }

    onAgentResponseUpdated(event: {
        questionId: string
        response: string
    }): void {
        console.log('🎯 LAYOUT: Agent response updated:', event)
        this.agentResponseUpdated.emit(event)
    }

    onAgentProceed(): void {
        console.log('🎯 LAYOUT: Agent proceed button clicked')
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
}
