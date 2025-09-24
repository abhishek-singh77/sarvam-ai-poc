import { Injectable } from '@angular/core'
import { HttpClient, HttpParams } from '@angular/common/http'
import { Observable, BehaviorSubject, throwError } from 'rxjs'
import { map, catchError, tap } from 'rxjs/operators'
import { environment } from '../../environments/environment'

export interface KYCSessionRequest {
    room_id: string
    owner_id?: string
    sub_user_id?: string
    customer_identifier?: string
    customer_name?: string
    workflow_type?: string
}

export interface KYCSessionResponse {
    session_id: string
    room_id: string
    kyc_request_id: string
    status: string
    message: string
    workflow_steps: WorkflowStep[]
}

export interface WorkflowStep {
    id: string
    type: string
    title: string
    description: string
    order: number
    required: boolean
    ai_guidance: boolean
    parallel_processing: boolean
    status?: 'pending' | 'active' | 'completed' | 'failed'
    sub_actions?: SubAction[]
    verification?: any
    questions?: Question[]
}

export interface SubAction {
    id: string
    type: string
    title: string
    step: string
    required: boolean
    parallel?: boolean
}

export interface Question {
    id: string
    type: string
    question: string
    required: boolean
    validation?: any
}

export interface VerificationRequest {
    session_id: string
    step_id: string
    data: any
}

export interface VerificationResponse {
    status: string
    step_id: string
    result: any
    message: string
    timestamp: string
}

export interface ParallelTaskRequest {
    session_id: string
    tasks: ParallelTask[]
    priority: 'low' | 'normal' | 'high' | 'critical'
}

export interface ParallelTask {
    name: string
    type: string
    data: any
    timeout?: number
    max_retries?: number
    metadata?: any
}

export interface ParallelTaskResponse {
    status: string
    task_ids: string[]
    message: string
}

export interface TaskStatus {
    id: string
    name: string
    type: string
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    priority: number
    created_at: string
    started_at?: string
    completed_at?: string
    retry_count: number
    result?: any
    error?: string
}

export interface SessionStatus {
    session_id: string
    room_id: string
    kyc_request_id: string
    verification_status: string
    compliance_status: string
    risk_score: number
    workflow_progress: {
        current_step: number
        total_steps: number
        completed_steps: number
    }
    verification_results: any
    assistance_interactions: number
}

@Injectable({
    providedIn: 'root',
})
export class EnhancedKYCService {
    private readonly baseUrl = `${environment.apiUrl}/api/v1/enhanced-kyc`

    // Session state
    private currentSessionSubject =
        new BehaviorSubject<KYCSessionResponse | null>(null)
    public currentSession$ = this.currentSessionSubject.asObservable()

    private sessionStatusSubject = new BehaviorSubject<SessionStatus | null>(
        null
    )
    public sessionStatus$ = this.sessionStatusSubject.asObservable()

    // Task monitoring
    private activeTasksSubject = new BehaviorSubject<string[]>([])
    public activeTasks$ = this.activeTasksSubject.asObservable()

    private taskStatusesSubject = new BehaviorSubject<Map<string, TaskStatus>>(
        new Map()
    )
    public taskStatuses$ = this.taskStatusesSubject.asObservable()

    constructor(private http: HttpClient) {}

    // Session Management
    startKYCSession(
        request: KYCSessionRequest
    ): Observable<KYCSessionResponse> {
        return this.http
            .post<KYCSessionResponse>(`${this.baseUrl}/session/start`, request)
            .pipe(
                tap((response) => {
                    this.currentSessionSubject.next(response)
                    console.log(
                        '🚀 Enhanced KYC session started:',
                        response.session_id
                    )
                }),
                catchError(this.handleError)
            )
    }

    getSessionStatus(sessionId: string): Observable<SessionStatus> {
        return this.http
            .get<{ summary: SessionStatus }>(
                `${this.baseUrl}/session/${sessionId}/status`
            )
            .pipe(
                map((response) => response.summary),
                tap((status) => {
                    this.sessionStatusSubject.next(status)
                    console.log('📊 Session status updated:', status)
                }),
                catchError(this.handleError)
            )
    }

    endKYCSession(sessionId: string): Observable<any> {
        return this.http
            .post(`${this.baseUrl}/session/${sessionId}/end`, {})
            .pipe(
                tap(() => {
                    this.currentSessionSubject.next(null)
                    this.sessionStatusSubject.next(null)
                    console.log('🔚 Enhanced KYC session ended:', sessionId)
                }),
                catchError(this.handleError)
            )
    }

