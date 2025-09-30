import {
    AfterViewInit,
    Component,
    EventEmitter,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
    ViewContainerRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { MeetingService } from '../../services/meeting.service'
import { MediaService } from '../../services/media.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { AudioVideoTrackComponent } from './components/audio-video-track/audio-video-track.component'
import { NetworkSpeedBarComponent } from '../network-speed-bar/network-speed-bar.component'
import { Subscription } from 'rxjs'

@Component({
    selector: 'app-meeting-panel',
    standalone: true,
    templateUrl: './meeting-panel.component.html',
    styleUrls: ['./meeting-panel.component.css'],
    imports: [CommonModule, AudioVideoTrackComponent, NetworkSpeedBarComponent],
})
export class MeetingPanelComponent implements OnInit, AfterViewInit, OnDestroy {
    @Output() streamsActive: EventEmitter<boolean> = new EventEmitter()
    @ViewChild('customerTrack') customerTrack!: AudioVideoTrackComponent
    @ViewChild('agentTrack') agentTrack!: AudioVideoTrackComponent

    // Meeting state
    isParticipantPresent: boolean = false
    isCustomerVideoPlaying: boolean = false
    isCustomerAudioPlaying: boolean = false
    isAgentVideoPlaying: boolean = false
    isAgentAudioPlaying: boolean = false
    callEnded: boolean = false

    // Agent state (local participant)
    agent: any = null
    agentMicEnabled: boolean = false
    agentWebCamEnabled: boolean = false
    agentStream: MediaStream | null = null

    // Customer state (remote participant)
    customer: any = null
    customerMicEnabled: boolean = true
    customerWebCamEnabled: boolean = true
    customerStream: MediaStream | null = null

    // Retry counters to prevent infinite retries
    private customerTrackRetryCount: number = 0
    private agentTrackRetryCount: number = 0
    private readonly maxRetries: number = 10

    // Recording state
    isRecording: boolean = false
    recordingDuration: number = 0

    // Network stats
    networkStats: any = {
        local: null,
        remote: null,
        customerNetworkSpeed: null,
    }
    agentNetworkSpeed?: number

    // Current speaker
    curSpeaker: any = null

    // Participants
    participants: any[] = []

    private subscriptions: Subscription = new Subscription()

    constructor(
        public meetingService: MeetingService,
        public mediaService: MediaService,
        public roomService: EnterpriseRoomService,
        private vcr: ViewContainerRef
    ) {}

    ngOnInit(): void {
        console.log('🎯 MEETING-PANEL: Component initialized')
        this.setupSubscriptions()
        this.initializeCustomerMediaState()
        this.initializeAgentMediaState()
        console.log('🎯 MEETING-PANEL: Component ngOnInit completed')
    }

    ngAfterViewInit(): void {
        console.log('🎯 MEETING-PANEL: View initialized')
        console.log(
            '🎯 MEETING-PANEL: Customer track component:',
            this.customerTrack
        )
        console.log('🎯 MEETING-PANEL: Agent track component:', this.agentTrack)
    }

    /**
     * Initialize customer media state from media service
     * @private
     */
    private initializeCustomerMediaState(): void {
        try {
            this.customerMicEnabled = this.mediaService.isMicrophoneEnabled()
            this.customerWebCamEnabled = this.mediaService.isCameraEnabled()
            console.log('🎯 MEETING-PANEL: Customer media state initialized:', {
                mic: this.customerMicEnabled,
                camera: this.customerWebCamEnabled,
            })
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error initializing customer media state:',
                error
            )
            // Set default values
            this.customerMicEnabled = true
            this.customerWebCamEnabled = true
        }
    }

    /**
     * Initialize agent media state from meeting service
     * @private
     */
    private initializeAgentMediaState(): void {
        try {
            this.agentMicEnabled = this.meetingService.isLocalMicEnabled()
            this.agentWebCamEnabled = this.meetingService.isLocalCameraEnabled()
            console.log('🎯 MEETING-PANEL: Agent media state initialized:', {
                mic: this.agentMicEnabled,
                camera: this.agentWebCamEnabled,
            })
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error initializing agent media state:',
                error
            )
            // Set default values
            this.agentMicEnabled = false
            this.agentWebCamEnabled = false
        }
    }

    /**
     * Set up all necessary subscriptions for the meeting panel
     * @private
     */
    private setupSubscriptions(): void {
        console.log('🎯 MEETING-PANEL: Setting up subscriptions')

        // Subscribe to meeting state
        this.subscriptions.add(
            this.meetingService.meetingState$.subscribe((state) => {
                console.log('🎯 MEETING-PANEL: Meeting state changed:', state)
            })
        )

        // Subscribe to participants
        this.subscriptions.add(
            this.meetingService.participants$.subscribe((participants) => {
                this.participants = participants
                this.isParticipantPresent = participants.length > 0
                console.log(
                    '🎯 MEETING-PANEL: Participants updated:',
                    participants.length,
                    'participants'
                )
                console.log(
                    '🎯 MEETING-PANEL: isParticipantPresent set to:',
                    this.isParticipantPresent
                )

                participants.forEach((p, index) => {
                    console.log(`🎯 MEETING-PANEL: Participant ${index + 1}:`, {
                        id: p.id,
                        displayName: p.displayName,
                        isLocal: p.isLocal,
                        isAgent: p.isAgent,
                        hasStream: !!p.stream,
                        streamTracks: p.stream?.tracks?.length || 0,
                    })
                })

                // Check if we have any remote participants (customers)
                const remoteParticipants = participants.filter(
                    (p) => !p.isLocal
                )
                console.log(
                    '🎯 MEETING-PANEL: Remote participants (customers):',
                    remoteParticipants.length
                )
                if (remoteParticipants.length > 0) {
                    console.log(
                        '🎯 MEETING-PANEL: Customer detected, should show customer video'
                    )
                }
            })
        )

        // Subscribe to local stream (Customer - local participant)
        this.subscriptions.add(
            this.meetingService.localStream$.subscribe((stream) => {
                if (stream) {
                    console.log(
                        '🎯 MEETING-PANEL: Local stream received (Customer):',
                        {
                            streamId: stream.id,
                            videoTracks: stream.getVideoTracks().length,
                            audioTracks: stream.getAudioTracks().length,
                            isActive: stream.active,
                        }
                    )
                    this.setCustomerTrack(stream)
                }
            })
        )

        // Subscribe to remote stream (Agent - remote participant)
        this.subscriptions.add(
            this.meetingService.remoteStream$.subscribe((stream) => {
                if (stream) {
                    console.log(
                        '🎯 MEETING-PANEL: Remote stream received (Agent):',
                        {
                            streamId: stream.id,
                            videoTracks: stream.getVideoTracks().length,
                            audioTracks: stream.getAudioTracks().length,
                            isActive: stream.active,
                        }
                    )
                    this.setAgentTrack(stream)
                } else {
                    console.log('🎯 MEETING-PANEL: No agent stream available')
                }
            })
        )

        // Subscribe to media state
        this.subscriptions.add(
            this.mediaService.mediaState$.subscribe((state) => {
                this.isAgentVideoPlaying = state.hasMedia
                console.log('🎯 MEETING-PANEL: Media state updated:', {
                    hasMedia: state.hasMedia,
                    error: state.error,
                })
            })
        )

        // Subscribe to room status
        this.subscriptions.add(
            this.roomService.status$.subscribe((status) => {
                console.log('🎯 MEETING-PANEL: Room status updated:', status)
            })
        )

        console.log('🎯 MEETING-PANEL: All subscriptions set up successfully')
    }

    /**
     * Set customer track (remote participant)
     */
    setCustomerTrack(stream: MediaStream): void {
        console.log('🎯 MEETING-PANEL: Setting customer track:', {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            isActive: stream.active,
        })

        // Store the MediaStream directly
        this.customerStream = stream

        // Check if it has video tracks
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0) {
            console.log('🎯 MEETING-PANEL: Customer video track detected')
            this.isCustomerVideoPlaying = true
            this.isParticipantPresent = true
            this.customerWebCamEnabled = true
            this.customerTrackRetryCount = 0
            console.log(
                '🎯 MEETING-PANEL: Customer video should now be visible'
            )
        }

        // Check if it has audio tracks
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0) {
            console.log('🎯 MEETING-PANEL: Customer audio track detected')
            this.isCustomerAudioPlaying = true
            this.customerMicEnabled = true
        }

        this.addPlayingEventListeners()
    }

    /**
     * Set agent track (local participant)
     */
    setAgentTrack(stream: MediaStream): void {
        console.log('🎯 MEETING-PANEL: Setting agent track:', {
            streamId: stream.id,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
            isActive: stream.active,
        })

        // Store the MediaStream directly
        this.agentStream = stream

        // Check if it has video tracks
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0) {
            console.log('🎯 MEETING-PANEL: Agent video track detected')
            this.isAgentVideoPlaying = true
            this.agentWebCamEnabled = true
            this.agentTrackRetryCount = 0
            console.log('🎯 MEETING-PANEL: Agent video should now be visible')
        }

        // Check if it has audio tracks
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0) {
            console.log('🎯 MEETING-PANEL: Agent audio track detected')
            this.isAgentAudioPlaying = true
            this.agentMicEnabled = true
        }

        this.addPlayingEventListeners()
    }

    private addPlayingEventListeners(): void {
        const customerAudioElement =
            this.customerTrack?._audioTrack?.nativeElement
        const customerVideoElement =
            this.customerTrack?._videoTrack?.nativeElement
        const agentVideoElement = this.agentTrack?._videoTrack?.nativeElement
        const agentAudioElement = this.agentTrack?._audioTrack?.nativeElement

        customerAudioElement?.addEventListener(
            'playing',
            this.handleCustomerAudioPlayingEvent
        )
        customerVideoElement?.addEventListener(
            'playing',
            this.handleCustomerVideoPlayingEvent
        )
        agentAudioElement?.addEventListener(
            'playing',
            this.handleAgentAudioPlayingEvent
        )
        agentVideoElement?.addEventListener(
            'playing',
            this.handleAgentVideoPlayingEvent
        )
    }

    handleCustomerAudioPlayingEvent = () => {
        this.isCustomerAudioPlaying = true
        this.checkStreamsActive()
    }

    handleCustomerVideoPlayingEvent = () => {
        this.isCustomerVideoPlaying = true
        this.checkStreamsActive()
    }

    handleAgentAudioPlayingEvent = () => {
        this.isAgentAudioPlaying = true
        this.checkStreamsActive()
    }

    handleAgentVideoPlayingEvent = () => {
        this.isAgentVideoPlaying = true
        this.checkStreamsActive()
    }

    /**
     * Play video track on the provided video element
     * @param videoElement - HTML video element to play the track on
     * @private
     */
    private playVideoTrack(videoElement: HTMLVideoElement): void {
        console.log('🎯 MEETING-PANEL: Attempting to play video track')
        console.log('🎯 MEETING-PANEL: Video element:', {
            srcObject: !!videoElement.srcObject,
            readyState: videoElement.readyState,
            paused: videoElement.paused,
            muted: videoElement.muted,
        })

        const videoPlayPromise = videoElement.play()
        if (videoPlayPromise !== undefined) {
            videoPlayPromise
                .then(() => {
                    if (videoElement.muted) {
                        videoElement.muted = false
                    }
                    console.log(
                        '🎯 MEETING-PANEL: Video track playing successfully'
                    )
                })
                .catch((error) => {
                    console.error(
                        '🎯 MEETING-PANEL: Video track play failed:',
                        error
                    )
                })
        }
    }

    /**
     * Play audio track on the provided audio element
     * @param audioElement - HTML audio element to play the track on
     * @private
     */
    private playAudioTrack(audioElement: HTMLAudioElement): void {
        const audioPlayPromise = audioElement.play()
        if (audioPlayPromise !== undefined) {
            audioPlayPromise
                .then(() => {
                    if (audioElement.muted) {
                        audioElement.muted = false
                    }
                    console.log(
                        '🎯 MEETING-PANEL: Audio track playing successfully'
                    )
                })
                .catch((error) => {
                    console.error(
                        '🎯 MEETING-PANEL: Audio track play failed:',
                        error
                    )
                })
        }
    }

    /**
     * Check if customer streams are active and emit the status
     * @private
     */
    private checkStreamsActive(): void {
        const streamsActive =
            this.isCustomerAudioPlaying && this.isCustomerVideoPlaying
        console.log('🎯 MEETING-PANEL: Streams active:', streamsActive)
        this.streamsActive.emit(streamsActive)
    }

    /**
     * Terminate the current call/session
     * @returns Promise<boolean> - Success status
     */
    async onCallTerminate(): Promise<boolean> {
        try {
            console.log('🎯 MEETING-PANEL: Terminating call...')
            this.meetingService.leaveMeeting()
            this.callEnded = true
            console.log('🎯 MEETING-PANEL: Call terminated successfully')
            return true
        } catch (error) {
            console.error('🎯 MEETING-PANEL: Error terminating call:', error)
            this.showErrorMessage('Failed to terminate call')
            return false
        }
    }

    /**
     * Show error message to user
     * @param message - Error message to display
     */
    private showErrorMessage(message: string): void {
        // TODO: Implement proper error notification system
        console.error('🎯 MEETING-PANEL: User Error:', message)
        // For now, we'll just log the error
        // In a production app, this would show a toast notification or modal
    }

    /**
     * Toggle agent camera state
     * @returns Promise<boolean> - Success status
     */
    async toggleAgentCamState(): Promise<boolean> {
        try {
            const enabled = await this.meetingService.toggleLocalCamera()
            this.agentWebCamEnabled = enabled
            console.log('🎯 MEETING-PANEL: Agent camera toggled:', enabled)
            return true
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error toggling agent camera:',
                error
            )
            this.showErrorMessage('Failed to toggle agent camera')
            return false
        }
    }

    /**
     * Toggle agent microphone state
     * @returns Promise<boolean> - Success status
     */
    async toggleAgentMicState(): Promise<boolean> {
        try {
            const enabled = await this.meetingService.toggleLocalMic()
            this.agentMicEnabled = enabled
            console.log('🎯 MEETING-PANEL: Agent microphone toggled:', enabled)
            return true
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error toggling agent microphone:',
                error
            )
            this.showErrorMessage('Failed to toggle agent microphone')
            return false
        }
    }

    /**
     * Toggle customer microphone state
     * @returns Promise<boolean> - Success status
     */
    async toggleCustomerMicState(): Promise<boolean> {
        try {
            const enabled = await this.mediaService.toggleMicrophone()
            this.customerMicEnabled = enabled
            console.log(
                '🎯 MEETING-PANEL: Customer microphone toggled:',
                enabled
            )
            return true
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error toggling customer microphone:',
                error
            )
            // Show user-friendly error message
            this.showErrorMessage('Failed to toggle customer microphone')
            return false
        }
    }

    /**
     * Toggle customer camera state
     * @returns Promise<boolean> - Success status
     */
    async toggleCustomerCamState(): Promise<boolean> {
        try {
            const enabled = await this.mediaService.toggleCamera()
            this.customerWebCamEnabled = enabled
            console.log('🎯 MEETING-PANEL: Customer camera toggled:', enabled)
            return true
        } catch (error) {
            console.error(
                '🎯 MEETING-PANEL: Error toggling customer camera:',
                error
            )
            // Show user-friendly error message
            this.showErrorMessage('Failed to toggle customer camera')
            return false
        }
    }

    /**
     * Open network statistics dialog
     * @param type - Type of stats to show ('local' for agent, 'remote' for customer)
     */
    openStatsDialog(type: 'local' | 'remote'): void {
        console.log('🎯 MEETING-PANEL: Opening network stats dialog for:', type)
        // TODO: Implement network stats dialog
        // This would show detailed network statistics for the specified participant
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
        this.removePlayingEventListeners()
    }

    private removePlayingEventListeners(): void {
        const customerAudioElement =
            this.customerTrack?._audioTrack?.nativeElement
        const customerVideoElement =
            this.customerTrack?._videoTrack?.nativeElement
        const agentVideoElement = this.agentTrack?._videoTrack?.nativeElement
        const agentAudioElement = this.agentTrack?._audioTrack?.nativeElement

        customerAudioElement?.removeEventListener(
            'playing',
            this.handleCustomerAudioPlayingEvent
        )
        customerVideoElement?.removeEventListener(
            'playing',
            this.handleCustomerVideoPlayingEvent
        )
        agentAudioElement?.removeEventListener(
            'playing',
            this.handleAgentAudioPlayingEvent
        )
        agentVideoElement?.removeEventListener(
            'playing',
            this.handleAgentVideoPlayingEvent
        )
    }
}
