import { Injectable } from '@angular/core'
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { Observable, BehaviorSubject, throwError } from 'rxjs'
import { catchError, map } from 'rxjs/operators'

// Enterprise API Interfaces
export interface SessionCreateRequest {
    workflow_type: string
    agent_type: string
    language?: string
    metadata?: any
}

export interface SessionResponse {
    session_id: string
    room_id: string
    roomId: string // Also include roomId for compatibility
    customRoomId: string
    status: string
    workflow_type: string
    agent_type: string
    created_at?: string
    expires_at?: string
    agent: {
        participantId: string
        token: string
    }
    client: {
        participantId: string
        token: string
    }
}

export interface WorkflowProgressResponse {
    session_id: string
    workflow_type: string
    current_step: number
    total_steps: number
    progress_percentage: number
    status: string
    steps: WorkflowStep[]
}

export interface WorkflowStep {
    id: string
    type: string
    title: string
    description: string
    status: string
    data?: any
    instructions?: string
    questions?: any[]
    document_types?: string[]
    order: number
    created_at: string
    updated_at?: string
    completed_at?: string
}

export interface AgentStatusResponse {
    agent_id: string
    agent_type: string
    status: string
    session_id?: string
    room_id?: string
    created_at: string
    last_activity: string
    error_count: number
    metrics: any
}

export interface HealthResponse {
    overall_status: string
    timestamp: string
    total_components: number
    healthy_components: number
    unhealthy_components: number
    degraded_components: number
    average_response_time_ms?: number
    components: { [key: string]: any }
}

@Injectable({
    providedIn: 'root',
})
export class EnterpriseApiService {
    private readonly API_BASE = 'http://localhost:8000/api/v1'

    // State management
    private currentSessionSubject = new BehaviorSubject<SessionResponse | null>(
        null
    )
    private workflowProgressSubject =
        new BehaviorSubject<WorkflowProgressResponse | null>(null)
    private agentStatusSubject =
        new BehaviorSubject<AgentStatusResponse | null>(null)
    private healthStatusSubject = new BehaviorSubject<HealthResponse | null>(
        null
    )

    public currentSession$ = this.currentSessionSubject.asObservable()
    public workflowProgress$ = this.workflowProgressSubject.asObservable()
    public agentStatus$ = this.agentStatusSubject.asObservable()
    public healthStatus$ = this.healthStatusSubject.asObservable()

    constructor(private http: HttpClient) {}

    // Health Check Methods
    getSystemHealth(): Observable<HealthResponse> {
        return this.http.get<HealthResponse>(`${this.API_BASE}/health/`).pipe(
            map((response) => {
                this.healthStatusSubject.next(response)
                return response
            }),
            catchError(this.handleError)
        )
    }

    getComponentHealth(componentName: string): Observable<any> {
        return this.http
            .get(`${this.API_BASE}/health/components/${componentName}`)
            .pipe(catchError(this.handleError))
    }

    // Session Management Methods
    createSession(request: SessionCreateRequest): Observable<SessionResponse> {
        return this.http
            .post<SessionResponse>(`${this.API_BASE}/sessions/create`, request)
            .pipe(
                map((response) => {
                    this.currentSessionSubject.next(response)
                    return response
                }),
                catchError(this.handleError)
            )
    }

    getSession(sessionId: string): Observable<SessionResponse> {
        return this.http
            .get<SessionResponse>(`${this.API_BASE}/sessions/${sessionId}`)
            .pipe(
                map((response) => {
                    this.currentSessionSubject.next(response)
                    return response
                }),
                catchError(this.handleError)
            )
    }

