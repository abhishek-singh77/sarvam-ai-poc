import { Injectable } from '@angular/core'
import { BehaviorSubject, Subscription } from 'rxjs'
import { WorkflowRunnerService, WorkflowState } from './workflow-runner.service'

@Injectable({ providedIn: 'root' })
export class VkycWorkflowFacadeService {
    state$ = new BehaviorSubject<WorkflowState | null>(null)
    private subs = new Subscription()

    constructor(private runner: WorkflowRunnerService) {}

    async init(): Promise<void> {
        console.log('🎯 WORKFLOW-FACADE: Initializing workflow')
        await this.runner.loadWorkflow()
        this.subs.add(
            this.runner.state$.subscribe((s) => {
                this.state$.next(s)
            })
        )
        await this.runner.startWorkflow()
    }

    completeCurrentStep(): void {
        console.log('🎯 WORKFLOW-FACADE: Completing current step')
        const currentState = this.state$.value
        if (currentState?.currentStep) {
            this.runner.completeCurrentStep()
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
    }
}
