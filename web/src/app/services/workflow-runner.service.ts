import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { StepHandlerRegistry } from './step-handlers/step-handler.registry'
import { StepHandler } from './step-handlers/step-handler.interface'
import {
    SessionStorageService,
    WorkflowConfig as SessionWorkflowConfig,
} from './session-storage.service'

export interface SubAction {
    type:
        | 'GEO_TAGGING'
        | 'USER_INSTRUCTION'
        | 'AGENT_INSTRUCTION'
        | 'FRAME_CAPTURE'
        | 'QUESTIONNAIRE'
    title?: string
    sub_action_ref?: string
    description?: string
    optional: boolean
    id_analysis_required: boolean
    face_match_obj_type: 'none' | 'source' | 'match_required'
    perform_enrichment: boolean
    sub_action_step: 'pre' | 'in_call' | 'post'
    allow_ocr_data_update?: boolean
    perform_liveness_check?: boolean
    perform_face_match_in_sync?: boolean
    perform_central_db_check_in_sync?: boolean
    allow_face_match_result_update?: boolean
    frame_capture_type?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE'
    strict_validation_type?: 'pan' | 'aadhaar'
    central_db_lookup_source?: string
    face_match_sources?: string[]
    allow_fuzzy_match_result_update?: boolean
    sub_action_name?: string
    image_upload_mode?: 'NA' | 'FRONT_BACK'
    questionnaire?: {
        questions: Array<{
            title: string
            validated: boolean
            input_type: string
            otp_check: boolean
            mandatory: boolean
        }>
    }
    check_distance_from_input_address?: boolean
    input_address?: string
}

export interface Actionable {
    type: string
    action_ref: string
    title: string
    description: string
    allow_image_upload: boolean
    image_upload_mode: string
    validation_mode: string
    id_analysis_required: boolean
    face_match_obj_type: string
    video_length: number
    allow_ocr_data_update: boolean
    sub_actions: SubAction[]
    action_config: {
        enable_human_handoff: boolean
        max_customer_wait_time_in_seconds: number
        agent_background_url: string
    }
    approval_rule: any[]
    optional: boolean
    allow_call_scheduling_by_user: boolean
}

export interface WorkflowConfig {
    request_params: string[]
    actionables: Actionable[]
    additional_validations: any[]
    show_steps: boolean
    show_skipped_steps: boolean
    request_status_invocations: any
}

export interface WorkflowStep {
    id: string
    type: SubAction['type']
    title: string
    description: string
    status: 'pending' | 'active' | 'completed' | 'skipped' | 'error'
    phase: 'pre' | 'in_call' | 'post'
    data?: any
    error?: string
    subAction: SubAction
}

export interface WorkflowState {
    currentStep: WorkflowStep | null
    steps: WorkflowStep[]
    phase: 'pre' | 'in_call' | 'post'
    isComplete: boolean
    canJoinCall: boolean
    error?: string
}

@Injectable({
    providedIn: 'root',
})
export class WorkflowRunnerService {
    private workflowConfig: WorkflowConfig | null = null
    private isWorkflowLoaded = false
    private currentState: WorkflowState = {
        currentStep: null,
        steps: [],
        phase: 'pre',
        isComplete: false,
        canJoinCall: false,
    }

    private stateSubject = new BehaviorSubject<WorkflowState>(this.currentState)
    public state$ = this.stateSubject.asObservable()

    // Step execution tracking
    private stepIndex = 0
    private isExecuting = false
    private currentHandler: StepHandler | null = null

    constructor(
        private http: HttpClient,
        private stepHandlerRegistry: StepHandlerRegistry,
        private sessionStorage: SessionStorageService
    ) {}

    async loadWorkflow(): Promise<void> {
        if (this.isWorkflowLoaded) {
            console.log('🎯 WORKFLOW-RUNNER: Workflow already loaded, skipping')
            return
        }

        // First check if we have workflow config in session storage
        let config = this.sessionStorage.getWorkflowConfig()

        if (!config) {
            try {
                console.log(
                    '🎯 WORKFLOW-RUNNER: Loading workflow configuration from assets...'
                )
                const httpConfig = await this.http
                    .get<WorkflowConfig>('/assets/workflow.json')
                    .toPromise()

                if (httpConfig) {
                    // Save to session storage for future use
                    this.sessionStorage.saveWorkflowConfig(httpConfig)
                    console.log(
                        '🎯 WORKFLOW-RUNNER: Workflow config saved to session storage'
                    )

                    // Use the original config for processing
                    config = httpConfig
                }
            } catch (error) {
                console.error(
                    '🎯 WORKFLOW-RUNNER: Failed to load workflow:',
                    error
                )
                throw error
            }
        } else {
            console.log(
                '🎯 WORKFLOW-RUNNER: Using workflow config from session storage'
            )
            // Use the config directly as it's already in the correct format
        }

        if (config) {
            this.workflowConfig = config
            this.isWorkflowLoaded = true
            this.initializeSteps()
            console.log(
                '🎯 WORKFLOW-RUNNER: Workflow loaded successfully',
                this.currentState.steps.length,
                'steps'
            )
        }
    }