    joinSession(
        sessionId: string,
        participantId: string,
        participantToken: string
    ): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/sessions/join`, {
                session_id: sessionId,
                participant_id: participantId,
                participant_token: participantToken,
            })
            .pipe(catchError(this.handleError))
    }

    pauseSession(sessionId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/sessions/${sessionId}/pause`, {})
            .pipe(catchError(this.handleError))
    }

    resumeSession(sessionId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/sessions/${sessionId}/resume`, {})
            .pipe(catchError(this.handleError))
    }

    deleteSession(sessionId: string): Observable<any> {
        return this.http.delete(`${this.API_BASE}/sessions/${sessionId}`).pipe(
            map(() => {
                this.currentSessionSubject.next(null)
                this.workflowProgressSubject.next(null)
                this.agentStatusSubject.next(null)
            }),
            catchError(this.handleError)
        )
    }

    // Workflow Management Methods
    getWorkflowTypes(): Observable<{ workflow_types: string[] }> {
        return this.http
            .get<{ workflow_types: string[] }>(
                `${this.API_BASE}/workflows/types`
            )
            .pipe(catchError(this.handleError))
    }

    getWorkflowTemplate(workflowType: string): Observable<any> {
        return this.http
            .get(`${this.API_BASE}/workflows/${workflowType}/template`)
            .pipe(catchError(this.handleError))
    }

    getWorkflowProgress(
        sessionId: string
    ): Observable<WorkflowProgressResponse> {
        return this.http
            .get<WorkflowProgressResponse>(
                `${this.API_BASE}/workflows/${sessionId}/progress`
            )
            .pipe(
                map((response) => {
                    this.workflowProgressSubject.next(response)
                    return response
                }),
                catchError(this.handleError)
            )
    }

    startWorkflowStep(sessionId: string, stepId: string): Observable<any> {
        return this.http
            .post(
                `${this.API_BASE}/workflows/${sessionId}/steps/${stepId}/start`,
                {}
            )
            .pipe(catchError(this.handleError))
    }

    completeWorkflowStep(
        sessionId: string,
        stepId: string,
        data?: any
    ): Observable<any> {
        return this.http
            .post(
                `${this.API_BASE}/workflows/${sessionId}/steps/${stepId}/complete`,
                {
                    step_id: stepId,
                    data: data,
                }
            )
            .pipe(catchError(this.handleError))
    }

    pauseWorkflow(sessionId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/workflows/${sessionId}/pause`, {})
            .pipe(catchError(this.handleError))
    }

    resumeWorkflow(sessionId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/workflows/${sessionId}/resume`, {})
            .pipe(catchError(this.handleError))
    }

    // Agent Management Methods
    getAgentTypes(): Observable<{ agent_types: string[] }> {
        return this.http
            .get<{ agent_types: string[] }>(`${this.API_BASE}/agents/types`)
            .pipe(catchError(this.handleError))
    }

    createAgent(
        agentType: string,
        sessionId: string,
        roomId: string,
        config?: any
    ): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/agents/create`, {
                agent_type: agentType,
                session_id: sessionId,
                room_id: roomId,
                config: config,
            })
            .pipe(catchError(this.handleError))
    }

    getAgentStatus(agentId: string): Observable<AgentStatusResponse> {
        return this.http
            .get<AgentStatusResponse>(
                `${this.API_BASE}/agents/${agentId}/status`
            )
            .pipe(
                map((response) => {
                    this.agentStatusSubject.next(response)
                    return response
                }),
                catchError(this.handleError)
            )
    }

    listAgents(
        limit?: number,
        offset?: number,
        status?: string,
        agentType?: string
    ): Observable<AgentStatusResponse[]> {
        const params: any = {}
        if (limit) params.limit = limit
        if (offset) params.offset = offset
        if (status) params.status = status
        if (agentType) params.agent_type = agentType

        return this.http
            .get<AgentStatusResponse[]>(`${this.API_BASE}/agents/`, { params })
            .pipe(catchError(this.handleError))
    }

    pauseAgent(agentId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/agents/${agentId}/pause`, {})
            .pipe(catchError(this.handleError))
    }

    resumeAgent(agentId: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/agents/${agentId}/resume`, {})
            .pipe(catchError(this.handleError))
    }

    destroyAgent(agentId: string): Observable<any> {
        return this.http
            .delete(`${this.API_BASE}/agents/${agentId}`)
            .pipe(catchError(this.handleError))
    }

    getAgentMetrics(agentId: string): Observable<any> {
        return this.http
            .get(`${this.API_BASE}/agents/${agentId}/metrics`)
            .pipe(catchError(this.handleError))
    }

    // Legacy API Compatibility Methods (for backward compatibility with existing UI)
    createRoom(): Observable<any> {
        // Map to new session creation
        return this.createSession({
            workflow_type: 'kyc',
            agent_type: 'kyc_agent',
            language: 'en',
        }).pipe(
            map((session) => ({
                roomId: session.room_id,
                customRoomId: session.session_id,
                agent: {
                    participantId: `agent_${session.session_id}`,
                    token: 'legacy_token', // This would need to be handled differently
                },
                client: {
                    participantId: `client_${session.session_id}`,
                    token: 'legacy_token', // This would need to be handled differently
                },
            }))
        )
    }

    joinAgent(
        roomId: string,
        agentParticipantId: string,
        agentToken: string,
        workflow?: any
    ): Observable<any> {
        // Use the new join-agent endpoint
        return this.http
            .post(`${this.API_BASE}/sessions/join-agent`, {
                room_id: roomId,
                agent_participant_id: agentParticipantId,
                agent_token: agentToken,
                workflow: workflow ? JSON.stringify(workflow) : '',
            })
            .pipe(catchError(this.handleError))
    }

    // Selfie Submission
    submitSelfie(roomId: string, selfieData: string): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/sessions/selfie/submit`, {
                room_id: roomId,
                selfie_data: selfieData,
            })
            .pipe(catchError(this.handleError))
    }

    // Verification Methods
    performLivenessDetection(
        image: File,
        threshold: number = 0.8
    ): Observable<any> {
        const formData = new FormData()
        formData.append('image', image)
        formData.append('threshold', threshold.toString())

        return this.http
            .post(`${this.API_BASE}/workflows/verification/liveness`, formData)
            .pipe(catchError(this.handleError))
    }

    performFaceMatch(
        sourceImage: File,
        targetImage: File,
        threshold: number = 0.75
    ): Observable<any> {
        const formData = new FormData()
        formData.append('source_image', sourceImage)
        formData.append('target_image', targetImage)
        formData.append('threshold', threshold.toString())

        return this.http
            .post(
                `${this.API_BASE}/workflows/verification/face-match`,
                formData
            )
            .pipe(catchError(this.handleError))
    }

    performFuzzyMatch(
        sourceText: string,
        targetText: string,
        threshold: number = 0.85
    ): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/workflows/verification/fuzzy-match`, {
                source_text: sourceText,
                target_text: targetText,
                threshold: threshold,
            })
            .pipe(catchError(this.handleError))
    }

    performIdVerification(
        documentImage: File,
        confidenceThreshold: number = 0.8
    ): Observable<any> {
        const formData = new FormData()
        formData.append('document_image', documentImage)
        formData.append('confidence_threshold', confidenceThreshold.toString())

        return this.http
            .post(
                `${this.API_BASE}/workflows/verification/id-verification`,
                formData
            )
            .pipe(catchError(this.handleError))
    }

    performBatchVerification(verificationTasks: any[]): Observable<any> {
        return this.http
            .post(`${this.API_BASE}/workflows/verification/batch`, {
                verification_tasks: verificationTasks,
            })
            .pipe(catchError(this.handleError))
    }

    checkVerificationHealth(): Observable<any> {
        return this.http
            .get(`${this.API_BASE}/workflows/verification/health`)
            .pipe(catchError(this.handleError))
    }

    // Utility Methods
    getCurrentSession(): SessionResponse | null {
        return this.currentSessionSubject.value
    }

    getCurrentWorkflowProgress(): WorkflowProgressResponse | null {
        return this.workflowProgressSubject.value
    }

    getCurrentAgentStatus(): AgentStatusResponse | null {
        return this.agentStatusSubject.value
    }

    getCurrentHealthStatus(): HealthResponse | null {
        return this.healthStatusSubject.value
    }

    // Error Handling
    private handleError(error: HttpErrorResponse): Observable<never> {
        let errorMessage = 'An unknown error occurred'

        if (error.error instanceof ErrorEvent) {
            // Client-side error
            errorMessage = `Client Error: ${error.error.message}`
        } else {
            // Server-side error
            errorMessage = `Server Error: ${error.status} - ${
                error.error?.detail || error.message
            }`
        }

        console.error('Enterprise API Error:', errorMessage, error)
        return throwError(() => new Error(errorMessage))
    }

    // Cleanup
    cleanup(): void {
        this.currentSessionSubject.next(null)
        this.workflowProgressSubject.next(null)
        this.agentStatusSubject.next(null)
        this.healthStatusSubject.next(null)
    }
}
