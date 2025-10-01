import {
    AfterViewInit,
    Component,
    EventEmitter,
    OnDestroy,
    OnInit,
    Output,
    ViewChild,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { MeetingService } from '../../services/meeting.service'
import { AudioVideoTrackComponent } from './components/audio-video-track/audio-video-track.component'
import { Subscription } from 'rxjs'

@Component({
    selector: 'app-meeting-panel',
    standalone: true,
    templateUrl: './meeting-panel.component.html',
    styleUrls: ['./meeting-panel.component.css'],
    imports: [CommonModule, AudioVideoTrackComponent],
})
export class MeetingPanelComponent implements OnInit, AfterViewInit, OnDestroy {
    @Output() streamsActive: EventEmitter<boolean> = new EventEmitter()
    @Output() micToggle: EventEmitter<void> = new EventEmitter()
    @Output() cameraToggle: EventEmitter<void> = new EventEmitter()
    @Output() chatToggle: EventEmitter<void> = new EventEmitter()
    @Output() endCall: EventEmitter<void> = new EventEmitter()
    @ViewChild('customerTrack') customerTrack!: AudioVideoTrackComponent
    @ViewChild('agentTrack') agentTrack!: AudioVideoTrackComponent

    // Meeting state
    isCustomerVideoPlaying: boolean = false
    isCustomerAudioPlaying: boolean = false
    isAgentVideoPlaying: boolean = false
    isAgentAudioPlaying: boolean = false

    // Stream state
    agentStream: MediaStream | null = null
    customerStream: MediaStream | null = null

    // Subscriptions
    private subscriptions: Subscription = new Subscription()

    // Stream state tracking
    private lastStreamsActiveState: boolean | null = null

    constructor(private meetingService: MeetingService) {}

    ngOnInit(): void {
        console.log('🎯 MEETING-PANEL: Component initialized')
        this.setupSubscriptions()
    }

    ngAfterViewInit(): void {
        console.log('🎯 MEETING-PANEL: After view init')
        this.initializeStreams()
    }

    ngOnDestroy(): void {
        console.log('🎯 MEETING-PANEL: Component destroyed')
        this.subscriptions.unsubscribe()
    }

    private setupSubscriptions(): void {
        // Subscribe to local stream (customer)
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
                } else {
                    console.log(
                        '🎯 MEETING-PANEL: No customer stream available'
                    )
                }
            })
        )

        // Subscribe to remote stream (agent)
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

                    // Log detailed track information
                    const videoTracks = stream.getVideoTracks()
                    const audioTracks = stream.getAudioTracks()

                    if (videoTracks.length > 0) {
                        console.log(
                            '🎯 MEETING-PANEL: Agent video track details:',
                            {
                                trackId: videoTracks[0].id,
                                trackLabel: videoTracks[0].label,
                                trackEnabled: videoTracks[0].enabled,
                                trackReadyState: videoTracks[0].readyState,
                                trackKind: videoTracks[0].kind,
                            }
                        )
                    }

                    if (audioTracks.length > 0) {
                        console.log(
                            '🎯 MEETING-PANEL: Agent audio track details:',
                            {
                                trackId: audioTracks[0].id,
                                trackLabel: audioTracks[0].label,
                                trackEnabled: audioTracks[0].enabled,
                                trackReadyState: audioTracks[0].readyState,
                                trackKind: audioTracks[0].kind,
                            }
                        )
                    }

                    this.setAgentTrack(stream)
                } else {
                    console.log('🎯 MEETING-PANEL: No agent stream available')
                }
            })
        )
    }

    private initializeStreams(): void {
        console.log('🎯 MEETING-PANEL: Initializing streams')
        // Streams will be set via subscriptions
    }

    private setCustomerTrack(stream: MediaStream): void {
        console.log('🎯 MEETING-PANEL: Setting customer track')
        this.customerStream = stream

        // Check if stream has video and audio tracks
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()

        this.isCustomerVideoPlaying =
            videoTracks.length > 0 && videoTracks[0].enabled
        this.isCustomerAudioPlaying =
            audioTracks.length > 0 && audioTracks[0].enabled

        console.log('🎯 MEETING-PANEL: Customer stream state:', {
            hasVideo: this.isCustomerVideoPlaying,
            hasAudio: this.isCustomerAudioPlaying,
        })

        this.checkStreamsActive()
    }

    private setAgentTrack(stream: MediaStream): void {
        console.log('🎯 MEETING-PANEL: Setting agent track')
        this.agentStream = stream

        // Check if stream has video and audio tracks
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()

        this.isAgentVideoPlaying =
            videoTracks.length > 0 && videoTracks[0].enabled
        this.isAgentAudioPlaying =
            audioTracks.length > 0 && audioTracks[0].enabled

        console.log('🎯 MEETING-PANEL: Agent stream state:', {
            hasVideo: this.isAgentVideoPlaying,
            hasAudio: this.isAgentAudioPlaying,
        })

        this.checkStreamsActive()
    }

    private checkStreamsActive(): void {
        const streamsActive =
            this.isCustomerAudioPlaying && this.isCustomerVideoPlaying
        console.log('🎯 MEETING-PANEL: Streams active:', streamsActive)

        // Only emit if the state has changed to prevent unnecessary emissions
        if (this.lastStreamsActiveState !== streamsActive) {
            this.lastStreamsActiveState = streamsActive
            this.streamsActive.emit(streamsActive)
        }
    }
}
