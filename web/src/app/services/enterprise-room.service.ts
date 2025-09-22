import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable, combineLatest } from 'rxjs'
import { map, switchMap, catchError } from 'rxjs/operators'
import {
    EnterpriseApiService,
    SessionResponse,
    WorkflowProgressResponse,
    AgentStatusResponse,
} from './enterprise-api.service'
import { MeetingService } from './meeting.service'
import { RoomCreateResponse, JoinConfig } from '../interfaces/room.interface'

@Injectable({
    providedIn: 'root',
})
export class EnterpriseRoomService {
    private statusSubject = new BehaviorSubject<string>('Idle')
    private logsSubject = new BehaviorSubject<string[]>([])
    private sessionDataSubject = new BehaviorSubject<SessionResponse | null>(
        null
    )
    private workflowProgressSubject =
        new BehaviorSubject<WorkflowProgressResponse | null>(null)
    private agentStatusSubject =
        new BehaviorSubject<AgentStatusResponse | null>(null)

    public status$ = this.statusSubject.asObservable()
    public logs$ = this.logsSubject.asObservable()
    public sessionData$ = this.sessionDataSubject.asObservable()
    public workflowProgress$ = this.workflowProgressSubject.asObservable()
    public agentStatus$ = this.agentStatusSubject.asObservable()

    // Combined observables for UI convenience
    public roomData$: Observable<RoomCreateResponse | null> =
        this.sessionData$.pipe(
            map((session) => {
                if (!session) return null

                // Convert enterprise session to legacy room format for backward compatibility
                return {
                    roomId: session.room_id,
                    customRoomId: session.session_id,
                    agent: {
                        participantId:
                            session.agent?.participantId ||
                            `agent_${session.session_id}`,
                        token: session.agent?.token || 'enterprise_token',
                    },
                    client: {
                        participantId:
                            session.client?.participantId ||
                            `client_${session.session_id}`,
                        token: session.client?.token || 'enterprise_token',
                    },
                } as RoomCreateResponse
            })
        )

    constructor(
        private enterpriseApi: EnterpriseApiService,
        private meetingService: MeetingService
    ) {
        this.initializeSubscriptions()
    }

    private initializeSubscriptions(): void {
        // Subscribe to enterprise API observables
        this.enterpriseApi.currentSession$.subscribe((session) => {
            this.sessionDataSubject.next(session)
        })

        this.enterpriseApi.workflowProgress$.subscribe((progress) => {
            this.workflowProgressSubject.next(progress)
        })

        this.enterpriseApi.agentStatus$.subscribe((agent) => {
            this.agentStatusSubject.next(agent)
        })
    }

    private appendLog(message: string): void {
        const timestamp = new Date().toLocaleTimeString()
        const logEntry = `${timestamp} ${message}`
        const currentLogs = this.logsSubject.value
        const newLogs = [logEntry, ...currentLogs].slice(0, 50)
        this.logsSubject.next(newLogs)
    }

    private setStatus(status: string): void {
        this.statusSubject.next(status)
    }

    // Main KYC Session Initialization
    async initializeKYCSession(): Promise<{
        success: boolean
        error?: string
    }> {
        try {
            this.appendLog(
                '🚀 Starting Enterprise KYC session initialization...'
            )
            this.setStatus('Initializing session...')

            // Step 1: Create enterprise session
            this.appendLog('📝 Creating enterprise session...')
            const session = await this.enterpriseApi
                .createSession({
                    workflow_type: 'kyc',
                    agent_type: 'kyc_agent',
                    language: 'en',
                    metadata: {
                        source: 'angular_ui',
                        version: '1.0.0',
                    },
                })
                .toPromise()

            if (!session) {
                throw new Error('Failed to create session')
            }

            this.appendLog(`✅ Session created: ${session.session_id}`)
            this.appendLog(`🏠 Room ID: ${session.room_id}`)

            // Step 2: Agent is automatically created with the session
            this.appendLog('✅ KYC agent ready (created with session)')

            // Step 3: Initialize VideoSDK meeting
            this.appendLog('🎥 Initializing VideoSDK meeting...')
            const joinConfig = this.getJoinConfig()
            if (!joinConfig) {
                throw new Error('Failed to get join configuration')
            }

            await this.meetingService.initializeMeeting(joinConfig)
            this.appendLog('✅ Client joined VideoSDK meeting')

            // Step 4: Load workflow
            this.appendLog('📋 Loading KYC workflow...')
            const workflowProgress = await this.enterpriseApi
                .getWorkflowProgress(session.session_id)
                .toPromise()
            if (workflowProgress) {
                this.appendLog(
                    `📋 Workflow loaded: ${workflowProgress.total_steps} steps`
                )
                this.appendLog(
                    `📋 Current step: ${workflowProgress.current_step}/${workflowProgress.total_steps}`
                )
            }

            this.appendLog('🎯 Enterprise KYC session ready for conversation!')
            this.setStatus('KYC session active')

            return { success: true }
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred'
            this.appendLog(
                `❌ KYC session initialization failed: ${errorMessage}`
            )
            this.setStatus(`Error: ${errorMessage}`)
            return { success: false, error: errorMessage }
        }
    }