    private initializeSteps(): void {
        if (!this.workflowConfig) return

        const steps: WorkflowStep[] = []

        // Process all actionables and their sub_actions
        for (const actionable of this.workflowConfig.actionables) {
            for (const subAction of actionable.sub_actions) {
                const step: WorkflowStep = {
                    id:
                        subAction.sub_action_ref ||
                        `${subAction.type}-${steps.length}`,
                    type: subAction.type,
                    title:
                        subAction.title ||
                        subAction.sub_action_name ||
                        subAction.type,
                    description: subAction.description || '',
                    status: 'pending',
                    phase: subAction.sub_action_step,
                    subAction: subAction,
                }
                steps.push(step)
            }
        }

        // Sort steps by phase (pre, in_call, post) and maintain order within each phase
        steps.sort((a, b) => {
            const phaseOrder = { pre: 0, in_call: 1, post: 2 }
            const phaseDiff = phaseOrder[a.phase] - phaseOrder[b.phase]
            if (phaseDiff !== 0) return phaseDiff

            // Maintain original order within same phase
            return steps.indexOf(a) - steps.indexOf(b)
        })

        this.currentState.steps = steps
        this.currentState.phase = 'pre'
        this.updateState()
    }

    async startWorkflow(): Promise<void> {
        if (this.isExecuting) {
            console.warn('🎯 WORKFLOW-RUNNER: Workflow already executing')
            return
        }

        if (!this.workflowConfig) {
            await this.loadWorkflow()
        }

        this.isExecuting = true
        this.stepIndex = 0
        this.currentState.phase = 'pre'
        this.currentState.isComplete = false
        this.currentState.error = undefined

        console.log('🎯 WORKFLOW-RUNNER: Starting workflow execution...')
        await this.executeNextStep()
    }

    async executeNextStep(): Promise<void> {
        if (this.stepIndex >= this.currentState.steps.length) {
            this.completeWorkflow()
            return
        }

        const step = this.currentState.steps[this.stepIndex]
        this.currentState.currentStep = step
        step.status = 'active'
        this.updateState()

        console.log(
            '🎯 WORKFLOW-RUNNER: Executing step:',
            step.title,
            step.type
        )

        try {
            await this.executeStep(step)
            step.status = 'completed'
            this.stepIndex++

            // Check if pre-call steps are complete
            this.checkPreCallComplete()

            // Auto-advance to next step after a short delay
            setTimeout(() => {
                if (this.isExecuting) {
                    this.executeNextStep()
                }
            }, 1000)
        } catch (error) {
            console.error('🎯 WORKFLOW-RUNNER: Step execution failed:', error)
            step.status = 'error'
            step.error =
                error instanceof Error ? error.message : 'Unknown error'
            this.currentState.error = step.error
            this.updateState()
        }
    }

    private async executeStep(step: WorkflowStep): Promise<void> {
        const handler = this.stepHandlerRegistry.getHandler(step)

        if (!handler) {
            console.warn(
                '🎯 WORKFLOW-RUNNER: No handler found for step type:',
                step.type
            )
            return
        }

        this.currentHandler = handler

        try {
            const result = await handler.start(step).toPromise()

            if (result?.success) {
                step.data = { ...step.data, ...result.data }

                if (result.shouldProceed) {
                    await handler.complete(step, result.data).toPromise()
                }
            } else {
                step.status = 'error'
                step.error = result?.error || 'Step execution failed'
                throw new Error(step.error)
            }
        } catch (error) {
            console.error('🎯 WORKFLOW-RUNNER: Step execution failed:', error)
            step.status = 'error'
            step.error =
                error instanceof Error ? error.message : 'Unknown error'
            throw error
        } finally {
            this.currentHandler = null
        }
    }

