import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'

@Injectable({
    providedIn: 'root',
})
export class GeoTaggingHandler implements StepHandler {
    canHandle(step: WorkflowStep): boolean {
        return step.type === 'GEO_TAGGING'
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log('🎯 GEO-TAGGING-HANDLER: Starting geo tagging:', step.id)

        // For geo tagging, we typically get location from browser
        // This is usually handled automatically by the browser
        return of({
            success: true,
            data: {
                location: {
                    latitude: null, // Will be populated by browser
                    longitude: null, // Will be populated by browser
                    accuracy: null,
                    timestamp: new Date().toISOString(),
                },
            },
            shouldProceed: true,
        })
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log('🎯 GEO-TAGGING-HANDLER: Completing geo tagging:', step.id)

        // Geo tagging is typically completed automatically
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
        console.log('🎯 GEO-TAGGING-HANDLER: Retrying geo tagging:', step.id)
        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log('🎯 GEO-TAGGING-HANDLER: Cancelling geo tagging:', step.id)
        // Geo tagging doesn't need cleanup
    }

    getUIState(step: WorkflowStep): any {
        return {
            type: 'geo_tagging',
            message: 'Location verification in progress...',
            isCompleted: false,
        }
    }
}
