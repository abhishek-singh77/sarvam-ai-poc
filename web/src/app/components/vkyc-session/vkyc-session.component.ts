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
import { Subscription } from 'rxjs'
import { take } from 'rxjs/operators'
import { HttpClient } from '@angular/common/http'
// Removed MatDialog import - using custom modal approach
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { MediaService } from '../../services/media.service'
import { MeetingService } from '../../services/meeting.service'
import { NotificationService } from '../../services/notification.service'
import { RoomCreateResponse, JoinConfig } from '../../interfaces/room.interface'
import {
    ImageManipulatorComponent,
    ImageInfo,
    UploadCroppedImageResponse,
} from '../image-manipulator/image-manipulator.component'

interface WorkflowStep {
    id: string
    type: string
    title: string
    description: string
    status: 'pending' | 'active' | 'completed'
    data: any
    instructions?: string
    questions?: any[]
    document_types?: string[]
}

@Component({
    selector: 'app-vkyc-session',
    standalone: true,
    imports: [CommonModule, FormsModule, ImageManipulatorComponent],
    templateUrl: './vkyc-session.component.html',
    styleUrls: ['./vkyc-session.component.css'],
})
export class VkycSessionComponent implements OnInit, OnDestroy {
    @ViewChild('userVideoRef') userVideoRef!: ElementRef<HTMLVideoElement>
    @ViewChild('agentVideoRef') agentVideoRef!: ElementRef<HTMLVideoElement>
    @ViewChild('agentAudioRef') agentAudioRef!: ElementRef<HTMLAudioElement>
    @Output() sessionEnded = new EventEmitter<void>()

    // Session state
    roomData: RoomCreateResponse | null = null
    joinConfig: JoinConfig | null = null
    participants: any[] = []
    status: string = 'Ready'
    logs: string[] = []
    roomId: string = ''
    hasMedia: boolean = false
    mediaError: string | null = null
    isLoading: boolean = false

    // Video streams
    hasAgentVideo: boolean = false
    isAgentSpeaking: boolean = false

    // Workflow
    workflowSteps: WorkflowStep[] = []
    currentStep: WorkflowStep | null = null
    questionnaireAnswers: { [key: string]: any } = {}

    // Media controls
    isCameraEnabled: boolean = false
    isMicrophoneEnabled: boolean = false
    isLocalAudioEnabled: boolean = false // For hearing yourself

    // Image handling
    imageLoadError: boolean = false
    showImageManipulator: boolean = false
    imageManipulatorData: {
        base64: string
        subActionId: string
        mode: 'selfie' | 'document' | 'FRONT_BACK'
        frontImage: Blob
    } | null = null

    private subscriptions: Subscription = new Subscription()
    private agentSpeakingInterval: any = null

    constructor(
        private roomService: EnterpriseRoomService,
        private mediaService: MediaService,
        private meetingService: MeetingService,
        private notificationService: NotificationService,
        private http: HttpClient,
        private cdRef: ChangeDetectorRef
    ) {
        console.log('🎯 VKYC-SESSION: Component initialized')
    }

