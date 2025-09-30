import { Observable } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'

export interface StepHandlerResult {
    success: boolean
    data?: any
    error?: string
    shouldProceed?: boolean
}

export interface StepHandler {
    /**
     * Check if this handler can handle the given step type
     */
    canHandle(step: WorkflowStep): boolean

    /**
     * Start the step execution
     */
    start(step: WorkflowStep): Observable<StepHandlerResult>

    /**
     * Handle step completion
     */
    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult>

    /**
     * Handle step retry
     */
    retry(step: WorkflowStep): Observable<StepHandlerResult>

    /**
     * Cancel the step execution
     */
    cancel(step: WorkflowStep): void

    /**
     * Get step-specific UI state
     */
    getUIState(step: WorkflowStep): any
}
