import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'

@Injectable({
    providedIn: 'root',
})
export class UserInstructionHandler implements StepHandler {
    canHandle(step: WorkflowStep): boolean {
        return step.type === 'USER_INSTRUCTION'
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log(
            '🎯 USER-INSTRUCTION-HANDLER: Starting user instruction:',
            step.id
        )

        // User instruction steps are informational and don't require user interaction
        // They just display instructions and then proceed automatically
        return of({
            success: true,
            data: {
                title: step.data?.title || step.title || 'Instructions',
                description:
                    step.data?.description ||
                    step.description ||
                    'Please follow the instructions',
                instructionType: 'user_instruction',
                startedAt: new Date().toISOString(),
            },
            shouldProceed: true,
        })
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log(
            '🎯 USER-INSTRUCTION-HANDLER: Completing user instruction:',
            step.id
        )

        // User instruction steps are completed automatically after a short delay
        return of({
            success: true,
            data: {
                ...data,
                completed: true,
                completedAt: new Date().toISOString(),
            },
            shouldProceed: true,
        })
    }

    retry(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log(
            '🎯 USER-INSTRUCTION-HANDLER: Retrying user instruction:',
            step.id
        )
        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log(
            '🎯 USER-INSTRUCTION-HANDLER: Cancelling user instruction:',
            step.id
        )
        // User instruction doesn't need cleanup
    }

    getUIState(step: WorkflowStep): any {
        return {
            type: 'user_instruction',
            message: 'Please read the instructions carefully',
            isCompleted: false,
        }
    }
}
