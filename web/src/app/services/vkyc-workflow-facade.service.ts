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

    async startInCallWorkflow(): Promise<void> {
        console.log('🎯 WORKFLOW-FACADE: Starting in-call workflow')
        await this.runner.startInCallWorkflow()
    }

    async completeCurrentStep(): Promise<void> {
        console.log(
            '🎯🎯🎯 WORKFLOW-FACADE: ========== completeCurrentStep CALLED =========='
        )
        const currentState = this.state$.value
        console.log(
            '🎯 WORKFLOW-FACADE: Current state from facade:',
            currentState
        )

        // Always try to get the current step from the runner directly (most reliable source)
        const runnerCurrentStep = this.runner.getCurrentStep()
        console.log(
            '🎯 WORKFLOW-FACADE: Current step from runner:',
            runnerCurrentStep
        )

        if (runnerCurrentStep) {
            console.log(
                '🎯 WORKFLOW-FACADE: Completing current step:',
                runnerCurrentStep.title,
                runnerCurrentStep.type
            )
            await this.runner.completeCurrentStep()
            console.log('🎯 WORKFLOW-FACADE: Step completion successful')
        } else {
            console.error(
                '🎯 WORKFLOW-FACADE: ❌ No current step found in runner! Cannot complete step.'
            )
            console.log(
                '🎯 WORKFLOW-FACADE: Runner state:',
                this.runner['currentState']
            )
        }
        console.log(
            '🎯🎯🎯 WORKFLOW-FACADE: ========== completeCurrentStep FINISHED =========='
        )
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
        this.runner.reset()
        this.state$.next(null)
    }
}
