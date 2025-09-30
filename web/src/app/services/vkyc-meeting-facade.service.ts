import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { EnterpriseRoomService } from './enterprise-room.service'
import { MediaService } from './media.service'
import { MeetingService } from './meeting.service'
import { NotificationService } from './notification.service'
import { JoinAgentService, JoinAgentRequest } from './join-agent.service'
import { HealthCheckDataService } from './health-check-data.service'

export interface AgentLoadingState {
    isLoading: boolean
    currentStep: number
    isStreamReady: boolean
}

@Injectable({ providedIn: 'root' })
export class VkycMeetingFacadeService {
    isAgentLoading$ = new BehaviorSubject<boolean>(false)
    agentStreamReady$ = new BehaviorSubject<boolean>(false)
    agentLoadingStep$ = new BehaviorSubject<number>(0)
    agentLoadingState$ = new BehaviorSubject<AgentLoadingState>({
        isLoading: false,
        currentStep: 0,
        isStreamReady: false,
    })

    private agentLoadingTimeout: any = null

    constructor(
        private roomService: EnterpriseRoomService,
        private mediaService: MediaService,
        private meetingService: MeetingService,
        private notificationService: NotificationService,
        private joinAgentService: JoinAgentService,
        private healthCheckDataService: HealthCheckDataService
    ) {}

    startAgentLoadingSequence(healthCheckData?: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }): void {
        console.log('🎯 MEETING-FACADE: Starting agent loading sequence')
        this.isAgentLoading$.next(true)
        this.agentLoadingStep$.next(1)
        this.updateLoadingState({
            isLoading: true,
            currentStep: 1,
            isStreamReady: false,
        })

        // Call join-agent API with health check data
        this.joinAgentWithHealthData(healthCheckData)
    }

    async joinCall(): Promise<void> {
        console.log('🎯 MEETING-FACADE: Joining call')
        // Simulate call joining
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('🎯 MEETING-FACADE: Successfully joined call')
                resolve()
            }, 1000)
        })
    }

    leaveCall(): void {
        console.log('🎯 MEETING-FACADE: Leaving call')
        this.cleanup()
    }

    cleanup(): void {
        console.log('🎯 MEETING-FACADE: Cleaning up')
        if (this.agentLoadingTimeout) {
            clearTimeout(this.agentLoadingTimeout)
        }
        this.isAgentLoading$.next(false)
        this.agentStreamReady$.next(false)
        this.updateLoadingState({
            isLoading: false,
            currentStep: 0,
            isStreamReady: false,
        })
    }

    private waitForAgentStream(): void {
        // Listen to actual VideoSDK stream-enabled events
        console.log(
            '🎯 MEETING-FACADE: Waiting for agent stream to be ready...'
        )

        let agentParticipantFound = false

        // Subscribe to meeting service to detect when agent participant joins
        this.meetingService.participants$.subscribe((participants) => {
            console.log(
                '🎯 MEETING-FACADE: Participants updated:',
                participants.map((p) => ({
                    id: p.id,
                    displayName: p.displayName,
                    isLocal: p.isLocal,
                    isAgent: p.isAgent,
                    hasStream: !!p.stream,
                }))
            )

            const agentParticipant = participants.find(
                (p) => p.isAgent && !p.isLocal
            )

            if (agentParticipant && !agentParticipantFound) {
                agentParticipantFound = true
                console.log('🎯 MEETING-FACADE: Agent participant found:', {
                    id: agentParticipant.id,
                    displayName: agentParticipant.displayName,
                    hasStream: !!agentParticipant.stream,
                })
                console.log(
                    '🎯 MEETING-FACADE: Waiting for agent video stream...'
                )
            }
        })

        // Subscribe to remote stream to detect when agent video is actually available
        this.meetingService.remoteStream$.subscribe((stream) => {
            if (stream && agentParticipantFound) {
                const videoTracks = stream.getVideoTracks()
                if (videoTracks.length > 0) {
                    console.log(
                        '🎯 MEETING-FACADE: Agent video stream detected!'
                    )
                    this.agentStreamReady$.next(true)
                    this.completeAgentLoading()
                }
            }
        })

        // Fallback timeout in case stream detection fails
        clearTimeout(this.agentLoadingTimeout)
        this.agentLoadingTimeout = setTimeout(() => {
            console.log(
                '🎯 MEETING-FACADE: Agent stream timeout - completing loading anyway'
            )
            this.agentStreamReady$.next(true)
            this.completeAgentLoading()
        }, 10000) // 10 seconds timeout
    }

    completeAgentLoading(): void {
        this.isAgentLoading$.next(false)
        this.agentLoadingStep$.next(0)
        this.updateLoadingState({
            isLoading: false,
            currentStep: 0,
            isStreamReady: true,
        })
        clearTimeout(this.agentLoadingTimeout)
    }

    private async joinAgentWithHealthData(healthCheckData?: {
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }): Promise<void> {
        try {
            // Get session data from storage
            const sessionData = this.roomService.getSessionData()
            if (!sessionData) {
                throw new Error(
                    'No session data found. Please restart the session.'
                )
            }

            console.log('🎯 MEETING-FACADE: Using session data:', sessionData)

            // Health check data is now stored when user clicks "Proceed" in health check component
            if (healthCheckData) {
                console.log(
                    '🎯 MEETING-FACADE: Health check data received (already stored):',
                    {
                        locationData: healthCheckData.locationData,
                        networkSpeed: healthCheckData.networkSpeed,
                        isVpnDetected: healthCheckData.isVpnDetected,
                        timestamp: new Date().toISOString(),
                    }
                )
            }

            const request = this.joinAgentService.createJoinAgentRequest(
                sessionData.roomId,
                sessionData.agentParticipantId,
                sessionData.agentToken,
                '' // Empty workflow for now
            )

            console.log(
                '🎯 MEETING-FACADE: Calling join-agent API with health data:',
                request
            )

            const response = await this.joinAgentService
                .joinAgent(request)
                .toPromise()

            if (response?.status === 'success') {
                console.log(
                    '🎯 MEETING-FACADE: Join-agent API success:',
                    response
                )
                this.agentLoadingStep$.next(2)
                this.updateLoadingState({
                    isLoading: true,
                    currentStep: 2,
                    isStreamReady: false,
                })

                // Wait for agent stream to be ready
                this.waitForAgentStream()
            } else {
                throw new Error(response?.message || 'Join-agent API failed')
            }
        } catch (error) {
            console.error('🎯 MEETING-FACADE: Join-agent API error:', error)
            this.notificationService.showError(
                'Agent Initialization Failed',
                'Failed to initialize agent. Please try again.'
            )
            this.cleanup()
        }
    }

    private updateLoadingState(updates: Partial<AgentLoadingState>): void {
        const current = this.agentLoadingState$.value
        this.agentLoadingState$.next({ ...current, ...updates })
    }
}
