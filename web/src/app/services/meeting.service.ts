import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { JoinConfig } from '../interfaces/room.interface'

declare const VideoSDK: any

@Injectable({
    providedIn: 'root',
})
export class MeetingService {
    private meetingSubject = new BehaviorSubject<any>(null)
    private participantsSubject = new BehaviorSubject<any[]>([])
    private meetingStateSubject = new BehaviorSubject<
        'idle' | 'joining' | 'joined' | 'left'
    >('idle')
    private localStreamSubject = new BehaviorSubject<any>(null)
    private remoteStreamSubject = new BehaviorSubject<any>(null)
    private hasActiveMeetingSubject = new BehaviorSubject<boolean>(false)

    public meeting$ = this.meetingSubject.asObservable()
    public participants$ = this.participantsSubject.asObservable()
    public meetingState$ = this.meetingStateSubject.asObservable()
    public localStream$ = this.localStreamSubject.asObservable()
    public remoteStream$ = this.remoteStreamSubject.asObservable()
    public hasActiveMeeting$ = this.hasActiveMeetingSubject.asObservable()

    private meeting: any = null
    private participants: any[] = []

    async initializeMeeting(joinConfig: JoinConfig): Promise<void> {
        try {
            this.meetingStateSubject.next('joining')
            console.log(
                '🎯 MEETING-SERVICE: Initializing meeting with config:',
                joinConfig
            )
            console.log('🎯 MEETING-SERVICE: Using token:', joinConfig.token)
            debugger
            // Configure VideoSDK with token first (required for 0.3.1)
            VideoSDK.config(joinConfig.token)

            // Initialize VideoSDK meeting with proper options
            const initMeetingOptions = {
                meetingId: joinConfig.roomId,
                name: 'Client',
                micEnabled: true,
                webcamEnabled: true,
                multiStream: false,
            }

            this.meeting = VideoSDK.initMeeting(initMeetingOptions)

            if (!this.meeting) {
                console.error(
                    '🎯 MEETING-SERVICE: Meeting initialization failed'
                )
                this.meetingStateSubject.next('idle')
                this.hasActiveMeetingSubject.next(false)
                return
            }

            this.meetingSubject.next(this.meeting)

            // Set up event listeners
            this.setupEventListeners()

            // Join the meeting
            this.meeting.join()

            // Ensure webcam and mic are enabled after joining
            setTimeout(async () => {
                try {
                    if (this.meeting && this.meeting.localParticipant) {
                        console.log(
                            '🎯 MEETING-SERVICE: Ensuring media is enabled after join'
                        )
                        await this.meeting.localParticipant.enableMic()
                        await this.meeting.localParticipant.enableWebcam()
                        console.log(
                            '🎯 MEETING-SERVICE: Media enabled successfully'
                        )
                    }
                } catch (error) {
                    console.error(
                        '🎯 MEETING-SERVICE: Error enabling media after join:',
                        error
                    )
                }
            }, 2000) // Wait 2 seconds after joining
        } catch (error) {
            console.error(
                '🎯 MEETING-SERVICE: Failed to initialize meeting:',
                error
            )
            this.meetingStateSubject.next('idle')
            this.hasActiveMeetingSubject.next(false)
        }
    }

