import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule, KeyValuePipe } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subscription } from 'rxjs'
import {
    EnterpriseApiService,
    SessionResponse,
    WorkflowProgressResponse,
    AgentStatusResponse,
    HealthResponse,
} from '../../services/enterprise-api.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'

@Component({
    selector: 'app-enterprise-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, KeyValuePipe],
    templateUrl: './enterprise-dashboard.component.html',
    styleUrls: ['./enterprise-dashboard.component.css'],
})
export class EnterpriseDashboardComponent implements OnInit, OnDestroy {
    // Component state
    isLoading = false
    error: string | null = null

    // Data
    currentSession: SessionResponse | null = null
    workflowProgress: WorkflowProgressResponse | null = null
    agentStatus: AgentStatusResponse | null = null
    systemHealth: HealthResponse | null = null

    // UI state
    selectedWorkflowType = 'kyc'
    selectedAgentType = 'kyc_agent'
    showAdvancedOptions = false

    // Available options
    workflowTypes: string[] = ['kyc', 'interview', 'survey']
    agentTypes: string[] = ['kyc_agent', 'interview_agent', 'survey_agent']

    private subscriptions: Subscription[] = []

    constructor(
        private enterpriseApi: EnterpriseApiService,
        private enterpriseRoom: EnterpriseRoomService
    ) {}

    ngOnInit(): void {
        this.initializeSubscriptions()
        this.loadSystemHealth()
        this.loadAvailableOptions()
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe())
    }

    private initializeSubscriptions(): void {
        // Subscribe to enterprise API observables
        this.subscriptions.push(
            this.enterpriseApi.currentSession$.subscribe((session) => {
                this.currentSession = session
            })
        )

        this.subscriptions.push(
            this.enterpriseApi.workflowProgress$.subscribe((progress) => {
                this.workflowProgress = progress
            })
        )

        this.subscriptions.push(
            this.enterpriseApi.agentStatus$.subscribe((agent) => {
                this.agentStatus = agent
            })
        )

        this.subscriptions.push(
            this.enterpriseApi.healthStatus$.subscribe((health) => {
                this.systemHealth = health
            })
        )
    }

    private async loadSystemHealth(): Promise<void> {
        try {
            await this.enterpriseApi.getSystemHealth().toPromise()
        } catch (error) {
            console.error('Failed to load system health:', error)
        }
    }

    private async loadAvailableOptions(): Promise<void> {
        try {
            const [workflowTypesResponse, agentTypesResponse] =
                await Promise.all([
                    this.enterpriseApi.getWorkflowTypes().toPromise(),
                    this.enterpriseApi.getAgentTypes().toPromise(),
                ])

            if (workflowTypesResponse) {
                this.workflowTypes = workflowTypesResponse.workflow_types
            }

            if (agentTypesResponse) {
                this.agentTypes = agentTypesResponse.agent_types
            }
        } catch (error) {
            console.error('Failed to load available options:', error)
        }
    }

    async createSession(): Promise<void> {
        if (this.isLoading) return

        this.isLoading = true
        this.error = null

        try {
            const session = await this.enterpriseApi
                .createSession({
                    workflow_type: this.selectedWorkflowType,
                    agent_type: this.selectedAgentType,
                    language: 'en',
                    metadata: {
                        source: 'enterprise_dashboard',
                        timestamp: new Date().toISOString(),
                    },
                })
                .toPromise()

            if (session) {
                console.log('Session created successfully:', session)
            }
        } catch (error: any) {
            this.error = error.message || 'Failed to create session'
            console.error('Failed to create session:', error)
        } finally {
            this.isLoading = false
        }
    }

    async startKycSession(): Promise<void> {
        if (this.isLoading) return

        this.isLoading = true
        this.error = null

        try {
            const result = await this.enterpriseRoom.initializeKYCSession()

            if (result.success) {
                console.log('KYC session started successfully')
            } else {
                this.error = result.error || 'Failed to start KYC session'
            }
        } catch (error: any) {
            this.error = error.message || 'Failed to start KYC session'
            console.error('Failed to start KYC session:', error)
        } finally {
            this.isLoading = false
        }
    }

    async loadWorkflowProgress(): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .getWorkflowProgress(this.currentSession.session_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to load workflow progress:', error)
        }
    }

    async startWorkflowStep(stepId: string): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .startWorkflowStep(this.currentSession.session_id, stepId)
                .toPromise()
        } catch (error) {
            console.error('Failed to start workflow step:', error)
        }
    }

    async completeWorkflowStep(stepId: string, data?: any): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .completeWorkflowStep(
                    this.currentSession.session_id,
                    stepId,
                    data
                )
                .toPromise()
        } catch (error) {
            console.error('Failed to complete workflow step:', error)
        }
    }

    async pauseSession(): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .pauseSession(this.currentSession.session_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to pause session:', error)
        }
    }

    async resumeSession(): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .resumeSession(this.currentSession.session_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to resume session:', error)
        }
    }

    async pauseAgent(): Promise<void> {
        if (!this.agentStatus) return

        try {
            await this.enterpriseApi
                .pauseAgent(this.agentStatus.agent_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to pause agent:', error)
        }
    }

    async resumeAgent(): Promise<void> {
        if (!this.agentStatus) return

        try {
            await this.enterpriseApi
                .resumeAgent(this.agentStatus.agent_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to resume agent:', error)
        }
    }

    async deleteSession(): Promise<void> {
        if (!this.currentSession) return

        try {
            await this.enterpriseApi
                .deleteSession(this.currentSession.session_id)
                .toPromise()
        } catch (error) {
            console.error('Failed to delete session:', error)
        }
    }

    getHealthStatusClass(): string {
        if (!this.systemHealth) return 'bg-gray-100 text-gray-800'

        switch (this.systemHealth.overall_status) {
            case 'healthy':
                return 'bg-green-100 text-green-800'
            case 'degraded':
                return 'bg-yellow-100 text-yellow-800'
            case 'unhealthy':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    getWorkflowStepStatusClass(status: string): string {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-800'
            case 'in_progress':
                return 'bg-blue-100 text-blue-800'
            case 'pending':
                return 'bg-gray-100 text-gray-800'
            case 'failed':
                return 'bg-red-100 text-red-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    getAgentStatusClass(status: string): string {
        switch (status) {
            case 'active':
                return 'bg-green-100 text-green-800'
            case 'paused':
                return 'bg-yellow-100 text-yellow-800'
            case 'error':
                return 'bg-red-100 text-red-800'
            case 'stopped':
                return 'bg-gray-100 text-gray-800'
            default:
                return 'bg-gray-100 text-gray-800'
        }
    }

    formatTimestamp(timestamp: string | undefined): string {
        if (!timestamp) {
            return 'N/A'
        }
        return new Date(timestamp).toLocaleString()
    }

    toggleAdvancedOptions(): void {
        this.showAdvancedOptions = !this.showAdvancedOptions
    }
}
