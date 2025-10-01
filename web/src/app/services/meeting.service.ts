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

            // Get or create the combined MediaStream for local participant
            let combinedStream = this.localStreamSubject.value
            if (!combinedStream) {
                combinedStream = new MediaStream()
            }

            if (stream.kind === 'audio') {
                console.log(
                    '🎯 MEETING-SERVICE: Adding local audio track to combined stream'
                )
                // Add audio track to the combined stream
                combinedStream.addTrack(stream.track)

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
                console.log(
                    '🎯 MEETING-SERVICE: Adding local video track to combined stream'
                )
                // Add video track to the combined stream
                combinedStream.addTrack(stream.track)
            }

            // Emit the combined stream with both audio and video tracks
            this.localStreamSubject.next(combinedStream)
            console.log('🎯 MEETING-SERVICE: Combined local stream updated:', {
                audioTracks: combinedStream.getAudioTracks().length,
                videoTracks: combinedStream.getVideoTracks().length,
                streamId: combinedStream.id,
            })
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

                // Get or create the combined MediaStream for this participant
                let combinedStream = this.remoteStreamSubject.value
                if (!combinedStream) {
                    combinedStream = new MediaStream()
                }

                if (stream.kind === 'audio') {
                    console.log(
                        '🎯 MEETING-SERVICE: Adding remote audio track to combined stream'
                    )
                    // Add audio track to the combined stream
                    combinedStream.addTrack(stream.track)

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
                        '🎯 MEETING-SERVICE: Adding remote video track to combined stream'
                    )
                    // Add video track to the combined stream
                    combinedStream.addTrack(stream.track)
                }

                // Emit the combined stream with both audio and video tracks
                this.remoteStreamSubject.next(combinedStream)
                console.log(
                    '🎯 MEETING-SERVICE: Combined remote stream updated:',
                    {
                        audioTracks: combinedStream.getAudioTracks().length,
                        videoTracks: combinedStream.getVideoTracks().length,
                        streamId: combinedStream.id,
                    }
                )
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
            // this.meeting.end()
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

    // Image capture method - capture from local video stream
    captureImage(): Promise<string | null> {
        if (!this.meeting || !this.meeting.localParticipant) {
            console.warn(
                '🎯 MEETING-SERVICE: No active meeting or local participant to capture image'
            )
            return Promise.resolve(null)
        }

        try {
            console.log(
                '🎯 MEETING-SERVICE: Capturing image from local video stream'
            )

            // Get the local video track
            const localStream = this.localStreamSubject.value
            if (!localStream) {
                console.warn(
                    '🎯 MEETING-SERVICE: No local stream available for capture'
                )
                return Promise.resolve(null)
            }

            const videoTracks = localStream.getVideoTracks()
            if (videoTracks.length === 0) {
                console.warn(
                    '🎯 MEETING-SERVICE: No video tracks available for capture'
                )
                return Promise.resolve(null)
            }

            // Create a canvas to capture the video frame
            const videoTrack = videoTracks[0]
            const stream = new MediaStream([videoTrack])

            return new Promise((resolve) => {
                const video = document.createElement('video')
                video.srcObject = stream
                video.play()

                video.onloadedmetadata = () => {
                    const canvas = document.createElement('canvas')
                    canvas.width = video.videoWidth
                    canvas.height = video.videoHeight

                    const ctx = canvas.getContext('2d')
                    if (ctx) {
                        ctx.drawImage(video, 0, 0)
                        const imageData = canvas.toDataURL('image/jpeg', 0.8)
                        console.log(
                            '🎯 MEETING-SERVICE: Image captured successfully'
                        )
                        resolve(imageData)
                    } else {
                        console.error(
                            '🎯 MEETING-SERVICE: Could not get canvas context'
                        )
                        resolve(null)
                    }
                }

                video.onerror = () => {
                    console.error(
                        '🎯 MEETING-SERVICE: Error loading video for capture'
                    )
                    resolve(null)
                }
            })
        } catch (error) {
            console.error('🎯 MEETING-SERVICE: Error capturing image:', error)
            return Promise.resolve(null)
        }
    }

    // Camera flip method
    async flipCamera(): Promise<{ success: boolean; message: string }> {
        if (!this.meeting) {
            const message = 'No active meeting to flip camera'
            console.warn('🎯 MEETING-SERVICE:', message)
            return { success: false, message }
        }

        try {
            console.log('🎯 MEETING-SERVICE: Flipping camera')

            // Get available cameras
            const cameras = await VideoSDK.getCameras()
            const cameraList = Array.isArray(cameras)
                ? cameras
                : Object.values(cameras || {})

            if (cameraList.length < 2) {
                const message =
                    'Not enough cameras available for flipping. Only one camera detected.'
                console.warn('🎯 MEETING-SERVICE:', message)
                return { success: false, message }
            }

            // Find front and back cameras
            const frontCamera = cameraList.find(
                (cam: any) =>
                    (cam.label || '').toLowerCase().includes('front') ||
                    (cam.label || '').toLowerCase().includes('user')
            )
            const backCamera = cameraList.find(
                (cam: any) =>
                    (cam.label || '').toLowerCase().includes('back') ||
                    (cam.label || '').toLowerCase().includes('environment')
            )

            if (!frontCamera || !backCamera) {
                const message =
                    'Front or back camera not found. Cannot flip camera.'
                console.warn('🎯 MEETING-SERVICE:', message)
                return { success: false, message }
            }

            // Get current camera to determine which one to switch to
            const currentCamera = this.meeting.localParticipant?.webcam
                ?.getVideoTracks()?.[0]
                ?.getSettings()?.deviceId

            let targetCamera
            if (currentCamera === frontCamera.deviceId) {
                targetCamera = backCamera
                console.log('🎯 MEETING-SERVICE: Switching to back camera')
            } else {
                targetCamera = frontCamera
                console.log('🎯 MEETING-SERVICE: Switching to front camera')
            }

            // Change camera
            await this.meeting.changeWebcam(targetCamera.deviceId)
            const message = `Camera switched to ${
                targetCamera.label || 'unknown camera'
            }`
            console.log('🎯 MEETING-SERVICE: Camera flipped successfully')
            return { success: true, message }
        } catch (error) {
            const message = `Error flipping camera: ${error}`
            console.error('🎯 MEETING-SERVICE:', message)
            return { success: false, message }
        }
    }
}
