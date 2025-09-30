import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { EnterpriseRoomService } from './enterprise-room.service'
import { MediaService } from './media.service'
import { MeetingService } from './meeting.service'
import { NotificationService } from './notification.service'

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
        private notificationService: NotificationService
    ) {}

    startAgentLoadingSequence(): void {
        console.log('🎯 MEETING-FACADE: Starting agent loading sequence')
        this.isAgentLoading$.next(true)
        this.agentLoadingStep$.next(1)
        this.updateLoadingState({
            isLoading: true,
            currentStep: 1,
            isStreamReady: false,
        })
        this.waitForAgentStream()
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
        // In real app, subscribe to actual VideoSDK events
        clearTimeout(this.agentLoadingTimeout)
        this.agentLoadingTimeout = setTimeout(() => {
            this.agentStreamReady$.next(true)
            this.completeAgentLoading()
        }, 2000)
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

    private updateLoadingState(updates: Partial<AgentLoadingState>): void {
        const current = this.agentLoadingState$.value
        this.agentLoadingState$.next({ ...current, ...updates })
    }
}
