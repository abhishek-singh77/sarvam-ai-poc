import { Injectable } from '@angular/core'
import { BehaviorSubject, Subscription } from 'rxjs'
import { WorkflowRunnerService, WorkflowState } from './workflow-runner.service'

@Injectable({ providedIn: 'root' })
export class VkycWorkflowFacadeService {
    state$ = new BehaviorSubject<WorkflowState | null>(null)
    private subs = new Subscription()
    private isInitialized = false

    constructor(private runner: WorkflowRunnerService) {}

    async init(): Promise<void> {
        if (this.isInitialized) {
            console.log('🎯 WORKFLOW-FACADE: Already initialized, skipping')
            return
        }

        console.log('🎯 WORKFLOW-FACADE: Initializing workflow')
        this.isInitialized = true

        await this.runner.loadWorkflow()
        this.subs.add(
            this.runner.state$.subscribe((s) => {
                this.state$.next(s)
            })
        )
        await this.runner.startWorkflow()
    }

    async completeCurrentStep(): Promise<void> {
        console.log('🎯 WORKFLOW-FACADE: Completing current step')
        const currentState = this.state$.value
        if (currentState?.currentStep) {
            await this.runner.completeCurrentStep()
        }
    }

    retryCurrentStep(): void {
        console.log('🎯 WORKFLOW-FACADE: Retrying current step')
        this.runner.retryCurrentStep()
    }

    retryStep(stepId: string): void {
        console.log('🎯 WORKFLOW-FACADE: Retrying step:', stepId)
        this.runner.retryStep(stepId)
    }

    cleanup(): void {
        console.log('🎯 WORKFLOW-FACADE: Cleaning up')
        this.subs.unsubscribe()
        this.isInitialized = false
    }

    reset(): void {
        console.log('🎯 WORKFLOW-FACADE: Resetting workflow')
        this.cleanup()
        this.state$.next(null)
    }
}