    ngOnInit(): void {
        console.log('🎯 VKYC-SESSION: Component ngOnInit started')

        // Subscribe to room data changes
        this.subscriptions.add(
            this.roomService.roomData$.subscribe((data) => {
                console.log('🎯 VKYC-SESSION: Room data updated:', data)
                this.roomData = data
                this.roomId = data?.roomId || ''
                if (data) {
                    this.loadWorkflow()
                }
            })
        )

        // Subscribe to status changes
        this.subscriptions.add(
            this.roomService.status$.subscribe((status) => {
                console.log('🎯 VKYC-SESSION: Status updated:', status)
                this.status = status
                this.isLoading = this.isStatusLoading(status)
            })
        )

        // Subscribe to logs changes
        this.subscriptions.add(
            this.roomService.logs$.subscribe((logs) => {
                console.log(
                    '🎯 VKYC-SESSION: Logs updated:',
                    logs.length,
                    'entries'
                )
                this.logs = logs
            })
        )

        // Subscribe to media state changes
        this.subscriptions.add(
            this.mediaService.mediaState$.subscribe((state) => {
                console.log('🎯 VKYC-SESSION: Media state updated:', state)
                this.hasMedia = state.hasMedia
                this.mediaError = state.error
                this.updateMediaControls()

                // If media is available, set up video preview after render
                if (state.hasMedia) {
                    this.setupVideoPreviewAfterRender()
                }
            })
        )

        // Check if we already have room data (for page refresh scenarios)
        // We need to subscribe to get the current value since roomData$ is an Observable
        this.roomService.roomData$
            .pipe(take(1))
            .subscribe((currentRoomData) => {
                if (currentRoomData) {
                    console.log(
                        '🎯 VKYC-SESSION: Found existing room data on init:',
                        currentRoomData.roomId
                    )
                    this.roomData = currentRoomData
                    this.roomId = currentRoomData.roomId
                    this.loadWorkflow()
                }
            })

        // Subscribe to meeting participants
        this.subscriptions.add(
            this.meetingService.participants$.subscribe((participants) => {
                console.log(
                    '🎯 VKYC-SESSION: Participants updated:',
                    participants.length,
                    'participants'
                )
                this.participants = participants
                this.updateAgentVideoState()
            })
        )

        // Subscribe to remote stream (agent audio/video)
        this.subscriptions.add(
            this.meetingService.remoteStream$.subscribe((stream) => {
                if (stream) {
                    console.log(
                        '🎯 VKYC-SESSION: Remote stream received:',
                        stream.kind
                    )
                    this.handleRemoteStream(stream)
                } else {
                    console.log('🎯 VKYC-SESSION: Remote stream cleared')
                    this.clearRemoteStream()
                }
            })
        )

        // Initialize media controls
        this.updateMediaControls()

        // Start agent speaking simulation (for demo purposes)
        this.startAgentSpeakingSimulation()

        console.log('🎯 VKYC-SESSION: Component ngOnInit completed')
    }

    ngOnDestroy(): void {
        console.log('🎯 VKYC-SESSION: Component destroying...')
        this.subscriptions.unsubscribe()
        this.stopAgentSpeakingSimulation()
        this.cleanup()
        console.log('🎯 VKYC-SESSION: Component destroyed')
    }