    private setupEventListeners(): void {
        if (!this.meeting) return

        console.log('🎯 MEETING-SERVICE: Setting up event listeners')

        // Local participant stream events
        this.meeting.localParticipant.on('stream-enabled', (stream: any) => {
            console.log(
                '🎯 MEETING-SERVICE: Local participant stream enabled:',
                stream
            )
            console.log('🎯 MEETING-SERVICE: Stream kind:', stream.kind)

            if (stream.kind === 'audio') {
                console.log('🎯 MEETING-SERVICE: Setting local audio stream')
                // Create MediaStream from VideoSDK stream track (as per VideoSDK docs)
                const mediaStream = new MediaStream()
                mediaStream.addTrack(stream.track)
                this.localStreamSubject.next(mediaStream)

                // Add track ended listener
                if (stream.track) {
                    stream.track.addEventListener('ended', () => {
                        console.log(
                            '🎯 MEETING-SERVICE: LOCAL AUDIO TRACK ENDED'
                        )
                        // Handle mic failure
                    })
                }
            } else if (stream.kind === 'video') {
                console.log('🎯 MEETING-SERVICE: Local video stream enabled')
                console.log('🎯 MEETING-SERVICE: Setting local video stream')
                // Create MediaStream from VideoSDK stream track (as per VideoSDK docs)
                const mediaStream = new MediaStream()
                mediaStream.addTrack(stream.track)
                this.localStreamSubject.next(mediaStream)
            }
        })

        this.meeting.localParticipant.on('stream-disabled', (stream: any) => {
            console.log(
                '🎯 MEETING-SERVICE: Local participant stream disabled:',
                stream
            )
            this.localStreamSubject.next(null)
        })

        // Meeting joined
        this.meeting.on('meeting-joined', () => {
            console.log('🎯 MEETING-SERVICE: Meeting joined successfully')
            this.meetingStateSubject.next('joined')
            this.hasActiveMeetingSubject.next(true)

            // Add local participant to the list
            const localParticipant = this.meeting.localParticipant
            if (localParticipant) {
                const participantData = {
                    id: localParticipant.id,
                    displayName: localParticipant.displayName || 'You',
                    isLocal: true,
                    stream: localParticipant.stream,
                    participant: localParticipant,
                    isAgent: false,
                    isSpeaking: false,
                    audioLevel: 0,
                    lastSpeechTime: 0,
                }
                console.log(
                    '🎯 MEETING-SERVICE: Adding local participant:',
                    participantData
                )
                this.participants.push(participantData)
                this.participantsSubject.next([...this.participants])
            }
        })

        // Meeting left
        this.meeting.on('meeting-left', () => {
            console.log('🎯 MEETING-SERVICE: Meeting left')
            this.meetingStateSubject.next('left')
            this.hasActiveMeetingSubject.next(false)
            this.participants = []
            this.participantsSubject.next([])
        })

        // Speaker changed
        this.meeting.on('speaker-changed', (activeSpeakerId: string) => {
            console.log(
                '🎯 MEETING-SERVICE: Speaker changed to:',
                activeSpeakerId
            )
            const activeSpeaker =
                this.meeting.localParticipant.id === activeSpeakerId
                    ? this.meeting.localParticipant
                    : this.meeting.participants.get(activeSpeakerId)
            console.log('🎯 MEETING-SERVICE: Active speaker:', activeSpeaker)
        })

        // Participant joined
        this.meeting.on('participant-joined', (participant: any) => {
            console.log('🎯 MEETING-SERVICE: Participant joined:', participant)
            console.log('🎯 MEETING-SERVICE: Participant ID:', participant.id)
            console.log(
                '🎯 MEETING-SERVICE: Participant displayName:',
                participant.displayName
            )
            console.log(
                '🎯 MEETING-SERVICE: Participant isLocal:',
                participant.isLocal
            )

            // More flexible agent detection - check if it's not the local participant
            // and has a different display name pattern
            const isAgent =
                !participant.isLocal &&
                (participant.displayName === 'KYC AI Agent' ||
                    participant.displayName === 'AI Agent' ||
                    participant.displayName?.includes('Agent') ||
                    participant.displayName?.includes('AI') ||
                    // If it's a remote participant and not the local user, assume it's the agent
                    (participant.displayName &&
                        participant.displayName !== 'You' &&
                        participant.displayName !== 'Client'))

            const participantData = {
                id: participant.id,
                displayName: participant.displayName,
                isLocal: participant.isLocal,
                stream: participant.stream,
                participant: participant,
                isAgent: isAgent,
                isSpeaking: false,
                audioLevel: 0,
                lastSpeechTime: 0,
            }

            console.log('🎯 MEETING-SERVICE: Agent detection result:', {
                displayName: participant.displayName,
                isLocal: participant.isLocal,
                isAgent: isAgent,
                participantId: participant.id,
            })

            console.log(
                '🎯 MEETING-SERVICE: Adding participant:',
                participantData
            )
            this.participants.push(participantData)
            this.participantsSubject.next([...this.participants])

            // Set participant quality
            participant.quality = 'high'

            // Handle participant stream events
            participant.on('stream-enabled', (stream: any) => {
                console.log(
                    '🎯 MEETING-SERVICE: Participant stream enabled:',
                    stream
                )
                console.log('🎯 MEETING-SERVICE: Stream kind:', stream.kind)
                console.log(
                    '🎯 MEETING-SERVICE: Stream participantId:',
                    participant.id
                )

                if (stream.kind === 'audio') {
                    console.log(
                        '🎯 MEETING-SERVICE: Setting remote audio stream'
                    )
                    // Create MediaStream from VideoSDK stream track (as per VideoSDK docs)
                    const mediaStream = new MediaStream()
                    mediaStream.addTrack(stream.track)
                    this.remoteStreamSubject.next(mediaStream)

                    // Add track ended listener
                    if (stream.track) {
                        stream.track.addEventListener('ended', () => {
                            console.log(
                                '🎯 MEETING-SERVICE: REMOTE AUDIO TRACK ENDED'
                            )
                        })
                    }
                } else if (stream.kind === 'video') {
                    console.log(
                        '🎯 MEETING-SERVICE: Remote video stream enabled'
                    )
                    console.log(
                        '🎯 MEETING-SERVICE: Setting remote video stream'
                    )
                    // Create MediaStream from VideoSDK stream track (as per VideoSDK docs)
                    const mediaStream = new MediaStream()
                    mediaStream.addTrack(stream.track)
                    this.remoteStreamSubject.next(mediaStream)
                }
            })

            participant.on('stream-disabled', (stream: any) => {
                console.log(
                    '🎯 MEETING-SERVICE: Participant stream disabled:',
                    stream
                )
                this.remoteStreamSubject.next(null)
            })

            participant.on('media-status-changed', (data: any) => {
                const { kind, newStatus } = data
                console.log(
                    '🎯 MEETING-SERVICE: Media status changed:',
                    kind,
                    newStatus
                )
            })
        })

        // Participant left
        this.meeting.on('participant-left', (participant: any) => {
            console.log('🎯 MEETING-SERVICE: Participant left:', participant)
            this.participants = this.participants.filter(
                (p) => p.id !== participant.id
            )
            this.participantsSubject.next([...this.participants])
            this.remoteStreamSubject.next(null)
        })

        // Error handling
        this.meeting.on('error', (data: any) => {
            const { code, message } = data
            console.error('🎯 MEETING-SERVICE: Error', code + ':', message)
        })

        // Meeting state changed
        this.meeting.on('meeting-state-changed', (data: any) => {
            console.log('🎯 MEETING-SERVICE: Meeting state changed:', data)
            const { state } = data
            this.meetingStateSubject.next(state)
        })
    }