    // Workflow Step Management
    processWorkflowStep(
        request: VerificationRequest
    ): Observable<VerificationResponse> {
        return this.http
            .post<VerificationResponse>(
                `${this.baseUrl}/workflow/step/process`,
                request
            )
            .pipe(
                tap((response) => {
                    console.log('🔄 Workflow step processed:', response.step_id)
                }),
                catchError(this.handleError)
            )
    }

    // Parallel Processing
    submitParallelTasks(
        request: ParallelTaskRequest
    ): Observable<ParallelTaskResponse> {
        return this.http
            .post<ParallelTaskResponse>(
                `${this.baseUrl}/parallel/tasks/submit`,
                request
            )
            .pipe(
                tap((response) => {
                    const currentTasks = this.activeTasksSubject.value
                    this.activeTasksSubject.next([
                        ...currentTasks,
                        ...response.task_ids,
                    ])
                    console.log(
                        '🚀 Parallel tasks submitted:',
                        response.task_ids
                    )
                }),
                catchError(this.handleError)
            )
    }

    getTaskStatus(taskId: string): Observable<TaskStatus> {
        return this.http
            .get<{ task_status: TaskStatus }>(
                `${this.baseUrl}/parallel/tasks/${taskId}/status`
            )
            .pipe(
                map((response) => response.task_status),
                tap((status) => {
                    const currentStatuses = this.taskStatusesSubject.value
                    currentStatuses.set(taskId, status)
                    this.taskStatusesSubject.next(new Map(currentStatuses))

                    // Remove completed/failed tasks from active tasks
                    if (
                        status.status === 'completed' ||
                        status.status === 'failed' ||
                        status.status === 'cancelled'
                    ) {
                        const currentTasks = this.activeTasksSubject.value
                        this.activeTasksSubject.next(
                            currentTasks.filter((id) => id !== taskId)
                        )
                    }
                }),
                catchError(this.handleError)
            )
    }

    getAllTasksStatus(): Observable<any> {
        return this.http
            .get<{ tasks_status: any }>(`${this.baseUrl}/parallel/tasks/status`)
            .pipe(
                map((response) => response.tasks_status),
                catchError(this.handleError)
            )
    }

    cancelTask(taskId: string): Observable<any> {
        return this.http
            .post(`${this.baseUrl}/parallel/tasks/${taskId}/cancel`, {})
            .pipe(
                tap(() => {
                    const currentTasks = this.activeTasksSubject.value
                    this.activeTasksSubject.next(
                        currentTasks.filter((id) => id !== taskId)
                    )
                    console.log('❌ Task cancelled:', taskId)
                }),
                catchError(this.handleError)
            )
    }

    waitForTasks(taskIds: string[], timeout?: number): Observable<any> {
        const params = new HttpParams().set(
            'timeout',
            timeout?.toString() || '60'
        )

        return this.http
            .post(`${this.baseUrl}/parallel/tasks/wait`, taskIds, { params })
            .pipe(
                tap((result) => {
                    console.log('⏳ Tasks completed:', result)
                }),
                catchError(this.handleError)
            )
    }

    // Enhanced Verification
    enhancedLivenessDetection(
        sessionId: string,
        image: File,
        threshold: number = 0.8,
        realTime: boolean = true
    ): Observable<any> {
        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('image', image)
        formData.append('threshold', threshold.toString())
        formData.append('real_time', realTime.toString())

        return this.http
            .post(`${this.baseUrl}/verification/liveness/enhanced`, formData)
            .pipe(
                tap((result) => {
                    console.log(
                        '🔍 Enhanced liveness detection completed:',
                        result
                    )
                }),
                catchError(this.handleError)
            )
    }

    enhancedFaceMatching(
        sessionId: string,
        sourceImage: File,
        targetImage: File,
        threshold: number = 0.75
    ): Observable<any> {
        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('source_image', sourceImage)
        formData.append('target_image', targetImage)
        formData.append('threshold', threshold.toString())

        return this.http
            .post(`${this.baseUrl}/verification/face-match/enhanced`, formData)
            .pipe(
                tap((result) => {
                    console.log('🔍 Enhanced face matching completed:', result)
                }),
                catchError(this.handleError)
            )
    }