    // Legacy compatibility methods
    async createRoom(): Promise<{ success: boolean; error?: string }> {
        // Delegate to initializeKYCSession to avoid duplicate API calls
        return await this.initializeKYCSession()
    }

    async joinAgent(): Promise<{ success: boolean; error?: string }> {
        const session = this.sessionDataSubject.value
        if (!session) {
            const errorMsg = 'No session data available for agent join'
            this.appendLog(`❌ ${errorMsg}`)
            this.setStatus('Error: No session data')
            return { success: false, error: errorMsg }
        }

        try {
            this.setStatus('Joining agent...')
            this.appendLog('🤖 Starting KYC agent...')

            // Use the join-agent endpoint like the old backend
            const agentResponse = await this.enterpriseApi
                .joinAgent(
                    session.room_id,
                    session.agent.participantId,
                    session.agent.token
                )
                .toPromise()

            if (agentResponse && agentResponse.status === 'success') {
                this.appendLog(`✅ Agent joined session: ${session.session_id}`)
                this.appendLog('🎯 AI agent is now ready for voice interaction')
                this.setStatus('Agent joined')

                // Load workflow after agent joins
                await this.loadWorkflow(session.session_id)
                return { success: true }
            } else {
                throw new Error(agentResponse?.error || 'Agent join failed')
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Failed to join agent'
            this.appendLog(`❌ Agent join failed: ${errorMessage}`)
            this.setStatus('Error joining agent')
            return { success: false, error: errorMessage }
        }
    }

    async loadWorkflow(sessionId: string): Promise<void> {
        try {
            const workflowProgress = await this.enterpriseApi
                .getWorkflowProgress(sessionId)
                .toPromise()
            if (workflowProgress) {
                this.appendLog('📋 Workflow loaded successfully')
                this.appendLog(
                    `📋 ${workflowProgress.total_steps} steps configured`
                )
                this.appendLog(
                    `📋 Progress: ${workflowProgress.progress_percentage}%`
                )
            } else {
                this.appendLog('❌ Failed to load workflow')
            }
        } catch (error) {
            console.error('Failed to load workflow:', error)
            this.appendLog('❌ Error loading workflow')
        }
    }

    async startKyc(): Promise<{ success: boolean; error?: string }> {
        const session = this.sessionDataSubject.value
        if (!session) {
            const errorMsg = 'No session data available for KYC start'
            this.appendLog(`❌ ${errorMsg}`)
            this.setStatus('Error: No session data')
            return { success: false, error: errorMsg }
        }

        try {
            this.setStatus('Starting KYC...')
            const result = await this.joinAgent()

            if (result.success) {
                this.appendLog(
                    `KYC session started for session ${session.session_id}`
                )
                this.setStatus('KYC running')
                return { success: true }
            } else {
                this.appendLog(`❌ Failed to start KYC: ${result.error}`)
                this.setStatus('Error starting KYC')
                return { success: false, error: result.error }
            }
        } catch (error: any) {
            const errorMessage = error.message || 'Unknown error occurred'
            this.appendLog(`❌ Failed to start KYC: ${errorMessage}`)
            this.setStatus('Error starting KYC')
            return { success: false, error: errorMessage }
        }
    }

    getJoinConfig(): JoinConfig | null {
        const session = this.sessionDataSubject.value
        if (!session) return null

        const joinConfig = {
            roomId: session.room_id,
            token: session.client?.token || 'enterprise_token',
            participantId:
                session.client?.participantId || `client_${session.session_id}`,
        }

        console.log('Generated join config:', joinConfig)
        return joinConfig
    }

    getCurrentRoomData(): RoomCreateResponse | null {
        const session = this.sessionDataSubject.value
        if (!session) return null

        return {
            roomId: session.room_id,
            customRoomId: session.session_id,
            agent: {
                participantId:
                    session.agent?.participantId ||
                    `agent_${session.session_id}`,
                token: session.agent?.token || 'enterprise_token',
            },
            client: {
                participantId:
                    session.client?.participantId ||
                    `client_${session.session_id}`,
                token: session.client?.token || 'enterprise_token',
            },
        }
    }

    getCurrentStatus(): string {
        return this.statusSubject.value
    }

    getCurrentLogs(): string[] {
        return this.logsSubject.value
    }

    // Workflow management methods
    async getWorkflowProgress(): Promise<WorkflowProgressResponse | null> {
        const session = this.sessionDataSubject.value
        if (!session) return null

        try {
            const result = await this.enterpriseApi
                .getWorkflowProgress(session.session_id)
                .toPromise()
            return result || null
        } catch (error) {
            console.error('Failed to get workflow progress:', error)
            return null
        }
    }

    async startWorkflowStep(stepId: string): Promise<boolean> {
        const session = this.sessionDataSubject.value
        if (!session) return false

        try {
            await this.enterpriseApi
                .startWorkflowStep(session.session_id, stepId)
                .toPromise()
            this.appendLog(`📋 Started workflow step: ${stepId}`)
            return true
        } catch (error) {
            console.error('Failed to start workflow step:', error)
            this.appendLog(`❌ Failed to start step: ${stepId}`)
            return false
        }
    }

    async completeWorkflowStep(stepId: string, data?: any): Promise<boolean> {
        const session = this.sessionDataSubject.value
        if (!session) return false

        try {
            await this.enterpriseApi
                .completeWorkflowStep(session.session_id, stepId, data)
                .toPromise()
            this.appendLog(`✅ Completed workflow step: ${stepId}`)
            return true
        } catch (error) {
            console.error('Failed to complete workflow step:', error)
            this.appendLog(`❌ Failed to complete step: ${stepId}`)
            return false
        }
    }

    // Agent management methods
    async getAgentStatus(): Promise<AgentStatusResponse | null> {
        const session = this.sessionDataSubject.value
        if (!session) return null

        try {
            // In a real implementation, you'd need to track the agent ID
            // For now, we'll return the current agent status
            return this.agentStatusSubject.value
        } catch (error) {
            console.error('Failed to get agent status:', error)
            return null
        }
    }

    async pauseAgent(): Promise<boolean> {
        const agent = this.agentStatusSubject.value
        if (!agent) return false

        try {
            await this.enterpriseApi.pauseAgent(agent.agent_id).toPromise()
            this.appendLog('⏸️ Agent paused')
            return true
        } catch (error) {
            console.error('Failed to pause agent:', error)
            this.appendLog('❌ Failed to pause agent')
            return false
        }
    }

    async resumeAgent(): Promise<boolean> {
        const agent = this.agentStatusSubject.value
        if (!agent) return false

        try {
            await this.enterpriseApi.resumeAgent(agent.agent_id).toPromise()
            this.appendLog('▶️ Agent resumed')
            return true
        } catch (error) {
            console.error('Failed to resume agent:', error)
            this.appendLog('❌ Failed to resume agent')
            return false
        }
    }

    // Session management methods
    async pauseSession(): Promise<boolean> {
        const session = this.sessionDataSubject.value
        if (!session) return false

        try {
            await this.enterpriseApi
                .pauseSession(session.session_id)
                .toPromise()
            this.appendLog('⏸️ Session paused')
            this.setStatus('Session paused')
            return true
        } catch (error) {
            console.error('Failed to pause session:', error)
            this.appendLog('❌ Failed to pause session')
            return false
        }
    }

    async resumeSession(): Promise<boolean> {
        const session = this.sessionDataSubject.value
        if (!session) return false

        try {
            await this.enterpriseApi
                .resumeSession(session.session_id)
                .toPromise()
            this.appendLog('▶️ Session resumed')
            this.setStatus('Session active')
            return true
        } catch (error) {
            console.error('Failed to resume session:', error)
            this.appendLog('❌ Failed to resume session')
            return false
        }
    }

    // Legacy compatibility method
    async submitSelfie(roomId: string, selfieData: string): Promise<any> {
        const session = this.sessionDataSubject.value
        if (!session) {
            throw new Error('No active session')
        }

        try {
            this.appendLog('📸 Submitting selfie...')

            // Use the actual API call to submit selfie
            const response = await this.enterpriseApi
                .submitSelfie(roomId, selfieData)
                .toPromise()

            if (response && response.status === 'success') {
                this.appendLog('📸 Selfie submitted successfully')
                return response
            } else {
                throw new Error(response?.error || 'Selfie submission failed')
            }
        } catch (error: any) {
            console.error('Error submitting selfie:', error)
            this.appendLog(`❌ Selfie submission failed: ${error.message}`)
            throw error
        }
    }

    // Cleanup method
    cleanup(): void {
        console.log('🎯 ENTERPRISE-ROOM-SERVICE: Cleaning up session...')

        const session = this.sessionDataSubject.value
        if (session) {
            // Clean up session on backend
            this.enterpriseApi.deleteSession(session.session_id).subscribe({
                next: () => this.appendLog('🧹 Session cleaned up on backend'),
                error: (error) =>
                    console.error('Failed to cleanup session:', error),
            })
        }

        this.sessionDataSubject.next(null)
        this.workflowProgressSubject.next(null)
        this.agentStatusSubject.next(null)
        this.statusSubject.next('Idle')
        this.logsSubject.next([])

        console.log('🎯 ENTERPRISE-ROOM-SERVICE: Session cleanup completed')
    }
}
