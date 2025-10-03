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
import { Router } from '@angular/router'
import {
    VkycSessionLayoutComponent,
    VkycLayoutState,
} from '../vkyc-session-layout/vkyc-session-layout.component'
import { ImageManipulatorComponent } from '../image-manipulator/image-manipulator.component'
// AccordionComponent removed - no longer used
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
import {
    ImageUploadService,
    ImageUploadRequest,
} from '../../services/image-upload.service'
import { NotificationService } from '../../services/notification.service'
import { VkycJourneyService } from '../../services/vkyc-journey.service'
import { StepHandlerRegistry } from '../../services/step-handlers/step-handler.registry'

@Component({
    selector: 'app-vkyc-session',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        VkycSessionLayoutComponent,
        ImageManipulatorComponent,
        // AccordionComponent removed
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

    // Auto-capture timeout management
    private autoCaptureTimeout: number | null = null
    private autoCaptureStartTime: number | null = null
    private readonly AUTO_CAPTURE_TIMEOUT_MS = 30000 // 30 seconds
    private readonly MANUAL_CAPTURE_NOTIFICATION_DELAY = 15000 // 15 seconds

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

    // Analysis data is now integrated into the KYC journey progress accordion

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
        private agentWorkflowService: AgentWorkflowService,
        private stepHandlerRegistry: StepHandlerRegistry,
        private imageUploadService: ImageUploadService,
        private router: Router,
        private notificationService: NotificationService,
        private journeyService: VkycJourneyService
    ) {
        console.log('🎯 VKYC-SESSION: Component initialized')
    }

    ngOnInit(): void {
        console.log('🎯 VKYC-SESSION: ngOnInit called')

        // Make the component globally accessible for debugging
        ;(window as any).vkycSession = this

        // Get room ID from session storage
        const sessionData = this.sessionStorage.getSessionData()
        if (sessionData) {
            this.roomId = sessionData.roomId
            console.log('🎯 VKYC-SESSION: Found session data:', sessionData)
        } else {
            console.log('🎯 VKYC-SESSION: No session data found')
        }

        this.initializePreCallFlow()
        this.initializeWorkflow()
        // Don't initialize agent loading until user clicks "Start Call"
    }

    ngOnDestroy(): void {
        console.log('🎯 VKYC-SESSION: Component destroying, cleaning up...')

        // Unsubscribe from all subscriptions
        this.subscriptions.unsubscribe()

        // Use the comprehensive cleanup method
        this.cleanupSession().catch((error) => {
            console.error(
                '🎯 VKYC-SESSION: Error during component destruction cleanup:',
                error
            )
        })
    }

    // Initialization methods
    private initializePreCallFlow(): void {
        console.log('🎯 VKYC-SESSION: Initializing pre-call flow')
        this.subscriptions.add(
            this.preCallFlowService.flowState$.subscribe((state) => {
                console.log(
                    '🎯 VKYC-SESSION: Pre-call flow state changed:',
                    state
                )
                const isComplete = state?.currentStep === 'complete'
                this.canStartCall = isComplete

                this.updateLayoutState({
                    showPreCallFlow: !isComplete,
                    preCallStep: isComplete ? undefined : state?.currentStep,
                    canStartCall: isComplete,
                })
                console.log(
                    '🎯 VKYC-SESSION: Updated layout state - showPreCallFlow:',
                    !isComplete,
                    'preCallStep:',
                    state?.currentStep,
                    'canStartCall:',
                    isComplete
                )
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
        // Subscribe to multiple face detection results
        this.subscriptions.add(
            this.captureFacade.multipleFaceDetection$.subscribe((result) => {
                console.log(
                    '🎯 VKYC-SESSION: Multiple face detection result received:',
                    result
                )
                this.updateLayoutState({
                    multipleFaceDetectionResult: result,
                })

                // Auto-capture if primary face is detected and auto-capture is enabled
                if (
                    result?.primaryFace &&
                    result.primaryFace.confidence > 0.7 && // Lowered threshold
                    result.primaryFace.steady &&
                    this.captureFacade.isAutoCaptureEnabled$.value &&
                    this.layoutState?.currentStep?.type === 'FRAME_CAPTURE'
                ) {
                    console.log(
                        '🎯 VKYC-SESSION: Auto-capture conditions met, triggering capture'
                    )
                    this.performAutoCapture()
                } else {
                    console.log(
                        '🎯 VKYC-SESSION: Auto-capture conditions not met:',
                        {
                            hasResult: !!result,
                            hasPrimaryFace: !!result?.primaryFace,
                            confidence: result?.primaryFace?.confidence,
                            steady: result?.primaryFace?.steady,
                            autoCaptureEnabled:
                                this.captureFacade.isAutoCaptureEnabled$.value,
                            currentStepType:
                                this.layoutState?.currentStep?.type,
                            totalFaces: result?.totalFaces,
                        }
                    )
                }
            })
        )

        // Subscribe to detection errors
        this.subscriptions.add(
            this.captureFacade.detectionError$.subscribe((error) => {
                if (error) {
                    console.error('🎯 VKYC-SESSION: Detection error:', error)
                    this.showErrorNotification(`Face detection error: ${error}`)
                }
            })
        )

        // Subscribe to detection status
        this.subscriptions.add(
            this.captureFacade.detectionStatus$.subscribe((status) => {
                console.log('🎯 VKYC-SESSION: Detection status:', status)
                if (status === 'error') {
                    this.showErrorNotification(
                        'Face detection failed to initialize'
                    )
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

        // Prevent multiple auto-captures
        if (this.captureFacade.isCapturing$.value) {
            console.log(
                '🎯 VKYC-SESSION: Already capturing, skipping auto-capture'
            )
            return
        }

        // Check if we're on a FRAME_CAPTURE step
        const currentStep = this.layoutState?.currentStep
        if (
            currentStep?.type !== 'FRAME_CAPTURE' ||
            currentStep?.status !== 'active'
        ) {
            console.log(
                '🎯 VKYC-SESSION: Not on active FRAME_CAPTURE step, skipping auto-capture'
            )
            return
        }

        // Clear auto-capture timeout since we're capturing
        this.clearAutoCaptureTimeout()

        this.captureFacade.setCapturing(true)

        // Get the video element from the meeting panel
        const videoElement = document.querySelector('video') as HTMLVideoElement
        if (
            videoElement &&
            videoElement.videoWidth > 0 &&
            videoElement.videoHeight > 0
        ) {
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
                            console.log(
                                '🎯 VKYC-SESSION: Auto-capture successful, submitting image'
                            )
                            this.submitCapture(blob)
                        }
                        this.captureFacade.setCapturing(false)
                    },
                    'image/jpeg',
                    0.9
                )
            } else {
                this.captureFacade.setCapturing(false)
            }
        } else {
            console.log('🎯 VKYC-SESSION: Video element not ready for capture')
            this.captureFacade.setCapturing(false)
        }
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
        console.log(
            '🎯 VKYC-SESSION: Starting continuous face detection on video element'
        )

        // Start continuous face detection regardless of current step
        // This allows users to see face detection throughout the call
        this.captureFacade.startFaceDetection(videoElement)
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
                    // Workflow is now initialized in startCall() method
                }
            })
        )

        this.meetingFacade.startAgentLoadingSequence(healthCheckData)
    }

    // Pre-call flow event handlers
    onInstructionsProceed(): void {
        // Update journey service with instructions completion
        this.journeyService.updateInstructionsStatus(true)

        this.preCallFlowService.proceedToConsent()
        this.updateLayoutState({ preCallStep: 'consent' })
    }

    onInstructionsReschedule(): void {
        console.log('🎯 VKYC-SESSION: User requested reschedule')
    }

    onInstructionsCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from instructions')
        this.cancelSession('Session cancelled from instructions')
    }

    onConsentProceed(): void {
        // Update journey service with consent completion
        this.journeyService.updateConsentStatus(true)

        this.preCallFlowService.proceedToHealthCheck()
        this.updateLayoutState({ preCallStep: 'health-check' })
    }

    onConsentCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from consent')
        this.cancelSession('Session cancelled from consent')
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

        // Update journey service with health check completion
        this.journeyService.updateHealthCheckData(healthCheckData)

        this.preCallFlowService.completeFlow()
        // Don't automatically join call, wait for user to click "Start Call"
    }

    onHealthCheckCancel(): void {
        console.log('🎯 VKYC-SESSION: User cancelled from health check')
        this.cancelSession('Session cancelled from health check')
    }

    onQuestionnaireRetry(): void {
        console.log('🎯 VKYC-SESSION: User requested questionnaire retry')
        // For now, treat retry as a cancel - could be enhanced later
        this.cancelSession('Session cancelled from questionnaire retry')
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

            // Initialize workflow immediately after call starts
            if (!this.workflowInitialized) {
                console.log('🎯 VKYC-SESSION: Initializing workflow...')
                this.workflowInitialized = true
                this.workflowFacade.init()
                this.initializeAgentWorkflow()
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

        // Clear any existing auto-capture timeout when step changes
        this.clearAutoCaptureTimeout()

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

        // Start auto-capture timeout for FRAME_CAPTURE steps
        this.startAutoCaptureTimeout(step)
    }

    private handleQuestionnaireStep(step: any): void {
        console.log('🎯 VKYC-SESSION: Handling questionnaire step:', step.id)

        // Update layout state to show questionnaire step
        if (this.layoutState) {
            this.layoutState.currentStep = step
            this.layoutState.captureType = 'QUESTIONNAIRE'
        }

        // Start the questionnaire questions
        const questions = step.data?.questions || []
        if (questions.length > 0) {
            console.log(
                '🎯 VKYC-SESSION: Starting questionnaire with',
                questions.length,
                'questions'
            )
            this.agentWorkflowService.startQuestionnaire(questions)
        } else {
            console.warn(
                '🎯 VKYC-SESSION: No questions found in questionnaire step'
            )
        }
    }

    private startAutoCaptureTimeout(step: any): void {
        // Clear any existing timeout
        this.clearAutoCaptureTimeout()

        console.log(
            '🎯 VKYC-SESSION: Starting auto-capture timeout for step:',
            step.id
        )

        this.autoCaptureStartTime = Date.now()

        // Set timeout for manual capture notification (15 seconds)
        setTimeout(() => {
            if (
                this.layoutState?.currentStep?.id === step.id &&
                this.layoutState?.currentStep?.status === 'active'
            ) {
                this.showManualCaptureNotification()
            }
        }, this.MANUAL_CAPTURE_NOTIFICATION_DELAY)

        // Set timeout for complete failure (30 seconds)
        this.autoCaptureTimeout = window.setTimeout(() => {
            if (
                this.layoutState?.currentStep?.id === step.id &&
                this.layoutState?.currentStep?.status === 'active'
            ) {
                this.handleAutoCaptureTimeout(step)
            }
        }, this.AUTO_CAPTURE_TIMEOUT_MS)
    }

    private clearAutoCaptureTimeout(): void {
        if (this.autoCaptureTimeout) {
            clearTimeout(this.autoCaptureTimeout)
            this.autoCaptureTimeout = null
        }
        this.autoCaptureStartTime = null
    }

    private showManualCaptureNotification(): void {
        console.log('🎯 VKYC-SESSION: Showing manual capture notification')
        this.showErrorNotification(
            'Auto-capture is taking longer than expected. You can capture manually using the camera button below.',
            'info'
        )
    }

    private handleAutoCaptureTimeout(step: any): void {
        console.log(
            '🎯 VKYC-SESSION: Auto-capture timeout reached for step:',
            step.id
        )

        this.showErrorNotification(
            'Auto-capture timed out. Please use the camera button to capture manually.',
            'warning'
        )

        // Clear the timeout
        this.clearAutoCaptureTimeout()
    }

    submitQuestionnaire(): void {
        console.log('🎯 VKYC-SESSION: Questionnaire submitted')

        // Get answers from the layout component (they're stored there)
        // For now, we'll proceed with the step completion
        // The actual answers handling can be improved later

        // Complete the questionnaire step
        this.proceedWithNextStep()
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

    async endSession(): Promise<void> {
        try {
            console.log('🎯 VKYC-SESSION: Ending session normally')

            // Show notification to user
            this.notificationService.showInfo(
                'Session Ended',
                'Your KYC session has been completed and you will be redirected to the home page.',
                5000
            )

            // Clean up all services and data
            await this.cleanupSession()

            // Navigate to home page after a short delay to show the notification
            setTimeout(() => {
                this.router.navigate(['/home'])
            }, 1000)
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error ending session:', error)
            // Still navigate to home even if cleanup fails
            this.router.navigate(['/home'])
        }
    }

    async cancelSession(
        reason: string = 'Session cancelled by user'
    ): Promise<void> {
        try {
            console.log('🎯 VKYC-SESSION: Cancelling session:', reason)

            // Show notification to user
            this.notificationService.showInfo(
                'Session Cancelled',
                'Your KYC session has been cancelled and you will be redirected to the home page.',
                5000
            )

            // Clean up all services and data
            await this.cleanupSession()

            // Navigate to home page after a short delay to show the notification
            setTimeout(() => {
                this.router.navigate(['/home'])
            }, 1000)
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error cancelling session:', error)
            // Still navigate to home even if cleanup fails
            this.router.navigate(['/home'])
        }
    }

    private async cleanupSession(): Promise<void> {
        try {
            console.log('🎯 VKYC-SESSION: Starting session cleanup...')

            // Stop all detection services
            this.captureFacade.stopDetection()

            // Clear auto-capture timeout
            this.clearAutoCaptureTimeout()

            // End the meeting if it's active
            try {
                await this.roomService.endSession()
                console.log('🎯 VKYC-SESSION: Room service cleaned up')
            } catch (error) {
                console.warn(
                    '🎯 VKYC-SESSION: Error ending room service:',
                    error
                )
            }

            // Leave the meeting
            try {
                this.meetingFacade.leaveCall()
                console.log('🎯 VKYC-SESSION: Meeting facade cleaned up')
            } catch (error) {
                console.warn('🎯 VKYC-SESSION: Error leaving meeting:', error)
            }

            // Clean up workflow facade
            try {
                this.workflowFacade.cleanup()
                console.log('🎯 VKYC-SESSION: Workflow facade cleaned up')
            } catch (error) {
                console.warn(
                    '🎯 VKYC-SESSION: Error cleaning up workflow facade:',
                    error
                )
            }

            // Reset pre-call flow
            try {
                this.preCallFlowService.resetFlow()
                console.log('🎯 VKYC-SESSION: Pre-call flow reset')
            } catch (error) {
                console.warn(
                    '🎯 VKYC-SESSION: Error resetting pre-call flow:',
                    error
                )
            }

            // Clear session storage (includes journey data)
            try {
                this.sessionStorage.clearAll()
                console.log(
                    '🎯 VKYC-SESSION: Session storage cleared (including journey data)'
                )
            } catch (error) {
                console.warn(
                    '🎯 VKYC-SESSION: Error clearing session storage:',
                    error
                )
            }

            // Analysis data is now integrated into KYC journey progress accordion

            // Reset component state
            this.workflowInitialized = false
            this.agentLoadingInitialized = false
            this.startCallInProgress = false
            this.healthCheckData = null
            this.questionnaireAnswers = {}
            this.roomId = ''

            console.log(
                '🎯 VKYC-SESSION: Session cleanup completed successfully'
            )
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Error during session cleanup:',
                error
            )
            throw error
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
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.showErrorModal = true
            this.cdRef.detectChanges()
        }, 0)
    }

    // loadAnalysisData method removed - analysis data is now integrated into KYC journey progress

    // Helper methods removed - analysis data is now integrated into KYC journey progress

    // Image manipulator event handlers
    async onImageProcessed(response: any): Promise<void> {
        console.log('🎯 VKYC-SESSION: Image processed:', response)

        // Check if this is a retake (showSyncResponse: false)
        if (!response.showSyncResponse) {
            console.log(
                '🎯 VKYC-SESSION: Retake requested - clearing image and closing popup'
            )
            this.onImageManipulatorRetake()
            return
        }

        // This is a successful submission
        console.log('🎯 VKYC-SESSION: Image submitted successfully')

        // Clean up image manipulator first
        this.showImageManipulator = false
        this.capturedImageBlob = null
        this.capturedImageBase64 = ''

        // Upload the selfie to backend and wait for completion
        try {
            await this.uploadSelfieToBackendAndProceed(response)
            console.log(
                '🎯 VKYC-SESSION: Selfie upload and step progression completed'
            )
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Failed to upload selfie and proceed:',
                error
            )
            this.showErrorNotification(
                'Failed to upload selfie. Please try again.'
            )
        }
    }

    private async uploadSelfieToBackendAndProceed(
        imageData: any
    ): Promise<void> {
        const sessionData = this.sessionStorage.getSessionData()
        if (!sessionData?.roomId) {
            throw new Error('No session data available')
        }

        const currentStep = this.layoutState?.currentStep
        const stepId =
            currentStep?.id || currentStep?.sub_action_ref || 'selfie_capture'

        // Determine capture type from current step
        const captureType =
            currentStep?.frame_capture_type ||
            currentStep?.data?.captureType ||
            'FACE_CAPTURE'

        const uploadData: ImageUploadRequest = {
            image_data: imageData.base64 || imageData,
            step_id: stepId,
            capture_type: captureType,
            timestamp: new Date().toISOString(),
        }

        console.log('🎯 VKYC-SESSION: Uploading image to backend')

        // Upload image and wait for completion
        const uploadResult = await this.imageUploadService
            .uploadImage(sessionData.roomId, uploadData)
            .toPromise()

        console.log('🎯 VKYC-SESSION: Image upload result:', uploadResult)

        // Handle analysis results
        if (uploadResult?.analysis_result) {
            await this.handleImageAnalysisResult(
                uploadResult.analysis_result,
                captureType
            )

            // Agent notification is now handled automatically by the backend in upload-selfie endpoint
        }

        // Now proceed with step completion
        await this.proceedWithNextStep()
    }

    private uploadSelfieToBackend(imageData: any): void {
        const sessionData = this.sessionStorage.getSessionData()
        if (!sessionData?.roomId) {
            console.error('🎯 VKYC-SESSION: No session data available')
            return
        }

        const currentStep = this.layoutState?.currentStep
        const stepId =
            currentStep?.id || currentStep?.sub_action_ref || 'selfie_capture'

        // Determine capture type from current step
        const captureType =
            currentStep?.frame_capture_type ||
            currentStep?.data?.captureType ||
            'FACE_CAPTURE'

        const uploadData: ImageUploadRequest = {
            image_data: imageData.base64 || imageData,
            step_id: stepId,
            capture_type: captureType,
            timestamp: new Date().toISOString(),
        }

        console.log('🎯 VKYC-SESSION: Uploading image to backend')

        // Use service to upload image
        this.imageUploadService
            .uploadImage(sessionData.roomId, uploadData)
            .subscribe({
                next: (result) => {
                    console.log('🎯 VKYC-SESSION: Image upload result:', result)

                    // Check if the upload was successful
                    if (result.status === 'error') {
                        console.error(
                            '🎯 VKYC-SESSION: Image processing failed:',
                            result.error
                        )
                        this.showErrorNotification(
                            `Image processing failed: ${result.error}`
                        )

                        // Update journey service with failed status
                        const currentStep = this.layoutState?.currentStep
                        if (currentStep) {
                            this.journeyService.updateFrameCaptureStatus(
                                currentStep.id ||
                                    currentStep.sub_action_ref ||
                                    'frame_capture',
                                'failed',
                                {
                                    captureType,
                                    error: result.error,
                                    analysisResult: result.analysis_result,
                                }
                            )
                        }
                        return
                    }

                    // Only proceed if status is success
                    if (result.status === 'success') {
                        // Update journey service with frame capture completion
                        const currentStep = this.layoutState?.currentStep
                        if (currentStep) {
                            this.journeyService.updateFrameCaptureStatus(
                                currentStep.id ||
                                    currentStep.sub_action_ref ||
                                    'frame_capture',
                                'completed',
                                {
                                    captureType,
                                    analysisResult: result.analysis_result,
                                    qualityScore:
                                        result.analysis_result?.quality_score,
                                }
                            )
                        }

                        // Handle analysis results
                        if (result.analysis_result) {
                            this.handleImageAnalysisResult(
                                result.analysis_result,
                                captureType
                            )

                            // Agent notification is now handled automatically by the backend in upload-selfie endpoint
                        }
                    } else {
                        console.warn(
                            '🎯 VKYC-SESSION: Unknown response status:',
                            result.status
                        )
                        this.showErrorNotification(
                            'Unknown response from server'
                        )
                    }
                },
                error: (error) => {
                    console.error(
                        '🎯 VKYC-SESSION: Image upload failed:',
                        error
                    )
                    this.showErrorNotification('Failed to upload image')

                    // Update journey service with failed status
                    const currentStep = this.layoutState?.currentStep
                    if (currentStep) {
                        this.journeyService.updateFrameCaptureStatus(
                            currentStep.id ||
                                currentStep.sub_action_ref ||
                                'frame_capture',
                            'failed',
                            {
                                captureType,
                                error: error.message || 'Upload failed',
                            }
                        )
                    }
                },
            })
    }

    private async handleImageAnalysisResult(
        analysisResult: any,
        captureType: string
    ): Promise<void> {
        console.log(
            '🎯 VKYC-SESSION: Handling image analysis result:',
            analysisResult
        )

        if (captureType === 'FACE_CAPTURE') {
            await this.handleFaceAnalysisResult(analysisResult)
        } else if (captureType === 'DOCUMENT_CAPTURE') {
            await this.handleDocumentAnalysisResult(analysisResult)
        }
    }

    private async handleFaceAnalysisResult(analysisResult: any): Promise<void> {
        console.log('🎯 VKYC-SESSION: Face analysis result:', analysisResult)

        // Only show error if API status is not 200 (success) or if there's an explicit error
        if (
            (analysisResult.status && analysisResult.status !== 200) ||
            analysisResult.error
        ) {
            console.error(
                '🎯 VKYC-SESSION: Face analysis error:',
                analysisResult.error || 'API returned non-200 status'
            )
            this.showErrorNotification(
                'Image processing failed. Please try again.'
            )
            return
        }

        // Store face analysis results regardless of validation
        this.layoutState.currentStep = {
            ...this.layoutState.currentStep,
            analysisResult: analysisResult,
        }

        // Log quality warnings but don't block the process
        if (
            analysisResult.quality_score &&
            analysisResult.quality_score < 0.5
        ) {
            console.warn(
                '🎯 VKYC-SESSION: Low quality image detected, but proceeding'
            )
        }
    }

    private async handleDocumentAnalysisResult(
        analysisResult: any
    ): Promise<void> {
        console.log(
            '🎯 VKYC-SESSION: Document analysis result:',
            analysisResult
        )

        // Only show error if API status is not 200 (success)
        // Don't validate document content - let the user proceed with any analysis result
        if (analysisResult.status && analysisResult.status !== 200) {
            this.showErrorNotification(
                'Document upload failed. Please try again.'
            )
            return
        }

        // Store document analysis results regardless of validation
        this.layoutState.currentStep = {
            ...this.layoutState.currentStep,
            analysisResult: analysisResult,
        }

        // Show extracted information to user if available
        if (analysisResult.extracted_fields) {
            this.showDocumentExtractedInfo(analysisResult.extracted_fields)
        }
    }

    private showDocumentExtractedInfo(extractedFields: any): void {
        console.log(
            '🎯 VKYC-SESSION: Document extracted fields:',
            extractedFields
        )

        // TODO: Show extracted information in a modal or notification
        // For now, just log it
        const message =
            `Document processed successfully!\n` +
            `Type: ${extractedFields.document_type || 'Unknown'}\n` +
            `Number: ${extractedFields.pan_number || 'N/A'}\n` +
            `Name: ${extractedFields.name || 'N/A'}`

        // You could show this in a modal or notification
        console.log('🎯 VKYC-SESSION: Extracted info:', message)
    }

    // Removed notifyAgentAboutAnalysis method - agent notification is now handled automatically by backend

    /**
     * Handle questionnaire completion
     */
    async handleQuestionnaireCompletion(
        stepId: string,
        answers: any
    ): Promise<void> {
        console.log(
            '🎯 VKYC-SESSION: Handling questionnaire completion:',
            stepId
        )

        try {
            // Update journey service with questionnaire completion
            this.journeyService.updateQuestionnaireStatus(stepId, 'completed', {
                answers,
                questionsAnswered: Object.keys(answers).length,
                totalQuestions: Object.keys(answers).length,
            })

            // Complete the current step in workflow
            await this.workflowFacade.completeCurrentStep()

            // Proceed with next step
            await this.proceedWithNextStep()
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Failed to complete questionnaire step:',
                error
            )
        }
    }

    private async proceedWithNextStep(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Proceeding with next step')

        try {
            // Complete the current step in workflow
            await this.workflowFacade.completeCurrentStep()
            console.log('🎯 VKYC-SESSION: Current step completed in workflow')

            // Notify the agent about step completion
            await this.notifyAgentStepCompletion()

            // The workflow state subscription will automatically update the UI
            // No need to manually update layout state here
            console.log(
                '🎯 VKYC-SESSION: Step completion handled by workflow state subscription'
            )
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Failed to proceed with next step:',
                error
            )
            this.showErrorNotification('Failed to proceed with next step')
        }
    }

    private async notifyAgentStepCompletion(): Promise<void> {
        if (!this.layoutState?.currentStep) return

        const currentStep = this.layoutState.currentStep
        const stepId = currentStep.id || currentStep.sub_action_ref || 'unknown'

        console.log('🎯 VKYC-SESSION: Notifying agent about step completion')

        try {
            // Only notify the agent workflow service - don't call any API
            // The actual step completion is handled by workflowFacade.completeCurrentStep()
            this.agentWorkflowService.handleStepCompletion(currentStep, null)

            console.log(
                `🎯 VKYC-SESSION: Notified agent about step completion: ${stepId}`
            )
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Failed to notify agent:', error)
        }
    }

    private async handleWorkflowCompletion(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Workflow completed, ending session')

        // Update UI to show completion
        this.updateLayoutState({
            phase: 'post',
            showPreCallFlow: false,
        })

        // End the session after a short delay
        setTimeout(() => {
            this.endSession()
        }, 3000)
    }

    onImageManipulatorError(error: string): void {
        console.error('🎯 VKYC-SESSION: Image manipulator error:', error)

        // Don't show error modal for certain types of errors
        if (
            error.includes('Sub action ID is required') ||
            error.includes('No valid step ID found')
        ) {
            console.warn(
                '🎯 VKYC-SESSION: Suppressing error modal for step ID error'
            )
            return
        }

        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.showErrorModal = true
            this.errorMessage = error
            this.cdRef.detectChanges()
        }, 0)
    }

    onImageManipulatorClose(): void {
        console.log('🎯 VKYC-SESSION: Image manipulator closed')
        this.showImageManipulator = false
        this.capturedImageBlob = null
        this.capturedImageBase64 = ''

        // Analysis data is now integrated into the KYC journey progress accordion
    }

    onImageManipulatorRetake(): void {
        console.log(
            '🎯 VKYC-SESSION: Retake requested - clearing image and closing popup'
        )
        // Clear the captured image data
        this.capturedImageBlob = null
        this.capturedImageBase64 = ''

        // Close the image manipulator popup
        this.showImageManipulator = false

        // The user can now capture a new image by clicking the capture button again
        console.log('🎯 VKYC-SESSION: Ready for new capture')
    }

    getImageManipulatorConfig(): any {
        // Get the current step
        const currentStep = this.layoutState?.currentStep

        // Determine capture type from step data
        const captureType =
            currentStep?.data?.captureType ||
            currentStep?.data?.frame_capture_type ||
            currentStep?.frame_capture_type ||
            this.layoutState?.captureType

        // Get step ID from multiple possible sources
        const stepId =
            currentStep?.id ||
            currentStep?.sub_action_ref ||
            currentStep?.data?.sub_action_ref ||
            'unknown-step'

        console.log('🎯 VKYC-SESSION: Image manipulator config:', {
            currentStep: currentStep,
            captureType: captureType,
            stepId: stepId,
            layoutState: this.layoutState,
        })

        // Validate that we have a step ID
        if (!stepId || stepId === 'unknown-step') {
            console.error(
                '🎯 VKYC-SESSION: No valid step ID found for image manipulator'
            )
            throw new Error(
                'No valid step ID found. Please ensure you are in an active capture step.'
            )
        }

        return {
            base64: this.capturedImageBase64,
            subActionId: stepId,
            mode: captureType === 'FACE_CAPTURE' ? 'selfie' : 'document',
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

        // Check if we have a valid current step
        const currentStep = this.layoutState?.currentStep
        if (!currentStep) {
            console.warn(
                '🎯 VKYC-SESSION: No current step available for capture'
            )

            // Try to initialize workflow if not already done
            if (!this.workflowInitialized) {
                console.log(
                    '🎯 VKYC-SESSION: Attempting to initialize workflow...'
                )
                this.workflowInitialized = true
                this.workflowFacade.init()
                this.initializeAgentWorkflow()

                // Wait a moment for workflow to initialize, then try again
                setTimeout(() => {
                    if (this.layoutState?.currentStep) {
                        console.log(
                            '🎯 VKYC-SESSION: Workflow initialized, retrying capture...'
                        )
                        this.onCapturePhoto()
                    } else {
                        this.showErrorNotification(
                            'Workflow is still initializing. Please wait a moment and try again.'
                        )
                    }
                }, 1000)
                return
            }

            this.showErrorNotification(
                'No active step available. Please wait for the workflow to initialize.'
            )
            return
        }

        // Use the captureImage method from meeting service
        this.meetingService
            .captureImage()
            .then((imageData: string | null) => {
                if (imageData) {
                    console.log('🎯 VKYC-SESSION: Photo captured successfully')
                    // Convert base64 to blob and show image manipulator
                    this.showImageManipulatorFromBase64(imageData)
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

    private showImageManipulatorFromBase64(base64Data: string): void {
        console.log(
            '🎯 VKYC-SESSION: Showing image manipulator from base64 data'
        )

        // Store the base64 data
        this.capturedImageBase64 = base64Data

        // Convert base64 to blob for storage
        const byteCharacters = atob(base64Data.split(',')[1])
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        this.capturedImageBlob = new Blob([byteArray], { type: 'image/jpeg' })

        // Show the image manipulator
        this.showImageManipulator = true
        console.log(
            '🎯 VKYC-SESSION: Image manipulator opened from capture button'
        )
    }

    private showErrorNotification(
        message: string,
        type: 'error' | 'warning' | 'info' = 'error'
    ): void {
        // TODO: Implement proper notification system
        // For now, we'll use the existing error modal
        this.errorMessage = message

        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.showErrorModal = true
            this.cdRef.detectChanges()
        }, 0)

        if (type === 'error') {
            console.error('🎯 VKYC-SESSION: Error notification:', message)
        } else if (type === 'warning') {
            console.warn('🎯 VKYC-SESSION: Warning notification:', message)
        } else {
            console.log('🎯 VKYC-SESSION: Info notification:', message)
        }
    }

    private initializeAgentWorkflow(): void {
        console.log('🎯 VKYC-SESSION: Initializing agent workflow')

        // Subscribe to workflow steps to initialize agent workflow
        this.subscriptions.add(
            this.workflowFacade.state$.subscribe((state: any) => {
                if (state?.steps && state.steps.length > 0) {
                    console.log(
                        '🎯 VKYC-SESSION: Initializing agent workflow with steps:',
                        state.steps
                    )
                    // Initialize agent workflow with the steps
                    this.agentWorkflowService.initializeAgentWorkflow(
                        state.steps
                    )

                    // Update layout state with workflow steps and current step
                    const currentStep = state.currentStep
                    const captureType =
                        currentStep?.data?.captureType ||
                        currentStep?.data?.frame_capture_type ||
                        currentStep?.frame_capture_type

                    this.updateLayoutState({
                        workflowSteps: state.steps,
                        currentStep: currentStep,
                        captureType: captureType,
                    })

                    console.log(
                        '🎯 VKYC-SESSION: Updated layout state with current step:',
                        state.currentStep
                    )
                }
            })
        )

        // Subscribe to agent workflow state for UI updates
        this.subscriptions.add(
            this.agentWorkflowService.workflowState$.subscribe(
                (workflowState) => {
                    console.log(
                        '🎯 VKYC-SESSION: Agent workflow state updated:',
                        workflowState
                    )
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

        // If this is a questionnaire step, also handle it in the questionnaire handler
        const currentStep = this.layoutState?.currentStep
        if (currentStep?.type === 'QUESTIONNAIRE') {
            // Get the questionnaire handler and submit the answer
            const questionnaireHandler =
                this.stepHandlerRegistry.getHandler(currentStep)
            if (
                questionnaireHandler &&
                'answerQuestion' in questionnaireHandler
            ) {
                ;(questionnaireHandler as any).answerQuestion(
                    event.questionId,
                    event.response
                )
            }
        }
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

    onAgentProceed(): void {
        console.log('🎯 VKYC-SESSION: Agent proceed button clicked')

        // Check if we're on a FRAME_CAPTURE step and trigger manual capture
        const currentStep = this.layoutState?.currentStep
        if (
            currentStep?.type === 'FRAME_CAPTURE' &&
            currentStep?.status === 'active'
        ) {
            console.log(
                '🎯 VKYC-SESSION: Triggering manual capture from agent proceed button'
            )
            this.onCapturePhoto()
        } else {
            console.log(
                '🎯 VKYC-SESSION: Not on FRAME_CAPTURE step, proceeding with next step'
            )
            // For other step types, just proceed to next step
            this.workflowFacade.completeCurrentStep()
        }
    }

    onNextStep(): void {
        console.log('🎯 VKYC-SESSION: Next step requested from layout')
        const currentStep = this.layoutState?.currentStep

        if (!currentStep) {
            // Start the workflow if no current step
            console.log('🎯 VKYC-SESSION: Starting workflow')
            if (!this.workflowInitialized) {
                this.workflowInitialized = true
                this.workflowFacade.init()
                this.initializeAgentWorkflow()
            }
            return
        }

        // For manual flow, allow user to proceed with button clicks
        // Only validate for image capture steps that require actual completion
        if (
            currentStep.type === 'FRAME_CAPTURE' &&
            !this.isCurrentStepCompleted(currentStep)
        ) {
            this.showErrorNotification(
                'Please complete the current step before proceeding.'
            )
            return
        }

        // Handle different step types
        switch (currentStep.type) {
            case 'QUESTIONNAIRE':
                // For questionnaire, mark as completed and move to next step
                console.log(
                    '🎯 VKYC-SESSION: Completing questionnaire step manually'
                )
                this.workflowFacade.completeCurrentStep()
                break
            case 'FRAME_CAPTURE':
                // For image capture, the camera will be opened by the layout component
                console.log(
                    '🎯 VKYC-SESSION: Image capture step - camera will be opened'
                )
                break
            default:
                // For other steps, just complete and move to next
                console.log(
                    '🎯 VKYC-SESSION: Completing step:',
                    currentStep.type
                )
                this.workflowFacade.completeCurrentStep()
                break
        }
    }

    onQuestionnaireCompleted(answers: { [key: string]: string }): void {
        console.log(
            '🎯 VKYC-SESSION: Questionnaire completed with answers:',
            answers
        )

        try {
            // Store the questionnaire completion in session storage
            this.sessionStorage.saveStepData({
                stepId: 'questionnaire-answers',
                stepType: 'questionnaire',
                data: answers,
                timestamp: Date.now(),
                success: true,
            })

            // Complete the questionnaire step manually
            this.workflowFacade.completeCurrentStep()

            console.log(
                '🎯 VKYC-SESSION: Questionnaire step completed manually, moving to next step'
            )
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Failed to complete questionnaire:',
                error
            )
            this.showErrorNotification(
                'Failed to complete questionnaire. Please try again.'
            )
        }
    }

    onStartImageCapture(): void {
        console.log('🎯 VKYC-SESSION: Start image capture requested')
        this.onCapturePhoto()
    }

    onFinishKyc(): void {
        console.log('🎯 VKYC-SESSION: Finish KYC requested')

        // Validate that all required steps are completed
        if (this.validateAllStepsCompleted()) {
            this.endSession()
        } else {
            this.showErrorNotification(
                'Please complete all required steps before finishing.'
            )
        }
    }

    private validateAllStepsCompleted(): boolean {
        try {
            const currentState = this.workflowFacade.state$.value
            if (!currentState?.steps) return false

            // Check if all required steps are completed
            const requiredSteps = currentState.steps.filter(
                (step) =>
                    step.type === 'QUESTIONNAIRE' ||
                    (step.type === 'FRAME_CAPTURE' && !step.subAction.optional)
            )

            return requiredSteps.every(
                (step) =>
                    step.status === 'completed' ||
                    this.sessionStorage.getStepData(step.id)?.success === true
            )
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error validating steps:', error)
            return false
        }
    }

    private isCurrentStepCompleted(step: any): boolean {
        try {
            // Check if step is marked as completed
            if (step.status === 'completed') return true

            // Check if step has analysis results (for image capture steps)
            if (step.analysisResult) return true

            // Check if step data is saved in session storage
            const stepData = this.sessionStorage.getStepData(step.id)
            if (stepData?.success === true) return true

            // For questionnaire, check if answers are saved
            if (step.type === 'QUESTIONNAIRE') {
                const questionnaireData = this.sessionStorage.getStepData(
                    'questionnaire-answers'
                )
                return questionnaireData?.success === true
            }

            // For manual flow, allow progression if user explicitly clicks next
            // This makes the flow more user-controlled
            return false
        } catch (error) {
            console.error(
                '🎯 VKYC-SESSION: Error checking step completion:',
                error
            )
            return false
        }
    }

    /**
     * Manually update journey progress when a step is completed via backend API
     */
    updateJourneyProgress(stepId: string, data?: Record<string, any>): void {
        console.log(
            `🎯 VKYC-SESSION: Updating journey progress for step ${stepId}`
        )
        this.journeyService.markStepCompleted(stepId, data)
    }
}