    leaveMeeting(): void {
        if (this.meeting) {
            this.meeting.leave()
            this.meeting = null
            this.meetingSubject.next(null)
            this.hasActiveMeetingSubject.next(false)
        }
    }

    getCurrentMeeting(): any {
        return this.meeting
    }

    getCurrentParticipants(): any[] {
        return this.participants
    }

    getCurrentMeetingState(): 'idle' | 'joining' | 'joined' | 'left' {
        return this.meetingStateSubject.value
    }

    // Local participant media controls
    async toggleLocalMic(): Promise<boolean> {
        if (!this.meeting || !this.meeting.localParticipant) {
            console.log(
                '🎯 MEETING-SERVICE: No meeting or local participant available'
            )
            return false
        }

        try {
            const currentMicState = this.meeting.localParticipant.mic
            if (currentMicState) {
                await this.meeting.localParticipant.disableMic()
                console.log('🎯 MEETING-SERVICE: Local mic disabled')
                return false
            } else {
                await this.meeting.localParticipant.enableMic()
                console.log('🎯 MEETING-SERVICE: Local mic enabled')
                return true
            }
        } catch (error) {
            console.error(
                '🎯 MEETING-SERVICE: Error toggling local mic:',
                error
            )
            return false
        }
    }

    async toggleLocalCamera(): Promise<boolean> {
        if (!this.meeting || !this.meeting.localParticipant) {
            console.log(
                '🎯 MEETING-SERVICE: No meeting or local participant available'
            )
            return false
        }

        try {
            const currentCamState = this.meeting.localParticipant.webcam
            if (currentCamState) {
                await this.meeting.localParticipant.disableWebcam()
                console.log('🎯 MEETING-SERVICE: Local camera disabled')
                return false
            } else {
                await this.meeting.localParticipant.enableWebcam()
                console.log('🎯 MEETING-SERVICE: Local camera enabled')
                return true
            }
        } catch (error) {
            console.error(
                '🎯 MEETING-SERVICE: Error toggling local camera:',
                error
            )
            return false
        }
    }

    isLocalMicEnabled(): boolean {
        if (!this.meeting || !this.meeting.localParticipant) return false
        return this.meeting.localParticipant.mic
    }

    isLocalCameraEnabled(): boolean {
        if (!this.meeting || !this.meeting.localParticipant) return false
        return this.meeting.localParticipant.webcam
    }
}
