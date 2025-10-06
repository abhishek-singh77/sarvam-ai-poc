import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { HttpClient } from '@angular/common/http'
import { StepHandlerRegistry } from './step-handlers/step-handler.registry'
import { StepHandler } from './step-handlers/step-handler.interface'
import {
    SessionStorageService,
    WorkflowConfig as SessionWorkflowConfig,
} from './session-storage.service'
import { AgentWorkflowService } from './agent-workflow.service'
import { environment } from '../../environments/environment'

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
    analysisResult?: any
    order?: number
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
        private sessionStorage: SessionStorageService,
        private agentWorkflowService: AgentWorkflowService
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
        let stepOrder = 0

        // Process all actionables and their sub_actions
        for (const actionable of this.workflowConfig.actionables) {
            for (const subAction of actionable.sub_actions) {
                // Debug: Log sub-action processing
                console.log('🎯 WORKFLOW-RUNNER: Processing sub-action:', {
                    type: subAction.type,
                    title: subAction.title,
                    sub_action_step: subAction.sub_action_step,
                    sub_action_ref: subAction.sub_action_ref,
                })

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
                    order: stepOrder++, // Add explicit order to maintain sequence
                    data: {
                        // Copy relevant data from subAction to step.data
                        frame_capture_type: (subAction as any)
                            .frame_capture_type,
                        captureType: (subAction as any).frame_capture_type,
                        ...subAction,
                    },
                }
                steps.push(step)
            }
        }

        // Sort steps by phase (pre, in_call, post) and maintain order within each phase
        steps.sort((a, b) => {
            const phaseOrder = { pre: 0, in_call: 1, post: 2 }
            const phaseDiff = phaseOrder[a.phase] - phaseOrder[b.phase]
            if (phaseDiff !== 0) return phaseDiff

            // For in_call steps, maintain the order: QUESTIONNAIRE first, then FRAME_CAPTURE steps
            if (a.phase === 'in_call' && b.phase === 'in_call') {
                // QUESTIONNAIRE should come first
                if (a.type === 'QUESTIONNAIRE' && b.type !== 'QUESTIONNAIRE')
                    return -1
                if (b.type === 'QUESTIONNAIRE' && a.type !== 'QUESTIONNAIRE')
                    return 1

                // Then FRAME_CAPTURE steps in their original order
                if (a.type === 'FRAME_CAPTURE' && b.type === 'FRAME_CAPTURE') {
                    return (a.order || 0) - (b.order || 0)
                }
            }

            // Maintain original order within same phase using explicit order
            return (a.order || 0) - (b.order || 0)
        })

        console.log(
            '🎯 WORKFLOW-RUNNER: Initialized steps in order:',
            steps.map((s) => ({
                id: s.id,
                title: s.title,
                type: s.type,
                phase: s.phase,
                order: (s as any).order,
            }))
        )

        this.currentState.steps = steps

        // Since we removed pre-call steps, start directly with in_call phase
        const hasInCallSteps = steps.some((step) => step.phase === 'in_call')
        this.currentState.phase = hasInCallSteps ? 'in_call' : 'pre'

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
        this.currentState.isComplete = false
        this.currentState.error = undefined

        // Since we removed pre-call steps, start directly with in_call workflow
        if (this.currentState.phase === 'in_call') {
            console.log(
                '🎯 WORKFLOW-RUNNER: Starting in-call workflow directly...'
            )
            await this.startInCallWorkflow()
        } else {
            console.log('🎯 WORKFLOW-RUNNER: Starting workflow execution...')
            this.stepIndex = 0
            await this.executeNextStep()
        }
    }

    async executeNextStep(): Promise<void> {
        // Only work with in-call steps
        const inCallSteps = this.getInCallSteps()
        console.log(
            '🎯 WORKFLOW-RUNNER: executeNextStep called:',
            'Step index:',
            this.stepIndex,
            'Total in-call steps:',
            inCallSteps.length,
            'In-call steps:',
            inCallSteps.map((s) => ({
                id: s.id,
                title: s.title,
                type: s.type,
                status: s.status,
            }))
        )

        if (this.stepIndex >= inCallSteps.length) {
            console.log(
                '🎯 WORKFLOW-RUNNER: All steps completed, finishing workflow'
            )
            this.completeWorkflow()
            return
        }

        const step = inCallSteps[this.stepIndex]

        // Skip if step is already completed
        if (step.status === 'completed') {
            console.log(
                '🎯 WORKFLOW-RUNNER: Step already completed, skipping:',
                step.id
            )
            this.stepIndex++
            this.executeNextStep()
            return
        }

        this.currentState.currentStep = step
        step.status = 'active'
        console.log(
            '🎯 WORKFLOW-RUNNER: Set current step to:',
            step.title,
            step.id,
            'Type:',
            step.type
        )
        this.updateState()
        console.log(
            '🎯 WORKFLOW-RUNNER: Updated state, current step is now:',
            this.currentState.currentStep?.title,
            'Type:',
            this.currentState.currentStep?.type
        )

        console.log(
            '🎯 WORKFLOW-RUNNER: Executing in-call step:',
            step.title,
            step.type,
            'Phase:',
            step.phase,
            'Step Index:',
            this.stepIndex
        )

        try {
            await this.executeStep(step)

            // For FRAME_CAPTURE and QUESTIONNAIRE steps, don't auto-complete - wait for manual completion
            if (
                step.type === 'FRAME_CAPTURE' ||
                step.type === 'QUESTIONNAIRE'
            ) {
                console.log(
                    `🎯 WORKFLOW-RUNNER: ${step.type} step started, waiting for completion`
                )
                // Don't mark as completed or advance - wait for completeCurrentStep() to be called
                return
            }

            // For other step types, mark as completed and move to next step
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
            const errorMessage = `No handler found for step type: ${step.type}`
            console.error('🎯 WORKFLOW-RUNNER:', errorMessage)
            step.status = 'error'
            step.error = errorMessage
            this.updateState()
            throw new Error(errorMessage)
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

    private moveToNextStep(): void {
        console.log(
            '🎯 WORKFLOW-RUNNER: moveToNextStep called, current step index:',
            this.stepIndex
        )

        // Increment step index first
        this.stepIndex++

        const nextStep = this.getNextInCallStep()
        if (nextStep) {
            console.log(
                '🎯 WORKFLOW-RUNNER: Moving to next in-call step:',
                nextStep.id,
                nextStep.title,
                nextStep.type
            )
            this.currentState.currentStep = nextStep
            console.log(
                '🎯 WORKFLOW-RUNNER: Updated step index to:',
                this.stepIndex,
                'Current step is now:',
                this.currentState.currentStep.title,
                'Type:',
                this.currentState.currentStep.type
            )
        } else {
            console.log(
                '🎯 WORKFLOW-RUNNER: No more in-call steps, workflow complete'
            )
            this.currentState.currentStep = null
            this.currentState.isComplete = true
        }
    }

    async completeCurrentStep(): Promise<void> {
        console.log(
            '🎯 WORKFLOW-RUNNER: completeCurrentStep called, current step:',
            this.currentState.currentStep?.title,
            'Type:',
            this.currentState.currentStep?.type,
            'Step index:',
            this.stepIndex
        )

        if (this.currentState.currentStep) {
            const step = this.currentState.currentStep
            step.status = 'completed'

            console.log(
                '🎯 WORKFLOW-RUNNER: Completing step:',
                step.title,
                step.type,
                'Step index:',
                this.stepIndex
            )

            // Call backend API to complete the step
            try {
                await this.callStepCompletionAPI(step)
                console.log(
                    '🎯 WORKFLOW-RUNNER: Step completion API call successful'
                )

                // Notify agent workflow service about step completion
                const nextStep = this.getNextInCallStep()
                this.agentWorkflowService.handleStepCompletion(step, nextStep)

                // Move to next step and continue execution
                this.moveToNextStep()
                this.updateState()

                console.log(
                    '🎯 WORKFLOW-RUNNER: After moveToNextStep, current step:',
                    this.currentState.currentStep?.title,
                    'Type:',
                    this.currentState.currentStep?.type
                )

                // Continue with next step if there is one
                if (this.currentState.currentStep) {
                    console.log(
                        '🎯 WORKFLOW-RUNNER: Moving to next step:',
                        this.currentState.currentStep.title
                    )
                    // Use setTimeout to avoid blocking the current execution
                    setTimeout(() => {
                        if (this.isExecuting) {
                            this.executeNextStep()
                        }
                    }, 1000)
                } else {
                    console.log(
                        '🎯 WORKFLOW-RUNNER: No more steps, completing workflow'
                    )
                    this.completeWorkflow()
                }
            } catch (error) {
                console.error(
                    '🎯 WORKFLOW-RUNNER: Failed to complete step on backend:',
                    error
                )
                step.status = 'error'
                step.error =
                    error instanceof Error
                        ? error.message
                        : 'Failed to complete step'
                this.updateState()

                // Even if API call fails, try to move to next step to keep workflow progressing
                console.log(
                    '🎯 WORKFLOW-RUNNER: Attempting to continue workflow despite API error'
                )
                this.moveToNextStep()
                this.updateState()

                if (this.currentState.currentStep) {
                    setTimeout(() => {
                        if (this.isExecuting) {
                            this.executeNextStep()
                        }
                    }, 1000)
                }
            }
        } else {
            console.error('🎯 WORKFLOW-RUNNER: No current step to complete!')
            console.log('🎯 WORKFLOW-RUNNER: Current state:', this.currentState)
        }
    }

    private async callStepCompletionAPI(step: WorkflowStep): Promise<void> {
        // Get session ID from session storage
        const sessionData = this.sessionStorage.getSessionData()
        if (!sessionData?.sessionId) {
            console.error(
                '🎯 WORKFLOW-RUNNER: No session ID found in session storage'
            )
            console.log('🎯 WORKFLOW-RUNNER: Session data:', sessionData)
            throw new Error('No session ID found')
        }
        const sessionId = sessionData.sessionId

        console.log('🎯 WORKFLOW-RUNNER: Calling step completion API:', {
            sessionId,
            stepId: step.id,
            stepType: step.type,
            stepData: step.data,
        })

        try {
            // Call the correct step completion API endpoint
            const response = await fetch(
                `${environment.apiUrl}/kyc/workflow-submissions/steps/${sessionId}/${step.id}/complete`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        step_id: step.id,
                        data: step.data || {},
                    }),
                }
            )

            if (!response.ok) {
                const errorText = await response.text()
                console.error(
                    '🎯 WORKFLOW-RUNNER: Step completion API failed:',
                    {
                        status: response.status,
                        statusText: response.statusText,
                        errorText,
                    }
                )
                throw new Error(
                    `Step completion failed: ${response.statusText} - ${errorText}`
                )
            }

            const result = await response.json()
            console.log(
                '🎯 WORKFLOW-RUNNER: Step completion API response:',
                result
            )

            // Update step data with API response
            if (result.data) {
                step.data = { ...step.data, ...result.data }
            }
        } catch (error) {
            console.error(
                '🎯 WORKFLOW-RUNNER: Step completion API call failed:',
                error
            )
            throw error
        }
    }

    getStepsByPhase(phase: 'pre' | 'in_call' | 'post'): WorkflowStep[] {
        const filteredSteps = this.currentState.steps.filter(
            (step) => step.phase === phase
        )
        // Debug: Log filtered steps
        console.log(
            `🎯 WORKFLOW-RUNNER: Getting ${phase} steps:`,
            filteredSteps.map((s) => ({
                id: s.id,
                title: s.title,
                type: s.type,
                phase: s.phase,
            }))
        )
        return filteredSteps
    }

    private getNextStep(): WorkflowStep | null {
        const nextIndex = this.stepIndex + 1
        if (nextIndex < this.currentState.steps.length) {
            return this.currentState.steps[nextIndex]
        }
        return null
    }

    private getNextInCallStep(): WorkflowStep | null {
        const inCallSteps = this.getInCallSteps()
        console.log(
            '🎯 WORKFLOW-RUNNER: Getting next in-call step:',
            'Current step index:',
            this.stepIndex,
            'Total in-call steps:',
            inCallSteps.length,
            'In-call steps:',
            inCallSteps.map((s) => ({ id: s.id, title: s.title, type: s.type }))
        )
        if (this.stepIndex < inCallSteps.length) {
            const nextStep = inCallSteps[this.stepIndex]
            console.log(
                '🎯 WORKFLOW-RUNNER: Found next step:',
                nextStep.id,
                nextStep.title,
                nextStep.type
            )
            return nextStep
        }
        console.log('🎯 WORKFLOW-RUNNER: No next step found')
        return null
    }

    getPreCallSteps(): WorkflowStep[] {
        return this.getStepsByPhase('pre')
    }

    getInCallSteps(): WorkflowStep[] {
        const inCallSteps = this.getStepsByPhase('in_call')
        // Debug: Log in-call steps
        console.log(
            '🎯 WORKFLOW-RUNNER: Getting in-call steps:',
            inCallSteps.map((s) => ({
                id: s.id,
                title: s.title,
                type: s.type,
                phase: s.phase,
            }))
        )
        return inCallSteps
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

    async startInCallWorkflow(): Promise<void> {
        console.log('🎯 WORKFLOW-RUNNER: Starting in-call workflow')

        // Set phase to in_call
        this.currentState.phase = 'in_call'

        // Find the first in-call step
        const inCallSteps = this.getInCallSteps()
        if (inCallSteps.length === 0) {
            console.warn('🎯 WORKFLOW-RUNNER: No in-call steps found')
            return
        }

        // Set the step index to 0 for in-call steps (since we're only working with in-call steps)
        this.stepIndex = 0
        const firstInCallStep = inCallSteps[0]

        console.log(
            '🎯 WORKFLOW-RUNNER: Starting with in-call step:',
            firstInCallStep.title,
            'at in-call index:',
            this.stepIndex
        )

        // Update state to emit the phase change
        this.updateState()

        // Execute the first in-call step
        await this.executeNextStep()
    }

    private updateState(): void {
        console.log(
            '🎯 WORKFLOW-RUNNER: updateState called, current step:',
            this.currentState.currentStep?.title,
            'Type:',
            this.currentState.currentStep?.type,
            'Step index:',
            this.stepIndex
        )
        this.stateSubject.next({ ...this.currentState })
    }

    getWorkflowConfig(): WorkflowConfig | null {
        return this.workflowConfig
    }

    reset(): void {
        this.workflowConfig = null
        this.isWorkflowLoaded = false
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
