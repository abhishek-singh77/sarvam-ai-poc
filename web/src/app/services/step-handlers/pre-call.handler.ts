import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'

@Injectable({
    providedIn: 'root',
})
export class PreCallHandler implements StepHandler {
    canHandle(step: WorkflowStep): boolean {
        // Only handle pre-call steps (currently no pre-call steps in workflow)
        return step.phase === 'pre' && step.type === 'AGENT_INSTRUCTION'
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log(
            '🎯 PRE-CALL-HANDLER: Starting pre-call step:',
            step.type,
            step.id
        )

        switch (step.type) {
            case 'AGENT_INSTRUCTION':
                return this.handleInstruction(step)
            default:
                return of({
                    success: false,
                    error: 'Unknown pre-call step type',
                })
        }
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log(
            '🎯 PRE-CALL-HANDLER: Completing pre-call step:',
            step.type,
            step.id
        )
        return of({
            success: true,
            data: data,
            shouldProceed: true,
        })
    }

    retry(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log(
            '🎯 PRE-CALL-HANDLER: Retrying pre-call step:',
            step.type,
            step.id
        )
        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log(
            '🎯 PRE-CALL-HANDLER: Cancelling pre-call step:',
            step.type,
            step.id
        )
    }

    getUIState(step: WorkflowStep): any {
        return {
            stepType: step.type,
            title: step.title,
            description: step.description,
            isPreCall: true,
        }
    }

    private handleInstruction(
        step: WorkflowStep
    ): Observable<StepHandlerResult> {
        return new Observable((observer) => {
            console.log(
                '🎯 PRE-CALL-HANDLER: Handling instruction:',
                step.title
            )

            // Show instruction for a few seconds, then auto-proceed
            setTimeout(() => {
                observer.next({
                    success: true,
                    data: {
                        instructionShown: true,
                        timestamp: Date.now(),
                        title: step.title,
                        description: step.description,
                    },
                    shouldProceed: true,
                })
                observer.complete()
            }, 3000) // Show for 3 seconds
        })
    }
}
