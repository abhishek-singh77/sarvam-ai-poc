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
import { ImageManipulatorComponent } from '../image-manipulator/image-manipulator.component'
import { Subscription } from 'rxjs'
import { VkycMeetingFacadeService } from '../../services/vkyc-meeting-facade.service'
import { VkycWorkflowFacadeService } from '../../services/vkyc-workflow-facade.service'
import { VkycCaptureFacadeService } from '../../services/vkyc-capture-facade.service'
import { VkycQuestionnaireFacadeService } from '../../services/vkyc-questionnaire-facade.service'
import { PreCallFlowService } from '../../services/pre-call-flow.service'
import { SessionStorageService } from '../../services/session-storage.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { MeetingService } from '../../services/meeting.service'
import { AgentWorkflowService } from '../../services/agent-workflow.service'

@Component({
    selector: 'app-vkyc-session',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        VkycSessionLayoutComponent,
        ImageManipulatorComponent,
    ],
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
        isMicMuted: false, // Initialize mic state
    }

    // Modal states
    showImageManipulator = false
    showErrorModal = false
    errorMessage = ''

    // Image manipulator data
    capturedImageBlob: Blob | null = null
    capturedImageBase64: string = ''

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

    // Room ID for workflow progress
    roomId: string = ''

    // Flag to prevent multiple workflow initializations
    workflowInitialized: boolean = false

    // Flag to prevent multiple agent loading initializations
    agentLoadingInitialized: boolean = false

    // Flag to prevent multiple startCall calls
    startCallInProgress: boolean = false

    constructor(
        public preCallFlowService: PreCallFlowService,
        private meetingFacade: VkycMeetingFacadeService,
        private workflowFacade: VkycWorkflowFacadeService,
        private captureFacade: VkycCaptureFacadeService,
        private questionnaireFacade: VkycQuestionnaireFacadeService,
        private cdRef: ChangeDetectorRef,
        private sessionStorage: SessionStorageService,
        private roomService: EnterpriseRoomService,
        private meetingService: MeetingService,
        private agentWorkflowService: AgentWorkflowService
    ) {
        console.log('🎯 VKYC-SESSION: Component initialized')
    }

    ngOnInit(): void {
        // Get room ID from session storage
        const sessionData = this.sessionStorage.getSessionData()
        if (sessionData) {
            this.roomId = sessionData.roomId
        }

        this.initializePreCallFlow()
        this.initializeWorkflow()
        // Don't initialize agent loading until user clicks "Start Call"
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
        this.meetingFacade.cleanup()
        this.workflowFacade.cleanup()
        this.captureFacade.stopDetection()

        // Reset initialization flags
        this.workflowInitialized = false
        this.agentLoadingInitialized = false
        this.startCallInProgress = false
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
                    workflowSteps: state.steps || [],
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

        // Initialize face detection and auto-capture
        this.initializeFaceDetection()

        // Don't initialize workflow here - wait for agent stream to be ready
        // this.workflowFacade.init()
    }

    private initializeFaceDetection(): void {
        // Subscribe to face detection results
        this.subscriptions.add(
            this.captureFacade.faceDetection$.subscribe((result) => {
                this.updateLayoutState({
                    detectionResult: result,
                })

                // Auto-capture if face is detected and auto-capture is enabled
                if (
                    result &&
                    result.confidence > 0.8 &&
                    result.steady &&
                    this.captureFacade.isAutoCaptureEnabled$.value &&
                    this.layoutState?.currentStep?.type === 'FRAME_CAPTURE'
                ) {
                    this.performAutoCapture()
                }
            })
        )

        // Subscribe to document detection results
        this.subscriptions.add(
            this.captureFacade.documentDetection$.subscribe((result) => {
                this.updateLayoutState({
                    documentDetectionResult: result,
                })

                // Auto-capture if document is detected and auto-capture is enabled
                if (
                    result &&
                    result.confidence > 0.8 &&
                    result.steady &&
                    this.captureFacade.isAutoCaptureEnabled$.value &&
                    this.layoutState?.currentStep?.type === 'FRAME_CAPTURE'
                ) {
                    this.performAutoCapture()
                }
            })
        )
    }

    private performAutoCapture(): void {
        console.log('🎯 VKYC-SESSION: Performing auto-capture')
        this.captureFacade.setCapturing(true)

        // Get the video element from the meeting panel
        const videoElement = document.querySelector('video') as HTMLVideoElement
        if (videoElement) {
            // Create canvas to capture frame
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            if (ctx) {
                canvas.width = videoElement.videoWidth
                canvas.height = videoElement.videoHeight
                ctx.drawImage(videoElement, 0, 0)

                // Convert to blob and submit
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            this.submitCapture(blob)
                        }
                    },
                    'image/jpeg',
                    0.9
                )
            }
        }

        setTimeout(() => {
            this.captureFacade.setCapturing(false)
        }, 1000)
    }

    private submitCapture(blob: Blob): void {
        console.log('🎯 VKYC-SESSION: Submitting capture')

        // Store the captured image
        this.capturedImageBlob = blob

        // Convert blob to base64 for the image manipulator
        const reader = new FileReader()
        reader.onload = () => {
            this.capturedImageBase64 = reader.result as string
            // Show the image manipulator
            this.showImageManipulator = true
            console.log('🎯 VKYC-SESSION: Image manipulator opened')
        }
        reader.readAsDataURL(blob)
    }

    private startFaceDetectionOnVideo(videoElement: HTMLVideoElement): void {
        console.log('🎯 VKYC-SESSION: Starting face detection on video element')

        // Start face detection based on current step
        if (this.layoutState?.currentStep?.type === 'FRAME_CAPTURE') {
            const captureType = this.layoutState.currentStep?.data?.captureType
            if (captureType === 'FACE_CAPTURE') {
                this.captureFacade.startFaceDetection(videoElement)
            } else if (captureType === 'DOCUMENT_CAPTURE') {
                this.captureFacade.startDocumentDetection(videoElement)
            }
        }
    }

    private initializeAgentLoading(healthCheckData?: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }): void {
        // Prevent multiple initializations
        if (this.agentLoadingInitialized) {
            console.log(
                '🎯 VKYC-SESSION: Agent loading already initialized, skipping'
            )
            return
        }

        this.agentLoadingInitialized = true
        console.log('🎯 VKYC-SESSION: Initializing agent loading...')

        this.subscriptions.add(
            this.meetingFacade.agentLoadingStep$.subscribe((step) => {
                // Update layout state with current step
                this.updateLayoutState({ agentLoadingStep: step })
            })
        )

        // Listen for agent stream ready event
        this.subscriptions.add(
            this.meetingFacade.agentStreamReady$.subscribe((isReady) => {
                if (isReady && !this.layoutState?.agentStreamReady) {
                    console.log('🎯 VKYC-SESSION: Agent stream is ready')
                    this.updateLayoutState({
                        agentStreamReady: true,
                        showAgentJoinPopup: false, // Close popup when agent is ready
                        phase: 'in_call', // Ensure we stay in in_call phase
                        showPreCallFlow: false, // Ensure pre-call flow is hidden
                    })
                    // Start the actual KYC workflow (only if not already initialized)
                    if (!this.workflowInitialized) {
                        this.workflowInitialized = true
                        this.workflowFacade.init()

                        // Initialize agent workflow
                        this.initializeAgentWorkflow()
                    }
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
        // Prevent multiple startCall calls
        if (this.startCallInProgress) {
            console.log(
                '🎯 VKYC-SESSION: Start call already in progress, skipping'
            )
            return
        }

        this.startCallInProgress = true
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

            // Start face detection when video is ready
            setTimeout(() => {
                const videoElement = document.querySelector(
                    'video'
                ) as HTMLVideoElement
                if (videoElement) {
                    this.startFaceDetectionOnVideo(videoElement)
                }
            }, 2000) // Wait for video to be ready
        } catch (error: any) {
            console.error('🎯 VKYC-SESSION: Failed to start call:', error)
            // Reset the flag so user can try again
            this.startCallInProgress = false
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
            roomId: this.roomId,
        }
        this.cdRef.detectChanges()
    }

    private showError(message: string): void {
        this.errorMessage = message
        this.showErrorModal = true
    }

    // Image manipulator event handlers
    async onImageProcessed(response: any): Promise<void> {
        console.log('🎯 VKYC-SESSION: Image processed successfully:', response)
        this.showImageManipulator = false
        this.capturedImageBlob = null
        this.capturedImageBase64 = ''

        // Complete the current step after image processing
        try {
            await this.workflowFacade.completeCurrentStep()
            console.log(
                '🎯 VKYC-SESSION: Step completed after image processing'
            )
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Failed to complete step:', error)
            this.showErrorNotification('Failed to complete step')
        }
    }

    onImageManipulatorError(error: string): void {
        console.error('🎯 VKYC-SESSION: Image manipulator error:', error)
        this.showErrorModal = true
        this.errorMessage = error
    }

    onImageManipulatorClose(): void {
        console.log('🎯 VKYC-SESSION: Image manipulator closed')
        this.showImageManipulator = false
        this.capturedImageBlob = null
        this.capturedImageBase64 = ''
    }

    getImageManipulatorConfig(): any {
        return {
            base64: this.capturedImageBase64,
            subActionId: this.layoutState?.currentStep?.id || '',
            mode:
                this.layoutState?.captureType === 'FACE_CAPTURE'
                    ? 'selfie'
                    : 'document',
            frontImage: this.capturedImageBlob || new Blob(),
        }
    }

    // Template helper methods (removed getLogMessage as it's no longer needed)

    // Control button handlers
    onChatToggle(): void {
        console.log('🎯 VKYC-SESSION: Chat toggle requested')
        // TODO: Implement chat functionality
    }

    onCameraToggle(): void {
        console.log('🎯 VKYC-SESSION: Camera toggle requested')
        // Use the flipCamera method from meeting service
        this.meetingService
            .flipCamera()
            .then((result: { success: boolean; message: string }) => {
                if (result.success) {
                    console.log(
                        '🎯 VKYC-SESSION: Camera flipped successfully:',
                        result.message
                    )
                    // TODO: Show success notification
                } else {
                    console.warn(
                        '🎯 VKYC-SESSION: Camera flip failed:',
                        result.message
                    )
                    this.showErrorNotification(result.message)
                }
            })
            .catch((error: any) => {
                console.error('🎯 VKYC-SESSION: Error flipping camera:', error)
                this.showErrorNotification('Failed to flip camera')
            })
    }

    onCapturePhoto(): void {
        console.log('🎯 VKYC-SESSION: Capture photo requested')
        // Use the captureImage method from meeting service
        this.meetingService
            .captureImage()
            .then((imageData: string | null) => {
                if (imageData) {
                    console.log('🎯 VKYC-SESSION: Photo captured successfully')
                    // TODO: Handle the captured image data
                    // This could trigger the auto-capture flow or show the image manipulator
                } else {
                    console.warn('🎯 VKYC-SESSION: Failed to capture photo')
                    this.showErrorNotification('Failed to capture photo')
                }
            })
            .catch((error: any) => {
                console.error('🎯 VKYC-SESSION: Error capturing photo:', error)
                this.showErrorNotification('Failed to capture photo')
            })
    }

    private showErrorNotification(message: string): void {
        // TODO: Implement proper notification system
        // For now, we'll use the existing error modal
        this.showErrorModal = true
        this.errorMessage = message
        console.error('🎯 VKYC-SESSION: Error notification:', message)
    }

    private initializeAgentWorkflow(): void {
        console.log('🎯 VKYC-SESSION: Initializing agent workflow')

        // Subscribe to workflow steps to initialize agent workflow
        this.subscriptions.add(
            this.workflowFacade.state$.subscribe((state: any) => {
                if (state?.steps && state.steps.length > 0) {
                    // Initialize agent workflow with the steps
                    this.agentWorkflowService.initializeAgentWorkflow(
                        state.steps
                    )

                    // Update layout state with workflow steps
                    this.updateLayoutState({ workflowSteps: state.steps })
                }
            })
        )

        // Subscribe to agent workflow state for UI updates
        this.subscriptions.add(
            this.agentWorkflowService.workflowState$.subscribe(
                (workflowState) => {
                    // Update layout state with current prompt
                    this.updateLayoutState({
                        currentPrompt: workflowState.currentPrompt,
                        isWaitingForResponse:
                            workflowState.isWaitingForResponse,
                    })
                }
            )
        )

        // Subscribe to workflow step completion to update agent workflow
        this.subscriptions.add(
            this.workflowFacade.state$.subscribe((state: any) => {
                if (state?.currentStep) {
                    // Update agent workflow with current step
                    this.agentWorkflowService.updateCurrentStep(
                        state.currentStep
                    )

                    // Generate step instruction prompt
                    this.agentWorkflowService.generateStepInstructionPrompt()
                }
            })
        )
    }

    onAgentResponseSubmitted(event: {
        questionId: string
        response: string
    }): void {
        console.log('🎯 VKYC-SESSION: Agent response submitted:', event)
        this.agentWorkflowService.handleCustomerResponse(
            event.questionId,
            event.response
        )
    }

    onAgentResponseUpdated(event: {
        questionId: string
        response: string
    }): void {
        console.log('🎯 VKYC-SESSION: Agent response updated:', event)
        this.agentWorkflowService.handleCustomerResponse(
            event.questionId,
            event.response
        )
    }
}