    // Media Controls
    async enableMedia(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Enabling media access...')
        this.showInfo(
            'Media Access',
            'Requesting camera and microphone permissions...'
        )

        try {
            const success = await this.mediaService.requestMediaAccess()
            console.log('🎯 VKYC-SESSION: Media access result:', success)

            if (success) {
                console.log('🎯 VKYC-SESSION: Media access successful')
                this.showSuccess(
                    'Media Access',
                    'Camera and microphone enabled successfully!'
                )
            } else {
                this.showError(
                    'Permission Denied',
                    'Camera and microphone access denied. Please allow permissions and try again.'
                )
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Media access error:', error)
            this.showError(
                'Media Error',
                'Failed to access camera and microphone. Please check your device permissions.'
            )
        }
    }

    private setupVideoPreviewAfterRender(): void {
        console.log('🎯 VKYC-SESSION: Setting up video preview after render...')

        // Use setTimeout to wait for the next change detection cycle
        setTimeout(async () => {
            try {
                await this.setupUserVideoStream()
            } catch (error) {
                console.error(
                    '🎯 VKYC-SESSION: Error setting up video preview:',
                    error
                )
            }
        }, 100)
    }

    private async setupUserVideoStream(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Setting up user video stream...')

        const stream = await this.mediaService.getMediaStream()
        if (!stream) {
            throw new Error('No media stream available')
        }

        if (!this.userVideoRef) {
            throw new Error('User video element not available')
        }

        console.log(
            '🎯 VKYC-SESSION: Stream and video element available, configuring...'
        )
        console.log('🎯 VKYC-SESSION: Stream details:', {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
        })

        // Clear any existing stream
        this.userVideoRef.nativeElement.srcObject = null

        // Set the new stream
        this.userVideoRef.nativeElement.srcObject = stream
        console.log('🎯 VKYC-SESSION: Stream assigned to video element')

        this.configureUserVideoElement()
        this.setupUserVideoEventHandlers()

        // Force play if metadata is already loaded
        if (this.userVideoRef.nativeElement.readyState >= 1) {
            console.log('🎯 VKYC-SESSION: Video ready, starting playback...')
            await this.userVideoRef.nativeElement.play()
        } else {
            console.log(
                '🎯 VKYC-SESSION: Video not ready yet, waiting for metadata...'
            )
        }
    }

    private configureUserVideoElement(): void {
        if (!this.userVideoRef) return

        console.log('🎯 VKYC-SESSION: Configuring user video element...')

        const videoElement = this.userVideoRef.nativeElement
        videoElement.muted = true
        videoElement.playsInline = true
        videoElement.autoplay = true

        console.log('🎯 VKYC-SESSION: User video element configured:', {
            muted: videoElement.muted,
            playsInline: videoElement.playsInline,
            autoplay: videoElement.autoplay,
            readyState: videoElement.readyState,
            srcObject: !!videoElement.srcObject,
        })
    }

    private setupUserVideoEventHandlers(): void {
        if (!this.userVideoRef) return

        console.log('🎯 VKYC-SESSION: Setting up user video event handlers...')

        this.userVideoRef.nativeElement.onloadedmetadata = () => {
            console.log(
                '🎯 VKYC-SESSION: User video metadata loaded, starting playback...'
            )
            this.userVideoRef.nativeElement.play().catch((error: any) => {
                console.error(
                    '🎯 VKYC-SESSION: Error playing user video:',
                    error
                )
            })
        }

        this.userVideoRef.nativeElement.oncanplay = () => {
            console.log('🎯 VKYC-SESSION: User video can play')
        }

        this.userVideoRef.nativeElement.onplay = () => {
            console.log('🎯 VKYC-SESSION: User video started playing')
        }

        this.userVideoRef.nativeElement.onerror = (error: any) => {
            console.error('🎯 VKYC-SESSION: User video error:', error)
        }
    }

    private handleRemoteStream(stream: any): void {
        console.log('🎯 VKYC-SESSION: Handling remote stream:', stream.kind)

        if (stream.kind === 'audio') {
            this.setupAgentAudio(stream)
        } else if (stream.kind === 'video') {
            this.setupAgentVideo(stream)
        }
    }

    private setupAgentAudio(stream: any): void {
        console.log('🎯 VKYC-SESSION: Setting up agent audio...')

        if (!this.agentAudioRef) {
            console.error('🎯 VKYC-SESSION: Agent audio element not available')
            return
        }

        // Create a MediaStream from the track
        const mediaStream = new MediaStream()
        mediaStream.addTrack(stream.track)

        // Set the stream to the audio element
        this.agentAudioRef.nativeElement.srcObject = mediaStream

        // Configure audio element
        this.agentAudioRef.nativeElement.autoplay = true
        this.agentAudioRef.nativeElement.muted = false

        console.log('🎯 VKYC-SESSION: Agent audio stream configured')

        // Play the audio
        this.agentAudioRef.nativeElement
            .play()
            .then(() => {
                console.log('🎯 VKYC-SESSION: Agent audio started playing')
            })
            .catch((error: any) => {
                console.error(
                    '🎯 VKYC-SESSION: Error playing agent audio:',
                    error
                )
            })
    }

    private setupAgentVideo(stream: any): void {
        console.log('🎯 VKYC-SESSION: Setting up agent video...')

        if (!this.agentVideoRef) {
            console.error('🎯 VKYC-SESSION: Agent video element not available')
            return
        }

        // Create a MediaStream from the track
        const mediaStream = new MediaStream()
        mediaStream.addTrack(stream.track)

        // Set the stream to the video element
        this.agentVideoRef.nativeElement.srcObject = mediaStream

        // Configure video element
        this.agentVideoRef.nativeElement.autoplay = true
        this.agentVideoRef.nativeElement.muted = true
        this.agentVideoRef.nativeElement.playsInline = true

        console.log('🎯 VKYC-SESSION: Agent video stream configured')

        // Play the video
        this.agentVideoRef.nativeElement
            .play()
            .then(() => {
                console.log('🎯 VKYC-SESSION: Agent video started playing')
                this.hasAgentVideo = true
            })
            .catch((error: any) => {
                console.error(
                    '🎯 VKYC-SESSION: Error playing agent video:',
                    error
                )
            })
    }

    private clearRemoteStream(): void {
        console.log('🎯 VKYC-SESSION: Clearing remote stream...')

        if (this.agentAudioRef) {
            this.agentAudioRef.nativeElement.srcObject = null
        }

        if (this.agentVideoRef) {
            this.agentVideoRef.nativeElement.srcObject = null
            this.hasAgentVideo = false
        }
    }

    async toggleCamera(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Toggling camera...')
        try {
            const enabled = await this.mediaService.toggleCamera()
            this.isCameraEnabled = enabled
            console.log('🎯 VKYC-SESSION: Camera toggled:', enabled)

            if (enabled) {
                this.showInfo('Camera', 'Camera turned on')
            } else {
                this.showInfo('Camera', 'Camera turned off')
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error toggling camera:', error)
            this.showError(
                'Camera Error',
                'Failed to toggle camera. Please try again.'
            )
        }
    }

    async toggleMicrophone(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Toggling microphone...')
        try {
            const enabled = await this.mediaService.toggleMicrophone()
            this.isMicrophoneEnabled = enabled
            console.log('🎯 VKYC-SESSION: Microphone toggled:', enabled)

            if (enabled) {
                this.showInfo('Microphone', 'Microphone turned on')
            } else {
                this.showInfo('Microphone', 'Microphone turned off')
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error toggling microphone:', error)
            this.showError(
                'Microphone Error',
                'Failed to toggle microphone. Please try again.'
            )
        }
    }

    async toggleLocalAudio(): Promise<void> {
        console.log(
            '🎯 VKYC-SESSION: Toggling local audio (hearing yourself)...'
        )
        try {
            this.isLocalAudioEnabled = !this.isLocalAudioEnabled

            if (this.userVideoRef) {
                this.userVideoRef.nativeElement.muted =
                    !this.isLocalAudioEnabled
                console.log(
                    '🎯 VKYC-SESSION: Local audio toggled:',
                    this.isLocalAudioEnabled
                )
                this.showInfo(
                    'Local Audio',
                    this.isLocalAudioEnabled
                        ? 'You can now hear yourself'
                        : 'Local audio disabled (normal for calls)'
                )
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error toggling local audio:', error)
            this.showError('Local Audio Error', 'Failed to toggle local audio')
        }
    }

    private updateMediaControls(): void {
        this.isCameraEnabled = this.mediaService.isCameraEnabled()
        this.isMicrophoneEnabled = this.mediaService.isMicrophoneEnabled()
    }

    // Workflow Management
    async loadWorkflow(): Promise<void> {
        if (!this.roomId) return

        try {
            // Load default workflow from local file
            const response = await this.http
                .get('/assets/workflow.json')
                .toPromise()
            if (response) {
                this.workflowSteps = (response as any).steps || []
                this.activateNextStep()
                console.log('🎯 VKYC-SESSION: Workflow loaded successfully')
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Failed to load workflow:', error)
            // Fallback to default workflow
            this.loadDefaultWorkflow()
        }
    }

    private loadDefaultWorkflow(): void {
        this.workflowSteps = [
            {
                id: 'introduction',
                type: 'introduction',
                title: 'Welcome',
                description:
                    'Welcome to the KYC process. I will guide you step by step.',
                status: 'active',
                data: null,
            },
            {
                id: 'selfie_capture',
                type: 'selfie_capture',
                title: 'Take Selfie',
                description:
                    'Please capture a selfie for liveness verification.',
                status: 'pending',
                data: null,
                instructions:
                    'Look directly at the camera and smile naturally. Ensure good lighting and clear visibility of your face.',
            },
            {
                id: 'questionnaire',
                type: 'questionnaire',
                title: 'Personal Information',
                description: 'Please provide your basic information.',
                status: 'pending',
                data: null,
                questions: [
                    {
                        id: 'full_name',
                        question: 'What is your full name?',
                        type: 'text',
                        required: true,
                    },
                    {
                        id: 'age',
                        question: 'What is your age?',
                        type: 'number',
                        required: true,
                    },
                    {
                        id: 'date_of_birth',
                        question: 'What is your date of birth?',
                        type: 'date',
                        required: true,
                    },
                ],
            },
            {
                id: 'id_upload',
                type: 'id_upload',
                title: 'ID Document Upload',
                description:
                    'Please upload your ID document (PAN Card, Aadhaar Card, or Passport).',
                status: 'pending',
                data: null,
                document_types: ['PAN Card', 'Aadhaar Card', 'Passport'],
                instructions:
                    'Upload a clear photo of your ID document. Ensure all text is readable and the document is not damaged.',
            },
            {
                id: 'verification',
                type: 'verification',
                title: 'Verification Complete',
                description:
                    'Your KYC verification has been completed successfully.',
                status: 'pending',
                data: null,
            },
        ]
        this.activateNextStep()
    }

    private activateNextStep(): void {
        const nextStep = this.workflowSteps.find(
            (step) => step.status === 'pending'
        )
        if (nextStep) {
            nextStep.status = 'active'
            this.currentStep = nextStep
            console.log('🎯 VKYC-SESSION: Activated step:', nextStep.id)
        }
    }

    // Step Actions
    async captureSelfie(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Capturing selfie...')
        if (!this.hasMedia) {
            this.showError('Camera Required', 'Please enable camera first')
            return
        }

        try {
            // Use VideoSDK's captureImage method if available
            let selfieData: string | null = null

            if (
                this.meetingService.getCurrentMeeting()?.localParticipant
                    ?.captureImage
            ) {
                try {
                    const base64Data = await this.meetingService
                        .getCurrentMeeting()
                        .localParticipant.captureImage()
                    selfieData = base64Data
                    console.log(
                        '🎯 VKYC-SESSION: Selfie captured using VideoSDK captureImage'
                    )
                } catch (error) {
                    console.warn(
                        '🎯 VKYC-SESSION: VideoSDK captureImage failed, falling back to canvas method:',
                        error
                    )
                }
            }

            // Fallback to canvas method if VideoSDK method fails
            if (!selfieData) {
                const canvas = document.createElement('canvas')
                const video = this.userVideoRef.nativeElement
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(video, 0, 0)
                    selfieData = canvas.toDataURL('image/jpeg', 0.8)
                    console.log(
                        '🎯 VKYC-SESSION: Selfie captured using canvas fallback'
                    )
                }
            }

            // Ensure proper data URL format
            if (selfieData && !selfieData.startsWith('data:image/')) {
                selfieData = `data:image/jpeg;base64,${selfieData}`
                console.log(
                    '🎯 VKYC-SESSION: Added data URL prefix to selfie data'
                )
            }

            if (selfieData) {
                // Reset image error flag
                this.imageLoadError = false

                // Open image manipulator dialog
                this.openImageManipulator(selfieData)
            } else {
                throw new Error('Failed to capture selfie')
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error capturing selfie:', error)
            this.showError(
                'Selfie Error',
                'Failed to capture selfie. Please try again.'
            )
        }
    }

    async retakeSelfie(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Retaking selfie...')
        // Clear the current selfie data
        this.currentStep!.data = { selfie: null, submitted: false }

        console.log('🎯 VKYC-SESSION: Selfie data cleared:', {
            hasSelfie: !!this.currentStep?.data?.selfie,
            currentStepData: this.currentStep?.data,
        })

        // Force change detection
        this.cdRef.detectChanges()

        this.showSuccess('Retake Selfie', 'Ready to capture a new selfie.')
    }

    openImageManipulator(base64Data: string): void {
        console.log('🎯 VKYC-SESSION: Opening image manipulator...')

        // Set up the image manipulator data and show it
        this.imageManipulatorData = {
            base64: base64Data,
            subActionId: 'selfie-capture',
            mode: 'selfie',
            frontImage: new Blob(),
        }
        this.showImageManipulator = true

        // Listen for the image manipulator close event
        this.setupImageManipulatorListener()
    }

    private setupImageManipulatorListener(): void {
        const handleImageManipulatorClose = (event: CustomEvent) => {
            const response: UploadCroppedImageResponse = event.detail
            this.closeImageManipulator(response)
        }

        // Add event listener
        window.addEventListener(
            'imageManipulatorClose',
            handleImageManipulatorClose as EventListener
        )

        // Store the handler reference for cleanup
        this.imageManipulatorCloseHandler =
            handleImageManipulatorClose as EventListener
    }

    private imageManipulatorCloseHandler?: EventListener

    private closeImageManipulator(response: UploadCroppedImageResponse): void {
        console.log(
            '🎯 VKYC-SESSION: Image manipulator closed with response:',
            response
        )

        // Remove event listener
        if (this.imageManipulatorCloseHandler) {
            window.removeEventListener(
                'imageManipulatorClose',
                this.imageManipulatorCloseHandler
            )
            this.imageManipulatorCloseHandler = undefined
        }

        // Hide the image manipulator
        this.showImageManipulator = false
        this.imageManipulatorData = null

        if (response.showSyncResponse && response.imageInfo) {
            // Convert the cropped image back to base64
            this.convertBlobToBase64(response.imageInfo.blob).then(
                (base64Data) => {
                    this.processCapturedImage(base64Data)
                }
            )
        } else {
            // User cancelled, show retake option
            this.showInfo(
                'Image Capture',
                'Image capture cancelled. You can retake the photo.'
            )
        }
    }

    private processCapturedImage(base64Data: string): void {
        // Store the captured image for display (don't complete step yet)
        this.currentStep!.data = {
            selfie: base64Data,
            submitted: false,
        }

        console.log('🎯 VKYC-SESSION: Selfie data stored:', {
            hasSelfie: !!this.currentStep?.data?.selfie,
            selfieLength: this.currentStep?.data?.selfie?.length,
            currentStepData: this.currentStep?.data,
            currentStepId: this.currentStep?.id,
        })

        // Force change detection
        this.cdRef.detectChanges()

        this.showSuccess(
            'Selfie Captured',
            'Selfie captured! Please review and submit.'
        )
    }

    private convertBlobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    }

    async submitSelfie(): Promise<void> {
        console.log('🎯 VKYC-SESSION: Submitting selfie...')
        if (!this.currentStep?.data?.selfie) {
            this.showError('No Selfie', 'Please capture a selfie first.')
            return
        }

        if (!this.roomData?.roomId) {
            this.showError('No Room', 'Room ID not available.')
            return
        }

        try {
            // Show loading state
            this.showInfo(
                'Processing',
                'Submitting selfie and performing liveness detection...'
            )

            // Submit to API
            const response = await this.roomService.submitSelfie(
                this.roomData.roomId,
                this.currentStep.data.selfie
            )

            if (response && response.status === 'success') {
                // Mark as submitted
                this.currentStep.data.submitted = true

                // Store liveness detection results
                const livenessResults = response.liveness_detection
                this.currentStep.data.liveness_detection = livenessResults

                // Complete the step with liveness detection results
                await this.completeStep('selfie_capture', {
                    selfie: this.currentStep.data.selfie,
                    timestamp: new Date().toISOString(),
                    submitted: true,
                    liveness_detection: livenessResults,
                })

                // Show success message with liveness results
                const livenessScore = livenessResults?.liveness_score || 0
                const isLive = livenessResults?.is_live || false
                const confidence = livenessResults?.confidence || 'unknown'

                if (isLive) {
                    this.showSuccess(
                        'Liveness Detection Passed',
                        `Selfie submitted successfully! Liveness score: ${(
                            livenessScore * 100
                        ).toFixed(1)}% (${confidence} confidence)`
                    )
                } else {
                    this.showWarning(
                        'Liveness Detection Failed',
                        `Selfie submitted but liveness detection failed. Score: ${(
                            livenessScore * 100
                        ).toFixed(
                            1
                        )}% (${confidence} confidence). Please try again.`
                    )
                }

                console.log(
                    '🎯 VKYC-SESSION: Liveness detection results:',
                    livenessResults
                )
            } else {
                throw new Error(response?.error || 'Failed to submit selfie')
            }
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error submitting selfie:', error)
            this.showError(
                'Submission Error',
                'Failed to submit selfie or perform liveness detection. Please try again.'
            )
        }
    }

    onImageError(event: any): void {
        console.error('🎯 VKYC-SESSION: Image load error:', event)
        this.imageLoadError = true
    }

    onImageLoad(event: any): void {
        console.log('🎯 VKYC-SESSION: Image loaded successfully')
        this.imageLoadError = false
    }

    testImageLoad(): void {
        console.log('🎯 VKYC-SESSION: Testing image load with sample data')
        // Use a simple test image (1x1 pixel red PNG)
        const testImageData =
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

        this.currentStep!.data = {
            selfie: testImageData,
            submitted: false,
        }

        this.imageLoadError = false
        this.cdRef.detectChanges()

        console.log('🎯 VKYC-SESSION: Test image data set:', {
            hasSelfie: !!this.currentStep?.data?.selfie,
            selfieLength: this.currentStep?.data?.selfie?.length,
        })
    }

    async uploadDocument(event: any, stepId: string): Promise<void> {
        console.log('🎯 VKYC-SESSION: Uploading document...')
        const file = event.target.files[0]
        if (!file) return

        try {
            // Validate file type
            const allowedTypes = [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'application/pdf',
            ]
            if (!allowedTypes.includes(file.type)) {
                this.showError(
                    'Invalid File Type',
                    'Please upload a JPG, PNG, or PDF file.'
                )
                return
            }

            // Validate file size (max 10MB)
            const maxSize = 10 * 1024 * 1024 // 10MB
            if (file.size > maxSize) {
                this.showError(
                    'File Too Large',
                    'Please upload a file smaller than 10MB.'
                )
                return
            }

            // Read file as base64
            const reader = new FileReader()
            reader.onload = async (e) => {
                const documentData = e.target?.result as string

                // Store the uploaded document data for display
                const step = this.workflowSteps.find((s) => s.id === stepId)
                if (step) {
                    step.data = {
                        document: documentData,
                        filename: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        timestamp: new Date().toISOString(),
                    }
                }

                // Complete the step
                await this.completeStep(stepId, {
                    document: documentData,
                    filename: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    timestamp: new Date().toISOString(),
                })

                this.showSuccess(
                    'Document Upload',
                    'Document uploaded successfully!'
                )
            }
            reader.readAsDataURL(file)
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error uploading document:', error)
            this.showError(
                'Upload Error',
                'Failed to upload document. Please try again.'
            )
        }
    }

    async submitQuestionnaire(stepId: string): Promise<void> {
        console.log('🎯 VKYC-SESSION: Submitting questionnaire...')
        const answers = { ...this.questionnaireAnswers }
        await this.completeStep(stepId, { answers })
        this.showSuccess(
            'Questionnaire',
            'Questionnaire submitted successfully!'
        )
        this.questionnaireAnswers = {}
    }

    isQuestionnaireComplete(step: WorkflowStep): boolean {
        if (!step.questions) return true
        return step.questions.every((question) => {
            if (!question.required) return true
            return (
                this.questionnaireAnswers[question.id] &&
                this.questionnaireAnswers[question.id].toString().trim() !== ''
            )
        })
    }

    async completeStep(stepId: string, data?: any): Promise<void> {
        console.log('🎯 VKYC-SESSION: Completing step:', stepId)

        const step = this.workflowSteps.find((s) => s.id === stepId)
        if (step) {
            step.status = 'completed'
            step.data = data
            this.currentStep = null

            // Activate next step
            this.activateNextStep()

            // Check if all steps are completed
            const allCompleted = this.workflowSteps.every(
                (s) => s.status === 'completed'
            )
            if (allCompleted) {
                this.showSuccess(
                    'KYC Complete',
                    'KYC verification completed successfully!'
                )
                setTimeout(() => {
                    this.endSession()
                }, 2000)
            }
        }
    }

    // Agent Video Management
    private updateAgentVideoState(): void {
        // Check if agent is present in participants
        const agentParticipant = this.participants.find((p) =>
            p.id.includes('agent')
        )
        this.hasAgentVideo = !!agentParticipant
    }

    private startAgentSpeakingSimulation(): void {
        // Simulate agent speaking for demo purposes
        this.agentSpeakingInterval = setInterval(() => {
            // Randomly make agent "speak" for demo
            if (Math.random() > 0.7) {
                this.isAgentSpeaking = true
                setTimeout(() => {
                    this.isAgentSpeaking = false
                }, 2000)
            }
        }, 5000)
    }

    private stopAgentSpeakingSimulation(): void {
        if (this.agentSpeakingInterval) {
            clearInterval(this.agentSpeakingInterval)
            this.agentSpeakingInterval = null
        }
    }

    // Session Management
    endSession(): void {
        console.log('🎯 VKYC-SESSION: Ending session...')

        // Check if there are incomplete steps
        const incompleteSteps = this.workflowSteps.filter(
            (step) => step.status === 'active' || step.status === 'pending'
        )

        if (incompleteSteps.length > 0) {
            const confirmed = confirm(
                `You have ${incompleteSteps.length} incomplete step(s) in your KYC process. Are you sure you want to end the session? Your progress will be lost.`
            )

            if (!confirmed) {
                this.showInfo('Session', 'Session continuation cancelled')
                return
            }
        }

        this.showInfo('Session', 'Ending KYC session...')
        this.cleanup()
        this.sessionEnded.emit()
    }

    private cleanup(): void {
        console.log('🎯 VKYC-SESSION: Cleaning up...')

        try {
            // Stop media streams
            this.mediaService.stopCurrentStream()

            // Leave meeting
            this.meetingService.leaveMeeting()

            // Stop agent simulation
            this.stopAgentSpeakingSimulation()

            // Clean up image manipulator
            if (this.imageManipulatorCloseHandler) {
                window.removeEventListener(
                    'imageManipulatorClose',
                    this.imageManipulatorCloseHandler
                )
                this.imageManipulatorCloseHandler = undefined
            }
            this.showImageManipulator = false
            this.imageManipulatorData = null

            // Reset workflow state
            this.workflowSteps = []
            this.currentStep = null
            this.questionnaireAnswers = {}

            // Reset media controls
            this.isCameraEnabled = false
            this.isMicrophoneEnabled = false
            this.hasMedia = false
            this.hasAgentVideo = false
            this.isAgentSpeaking = false

            // Clear video elements
            if (this.userVideoRef) {
                this.userVideoRef.nativeElement.srcObject = null
            }
            if (this.agentVideoRef) {
                this.agentVideoRef.nativeElement.srcObject = null
            }
            if (this.agentAudioRef) {
                this.agentAudioRef.nativeElement.srcObject = null
            }

            console.log('🎯 VKYC-SESSION: Cleanup completed successfully')
        } catch (error) {
            console.error('🎯 VKYC-SESSION: Error during cleanup:', error)
        }
    }

    // Utility Methods
    getStatusClass(): string {
        switch (this.status.toLowerCase()) {
            case 'ready':
                return 'bg-blue-100 text-blue-800'
            case 'room ready':
            case 'agent joined':
            case 'kyc running':
                return 'bg-green-100 text-green-800'
            case 'creating room':
            case 'joining agent':
            case 'starting kyc':
                return 'bg-yellow-100 text-yellow-800'
            default:
                if (this.status.toLowerCase().includes('error')) {
                    return 'bg-red-100 text-red-800'
                }
                return 'bg-gray-100 text-gray-800'
        }
    }

    getLogTimestamp(log: string): string {
        return log.split(' ')[0] + ' ' + log.split(' ')[1]
    }

    getLogMessage(log: string): string {
        return log.split(' ').slice(2).join(' ')
    }

    private isStatusLoading(status: string): boolean {
        const loadingStatuses = [
            'creating room',
            'joining agent',
            'starting kyc',
            'initializing',
            'setting up',
            'connecting',
        ]
        return loadingStatuses.some((loadingStatus) =>
            status.toLowerCase().includes(loadingStatus)
        )
    }

    // Error and Success Messages
    private showError(title: string, message: string): void {
        console.error('🎯 VKYC-SESSION: Error:', message)
        this.notificationService.showError(title, message)
    }

    private showSuccess(title: string, message: string): void {
        console.log('🎯 VKYC-SESSION: Success:', message)
        this.notificationService.showSuccess(title, message)
    }

    private showWarning(title: string, message: string): void {
        console.warn('🎯 VKYC-SESSION: Warning:', message)
        this.notificationService.showWarning(title, message)
    }

    private showInfo(title: string, message: string): void {
        console.log('🎯 VKYC-SESSION: Info:', message)
        this.notificationService.showInfo(title, message)
    }
}
