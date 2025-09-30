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
import { SessionStorageService } from '../../services/session-storage.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'

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

    // Agent loading (managed by layout component)
    canStartCall = false

    // Questionnaire answers
    questionnaireAnswers: { [key: string]: any } = {}

    // Health check data
    healthCheckData: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    } | null = null

    constructor(
        public preCallFlowService: PreCallFlowService,
        private meetingFacade: VkycMeetingFacadeService,
        private workflowFacade: VkycWorkflowFacadeService,
        private captureFacade: VkycCaptureFacadeService,
        private questionnaireFacade: VkycQuestionnaireFacadeService,
        private cdRef: ChangeDetectorRef,
        private sessionStorage: SessionStorageService,
        private roomService: EnterpriseRoomService
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

                // Don't override phase if we're already in call
                const updates: Partial<VkycLayoutState> = {
                    currentStep: state.currentStep,
                    captureType: state.currentStep?.data?.captureType,
                    questions: state.currentStep?.data?.questions,
                    answers: this.questionnaireAnswers,
                }

                // Only set phase if we're not already in call
                if (this.layoutState?.phase !== 'in_call') {
                    updates.phase = state.phase
                }

                this.updateLayoutState(updates)

                if (state.currentStep) {
                    this.handleStepChange(state.currentStep)
                }
            })
        )
        this.workflowFacade.init()
    }

    private initializeAgentLoading(healthCheckData?: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }): void {
        this.subscriptions.add(
            this.meetingFacade.agentLoadingStep$.subscribe((step) => {
                // Update layout state with current step
                this.updateLayoutState({ agentLoadingStep: step })
            })
        )

        // Listen for agent stream ready event
        this.subscriptions.add(
            this.meetingFacade.agentStreamReady$.subscribe((isReady) => {
                if (isReady) {
                    console.log('🎯 VKYC-SESSION: Agent stream is ready')
                    this.updateLayoutState({
                        agentStreamReady: true,
                        showAgentJoinPopup: false, // Close popup when agent is ready
                        phase: 'in_call', // Ensure we stay in in_call phase
                        showPreCallFlow: false, // Ensure pre-call flow is hidden
                    })
                    // Start the actual KYC workflow
                    this.workflowFacade.init()
                }
            })
        )

        this.meetingFacade.startAgentLoadingSequence(healthCheckData)
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

    onHealthCheckProceed(healthCheckData: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }): void {
        // Store health check data for later use in geo-location API
        this.healthCheckData = healthCheckData

        // Log the health check results
        console.log('🎯 VKYC-SESSION: Health check completed', {
            location: healthCheckData.locationData,
            networkSpeed: healthCheckData.networkSpeed,
            vpnDetected: healthCheckData.isVpnDetected,
        })

        this.preCallFlowService.completeFlow()
        // Don't automatically join call, wait for user to click "Start Call"
    }

    onHealthCheckCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from health check')
    }

    // Agent join is now handled automatically when stream is ready

    // Start call method - called when user clicks "Start Call" button
    async startCall(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Starting call...')

        // Show agent join popup immediately
        this.updateLayoutState({
            showAgentJoinPopup: true,
            agentStreamReady: false,
            phase: 'in_call',
            showPreCallFlow: false,
        })

        try {
            // Initialize VideoSDK meeting after health check
            console.log('🎯 VKYC-SESSION: Initializing VideoSDK meeting...')
            const videoResult =
                await this.roomService.initializeVideoSDKMeeting()

            if (!videoResult.success) {
                throw new Error(
                    videoResult.error || 'Failed to initialize VideoSDK'
                )
            }

            // Pass health check data to join-agent API
            if (this.healthCheckData) {
                console.log(
                    '🎯 VKYC-SESSION: Passing health check data to join-agent:',
                    this.healthCheckData
                )
            }

            this.initializeAgentLoading(this.healthCheckData || undefined)
        } catch (error: any) {
            console.error('🎯 VKYC-SESSION: Failed to start call:', error)
            // Handle error - maybe show error modal or go back to health check
        }
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

    async endSession(): Promise<void> {
        try {
            // End the session and clear all data
            await this.roomService.endSession()
            this.meetingFacade.leaveCall()
            this.sessionEnded.emit()
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error ending session:', error)
            // Still emit the event to navigate away
            this.sessionEnded.emit()
        }
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

    // Template helper methods (removed getLogMessage as it's no longer needed)
}
