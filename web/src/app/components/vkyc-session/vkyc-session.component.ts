import {
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    ElementRef,
    Output,
    EventEmitter,
    ChangeDetectorRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import {
    VkycSessionLayoutComponent,
    VkycLayoutState,
} from '../vkyc-session-layout/vkyc-session-layout.component'
import { Subscription } from 'rxjs'
import { VkycMeetingFacadeService } from '../../services/vkyc-meeting-facade.service'
import { VkycWorkflowFacadeService } from '../../services/vkyc-workflow-facade.service'
import { VkycCaptureFacadeService } from '../../services/vkyc-capture-facade.service'
import { VkycQuestionnaireFacadeService } from '../../services/vkyc-questionnaire-facade.service'
import { PreCallFlowService } from '../../services/pre-call-flow.service'

@Component({
    selector: 'app-vkyc-session',
    standalone: true,
    imports: [CommonModule, FormsModule, VkycSessionLayoutComponent],
    templateUrl: './vkyc-session.component.html',
    styleUrls: ['./vkyc-session.component.css'],
})
export class VkycSessionComponent implements OnInit, OnDestroy {
    @ViewChild('userVideoRef') userVideoRef!: ElementRef<HTMLVideoElement>
    @Output() sessionEnded = new EventEmitter<void>()

    // Core state
    private subscriptions = new Subscription()

    // Layout state
    layoutState: VkycLayoutState = {
        phase: 'pre',
        showPreCallFlow: true,
        preCallStep: 'instructions',
    }

    // Modal states
    showImageManipulator = false
    showErrorModal = false
    errorMessage = ''

    // Agent loading
    isAgentLoading = false
    agentLoadingStep = 0
    canStartCall = false

    // Questionnaire answers
    questionnaireAnswers: { [key: string]: any } = {}

    constructor(
        public preCallFlowService: PreCallFlowService,
        private meetingFacade: VkycMeetingFacadeService,
        private workflowFacade: VkycWorkflowFacadeService,
        private captureFacade: VkycCaptureFacadeService,
        private questionnaireFacade: VkycQuestionnaireFacadeService,
        private cdRef: ChangeDetectorRef
    ) {
        console.log('🎯 VKYC-SESSION: Component initialized')
    }

    ngOnInit(): void {
        this.initializePreCallFlow()
        this.initializeWorkflow()
        // Don't initialize agent loading until user clicks "Start Call"
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
        this.meetingFacade.cleanup()
        this.workflowFacade.cleanup()
        this.captureFacade.stopDetection()
    }

    // Initialization methods
    private initializePreCallFlow(): void {
        this.subscriptions.add(
            this.preCallFlowService.flowState$.subscribe((state) => {
                const isComplete = state?.currentStep === 'complete'
                this.canStartCall = isComplete

                this.updateLayoutState({
                    showPreCallFlow: !isComplete,
                    preCallStep: isComplete ? undefined : state?.currentStep,
                })
            })
        )
        // PreCallFlowService doesn't have startFlow method, it auto-starts
    }

    private initializeWorkflow(): void {
        this.subscriptions.add(
            this.workflowFacade.state$.subscribe((state) => {
                if (!state) return

                this.updateLayoutState({
                    phase: state.phase,
                    currentStep: state.currentStep,
                    captureType: state.currentStep?.data?.captureType,
                    questions: state.currentStep?.data?.questions,
                    answers: this.questionnaireAnswers,
                })

                if (state.currentStep) {
                    this.handleStepChange(state.currentStep)
                }
            })
        )
        this.workflowFacade.init()
    }

    private initializeAgentLoading(): void {
        this.subscriptions.add(
            this.meetingFacade.agentLoadingStep$.subscribe((step) => {
                this.agentLoadingStep = step
                this.isAgentLoading = step < 4 // Assuming 4 steps total
            })
        )
        this.meetingFacade.startAgentLoadingSequence()
    }

    // Pre-call flow event handlers
    onInstructionsProceed(): void {
        this.preCallFlowService.proceedToConsent()
        this.updateLayoutState({ preCallStep: 'consent' })
    }

    onInstructionsReschedule(): void {
        console.log('🎯 VKYC-SESSION: User requested reschedule')
    }

    onInstructionsCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from instructions')
    }

    onConsentProceed(): void {
        this.preCallFlowService.proceedToHealthCheck()
        this.updateLayoutState({ preCallStep: 'health-check' })
    }

    onConsentCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from consent')
    }

    onHealthCheckProceed(): void {
        this.preCallFlowService.completeFlow()
        // Don't automatically join call, wait for user to click "Start Call"
    }

    onHealthCheckCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from health check')
    }

    // Start call method - called when user clicks "Start Call" button
    startCall(): void {
        console.log('🎯 VKYC-SESSION: Starting call...')
        this.initializeAgentLoading()
        this.updateLayoutState({ phase: 'in_call', showPreCallFlow: false })
        this.joinCall()
    }

    // Core workflow methods
    private handleStepChange(step: any): void {
        console.log('🎯 VKYC-SESSION: Handling step change:', step.type)

        switch (step.type) {
            case 'FRAME_CAPTURE':
                this.handleFrameCaptureStep(step)
                break
            case 'QUESTIONNAIRE':
                this.handleQuestionnaireStep(step)
                break
            default:
                console.log('🎯 VKYC-SESSION: Unknown step type:', step.type)
        }
    }

    private handleFrameCaptureStep(step: any): void {
        const video = this.userVideoRef?.nativeElement
        if (!video) return

        const captureType = step.data?.captureType
        if (captureType === 'FACE_CAPTURE') {
            this.captureFacade.startFaceDetection(video)
        } else if (captureType === 'DOCUMENT_CAPTURE') {
            this.captureFacade.startDocumentDetection(video)
        }
    }

    private handleQuestionnaireStep(step: any): void {
        // Questionnaire is handled by the layout component
        console.log('🎯 VKYC-SESSION: Questionnaire step active')
    }

    private joinCall(): void {
        this.meetingFacade
            .joinCall()
            .then(() => {
                console.log('🎯 VKYC-SESSION: Successfully joined call')
            })
            .catch((error) => {
                console.error('🎯 VKYC-SESSION: Failed to join call:', error)
                this.showError('Failed to join call. Please try again.')
            })
    }

    // Event handlers
    startVoiceRecognition(question: any): void {
        this.questionnaireFacade.startVoiceRecognition(question)
    }

    submitQuestionnaire(): void {
        const answers = this.questionnaireFacade.submitAnswers()
        this.questionnaireAnswers = answers
        this.workflowFacade.completeCurrentStep()
        console.log('🎯 VKYC-SESSION: Questionnaire submitted:', answers)
    }

    endSession(): void {
        this.meetingFacade.leaveCall()
        this.sessionEnded.emit()
    }

    // Utility methods
    private updateLayoutState(updates: Partial<VkycLayoutState>): void {
        this.layoutState = {
            ...this.layoutState,
            ...updates,
            canStartCall: this.canStartCall,
        }
        this.cdRef.detectChanges()
    }

    private showError(message: string): void {
        this.errorMessage = message
        this.showErrorModal = true
    }

    // Template helper methods
    getLogMessage(step: string): string {
        const messages: { [key: string]: string } = {
            '0': 'Initializing agent...',
            '1': 'Loading AI model...',
            '2': 'Connecting to video service...',
            '3': 'Setting up audio streams...',
            '4': 'Finalizing setup...',
        }
        return messages[step] || 'Loading...'
    }
}