    enhancedFuzzyMatching(
        sessionId: string,
        sourceText: string,
        targetText: string,
        threshold: number = 0.8,
        algorithm: string = 'levenshtein'
    ): Observable<any> {
        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('source_text', sourceText)
        formData.append('target_text', targetText)
        formData.append('threshold', threshold.toString())
        formData.append('algorithm', algorithm)

        return this.http
            .post(`${this.baseUrl}/verification/fuzzy-match/enhanced`, formData)
            .pipe(
                tap((result) => {
                    console.log('🔍 Enhanced fuzzy matching completed:', result)
                }),
                catchError(this.handleError)
            )
    }

    enhancedDocumentVerification(
        sessionId: string,
        documentImage: File,
        confidenceThreshold: number = 0.8
    ): Observable<any> {
        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('document_image', documentImage)
        formData.append('confidence_threshold', confidenceThreshold.toString())

        return this.http
            .post(`${this.baseUrl}/verification/document/enhanced`, formData)
            .pipe(
                tap((result) => {
                    console.log(
                        '📄 Enhanced document verification completed:',
                        result
                    )
                }),
                catchError(this.handleError)
            )
    }

    comprehensiveVerification(
        sessionId: string,
        selfieImage: File,
        documentImage: File,
        questionnaireData: any,
        livenessThreshold: number = 0.8,
        faceMatchThreshold: number = 0.75,
        fuzzyMatchThreshold: number = 0.8
    ): Observable<any> {
        const formData = new FormData()
        formData.append('session_id', sessionId)
        formData.append('selfie_image', selfieImage)
        formData.append('document_image', documentImage)
        formData.append('questionnaire_data', JSON.stringify(questionnaireData))
        formData.append('liveness_threshold', livenessThreshold.toString())
        formData.append('face_match_threshold', faceMatchThreshold.toString())
        formData.append('fuzzy_match_threshold', fuzzyMatchThreshold.toString())

        return this.http
            .post(`${this.baseUrl}/verification/comprehensive`, formData)
            .pipe(
                tap((result) => {
                    console.log(
                        '🔍 Comprehensive verification completed:',
                        result
                    )
                }),
                catchError(this.handleError)
            )
    }

    // AI Agent Communication
    sendAgentMessage(sessionId: string, message: string): Observable<any> {
        return this.http
            .post(`${this.baseUrl}/agent/message`, {
                session_id: sessionId,
                message: message,
            })
            .pipe(
                tap((response) => {
                    console.log('💬 Agent message processed:', response)
                }),
                catchError(this.handleError)
            )
    }

    // Health Check
    healthCheck(): Observable<any> {
        return this.http.get(`${this.baseUrl}/health`).pipe(
            tap((health) => {
                console.log('🏥 Enhanced KYC service health:', health)
            }),
            catchError(this.handleError)
        )
    }

    // Utility Methods
    getCurrentSession(): KYCSessionResponse | null {
        return this.currentSessionSubject.value
    }

    getCurrentSessionStatus(): SessionStatus | null {
        return this.sessionStatusSubject.value
    }

    getActiveTasks(): string[] {
        return this.activeTasksSubject.value
    }

    getTaskStatus(taskId: string): TaskStatus | undefined {
        return this.taskStatusesSubject.value.get(taskId)
    }

    // Task Monitoring
    startTaskMonitoring(taskIds: string[]): void {
        const interval = setInterval(() => {
            const activeTasks = this.activeTasksSubject.value
            if (activeTasks.length === 0) {
                clearInterval(interval)
                return
            }

            activeTasks.forEach((taskId) => {
                this.getTaskStatus(taskId).subscribe()
            })
        }, 2000) // Check every 2 seconds
    }

    // Progress Calculation
    calculateProgress(): number {
        const status = this.getCurrentSessionStatus()
        if (!status) return 0

        const { completed_steps, total_steps } = status.workflow_progress
        return total_steps > 0 ? (completed_steps / total_steps) * 100 : 0
    }

    // Error Handling
    private handleError(error: any): Observable<never> {
        console.error('❌ Enhanced KYC Service Error:', error)
        return throwError(() => error)
    }

    // Cleanup
    cleanup(): void {
        this.currentSessionSubject.next(null)
        this.sessionStatusSubject.next(null)
        this.activeTasksSubject.next([])
        this.taskStatusesSubject.next(new Map())
    }
}