    /**
     * Check if pre-call steps are complete
     */
    private checkPreCallComplete(): void {
        const preSteps = this.getPreCallSteps()
        const allPreStepsComplete = preSteps.every(
            (step) => step.status === 'completed' || step.status === 'skipped'
        )

        this.currentState.canJoinCall = allPreStepsComplete

        if (allPreStepsComplete && this.currentState.phase === 'pre') {
            console.log(
                '🎯 WORKFLOW-RUNNER: Pre-call steps complete, ready to join call'
            )
        }

        this.updateState()
    }

    completeWorkflow(): void {
        this.isExecuting = false
        this.currentState.isComplete = true
        this.currentState.currentStep = null
        this.updateState()
        console.log('🎯 WORKFLOW-RUNNER: Workflow completed successfully')
    }

    skipCurrentStep(): void {
        if (this.currentState.currentStep) {
            this.currentState.currentStep.status = 'skipped'
            this.stepIndex++
            this.executeNextStep()
        }
    }

    retryCurrentStep(): void {
        if (this.currentState.currentStep && this.currentHandler) {
            this.currentState.currentStep.status = 'pending'
            this.currentState.currentStep.error = undefined

            // Use handler's retry method
            this.currentHandler.retry(this.currentState.currentStep).subscribe({
                next: (result) => {
                    if (result.success) {
                        this.currentState.currentStep!.status = 'completed'
                        this.currentState.currentStep!.data = {
                            ...this.currentState.currentStep!.data,
                            ...result.data,
                        }
                        this.checkPreCallComplete()
                    } else {
                        this.currentState.currentStep!.status = 'error'
                        this.currentState.currentStep!.error = result.error
                    }
                    this.updateState()
                },
                error: (error) => {
                    this.currentState.currentStep!.status = 'error'
                    this.currentState.currentStep!.error = error.message
                    this.updateState()
                },
            })
        }
    }

    /**
     * Retry a specific step by ID
     */
    retryStep(stepId: string): void {
        const step = this.currentState.steps.find((s) => s.id === stepId)
        if (step) {
            const handler = this.stepHandlerRegistry.getHandler(step)
            if (handler) {
                step.status = 'pending'
                step.error = undefined

                handler.retry(step).subscribe({
                    next: (result) => {
                        if (result.success) {
                            step.status = 'completed'
                            step.data = { ...step.data, ...result.data }
                            this.checkPreCallComplete()
                        } else {
                            step.status = 'error'
                            step.error = result.error
                        }
                        this.updateState()
                    },
                    error: (error) => {
                        step.status = 'error'
                        step.error = error.message
                        this.updateState()
                    },
                })
            }
        }
    }

    /**
     * Get UI state for current step
     */
    getCurrentStepUIState(): any {
        if (this.currentState.currentStep && this.currentHandler) {
            return this.currentHandler.getUIState(this.currentState.currentStep)
        }
        return null
    }

    getCurrentStep(): WorkflowStep | null {
        return this.currentState.currentStep
    }

    completeCurrentStep(): void {
        if (this.currentState.currentStep) {
            this.currentState.currentStep.status = 'completed'
            console.log(
                '🎯 WORKFLOW-RUNNER: Completed step:',
                this.currentState.currentStep.id
            )
            this.executeNextStep()
        }
    }

    getStepsByPhase(phase: 'pre' | 'in_call' | 'post'): WorkflowStep[] {
        return this.currentState.steps.filter((step) => step.phase === phase)
    }

    getPreCallSteps(): WorkflowStep[] {
        return this.getStepsByPhase('pre')
    }

    getInCallSteps(): WorkflowStep[] {
        return this.getStepsByPhase('in_call')
    }

    getPostCallSteps(): WorkflowStep[] {
        return this.getStepsByPhase('post')
    }

    isPreCallComplete(): boolean {
        const preSteps = this.getPreCallSteps()
        return preSteps.every(
            (step) => step.status === 'completed' || step.status === 'skipped'
        )
    }

    canStartCall(): boolean {
        return this.isPreCallComplete() && this.currentState.phase === 'pre'
    }

    startCallPhase(): void {
        if (this.canStartCall()) {
            this.currentState.phase = 'in_call'
            this.updateState()
            console.log('🎯 WORKFLOW-RUNNER: Starting call phase...')
        }
    }

    private updateState(): void {
        this.stateSubject.next({ ...this.currentState })
    }

    getWorkflowConfig(): WorkflowConfig | null {
        return this.workflowConfig
    }

    reset(): void {
        this.workflowConfig = null
        this.currentState = {
            currentStep: null,
            steps: [],
            phase: 'pre',
            isComplete: false,
            canJoinCall: false,
        }
        this.stepIndex = 0
        this.isExecuting = false
        this.currentHandler = null
        this.updateState()
    }
}
