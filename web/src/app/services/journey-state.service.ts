/**
 * Journey State Service - Manages journey state integration with workflow
 */

import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, Observable, Subject, combineLatest } from 'rxjs'
import { map, takeUntil, filter } from 'rxjs/operators'
import { VkycJourneyService } from './vkyc-journey.service'
import { VkycWorkflowFacadeService } from './vkyc-workflow-facade.service'
import { JourneyStep, JourneyData } from '../models/journey.models'

export interface JourneyWorkflowState {
    currentStep: JourneyStep | null
    nextStep: JourneyStep | null
    isWorkflowActive: boolean
    canProceed: boolean
    progress: {
        current: number
        total: number
        percentage: number
    }
}

@Injectable({
    providedIn: 'root',
})
export class JourneyStateService implements OnDestroy {
    private stateSubject = new BehaviorSubject<JourneyWorkflowState | null>(
        null
    )
    private destroy$ = new Subject<void>()

    public readonly state$ = this.stateSubject.asObservable()

    constructor(
        private journeyService: VkycJourneyService,
        private workflowFacade: VkycWorkflowFacadeService
    ) {
        this.initializeStateSync()
    }

    ngOnDestroy(): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    /**
     * Initialize state synchronization between journey and workflow
     */
    private initializeStateSync(): void {
        combineLatest([
            this.journeyService.journeyData$,
            this.workflowFacade.state$,
        ])
            .pipe(
                takeUntil(this.destroy$),
                filter(([journeyData, workflowState]) => !!journeyData)
            )
            .subscribe(([journeyData, workflowState]) => {
                this.updateState(journeyData!, workflowState)
            })
    }

    /**
     * Update the combined state
     */
    private updateState(journeyData: JourneyData, workflowState: any): void {
        const currentStep = this.journeyService.getCurrentStep()
        const nextStep = this.journeyService.getNextStep()
        const progress = this.journeyService.getProgress()

        const state: JourneyWorkflowState = {
            currentStep,
            nextStep,
            isWorkflowActive: !!workflowState?.currentStep,
            canProceed: this.canProceedToNextStep(currentStep, nextStep),
            progress: {
                current: progress.completedSteps,
                total: progress.totalSteps,
                percentage: progress.percentage,
            },
        }

        this.stateSubject.next(state)
    }

    /**
     * Check if we can proceed to the next step
     */
    private canProceedToNextStep(
        currentStep: JourneyStep | null,
        nextStep: JourneyStep | null
    ): boolean {
        if (!currentStep || !nextStep) return false

        // Check if current step is completed
        if (currentStep.status !== 'completed') return false

        // Check dependencies
        if (nextStep.dependencies) {
            return nextStep.dependencies.every((depId: string) =>
                this.journeyService.isStepCompleted(depId)
            )
        }

        return true
    }

    /**
     * Get current journey workflow state
     */
    getCurrentState(): JourneyWorkflowState | null {
        return this.stateSubject.value
    }

    /**
     * Check if a specific step type is active
     */
    isStepTypeActive(stepType: 'pre_call' | 'in_call' | 'post_call'): boolean {
        const state = this.getCurrentState()
        return state?.currentStep?.type === stepType
    }

    /**
     * Get steps by type with status
     */
    getStepsByTypeWithStatus(stepType: 'pre_call' | 'in_call' | 'post_call'): {
        steps: JourneyStep[]
        completed: number
        total: number
        percentage: number
    } {
        const steps = this.journeyService.getStepsByType(stepType)
        const completed = steps.filter((s) => s.status === 'completed').length
        const total = steps.length
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

        return { steps, completed, total, percentage }
    }

    /**
     * Get workflow phase based on current step
     */
    getCurrentPhase(): 'pre_call' | 'in_call' | 'post_call' | null {
        const state = this.getCurrentState()
        return state?.currentStep?.type || null
    }

    /**
     * Check if all steps of a type are completed
     */
    areAllStepsCompleted(
        stepType: 'pre_call' | 'in_call' | 'post_call'
    ): boolean {
        const steps = this.journeyService.getStepsByType(stepType)
        return (
            steps.length > 0 &&
            steps.every((step) => step.status === 'completed')
        )
    }

    /**
     * Get next step of a specific type
     */
    getNextStepOfType(
        stepType: 'pre_call' | 'in_call' | 'post_call'
    ): JourneyStep | null {
        const steps = this.journeyService.getStepsByType(stepType)
        return steps.find((step) => step.status === 'pending') || null
    }

    /**
     * Check if workflow can start (all pre-call steps completed)
     */
    canStartWorkflow(): boolean {
        return this.areAllStepsCompleted('pre_call')
    }

    /**
     * Check if workflow is completed (all steps completed)
     */
    isWorkflowCompleted(): boolean {
        return (
            this.areAllStepsCompleted('pre_call') &&
            this.areAllStepsCompleted('in_call') &&
            this.areAllStepsCompleted('post_call')
        )
    }

    /**
     * Get workflow completion percentage
     */
    getWorkflowCompletionPercentage(): number {
        const preCallPct =
            this.journeyService.getCompletionPercentageByType('pre_call')
        const inCallPct =
            this.journeyService.getCompletionPercentageByType('in_call')
        const postCallPct =
            this.journeyService.getCompletionPercentageByType('post_call')

        return Math.round((preCallPct + inCallPct + postCallPct) / 3)
    }
}
