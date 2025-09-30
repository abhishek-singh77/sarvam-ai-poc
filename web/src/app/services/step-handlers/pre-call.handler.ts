import { Injectable } from '@angular/core'
import { Observable, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'

@Injectable({
    providedIn: 'root'
})
export class PreCallHandler implements StepHandler {
    
    canHandle(step: WorkflowStep): boolean {
        return ['GEO_TAGGING', 'USER_INSTRUCTION', 'AGENT_INSTRUCTION'].includes(step.type)
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log('🎯 PRE-CALL-HANDLER: Starting pre-call step:', step.type, step.id)
        
        switch (step.type) {
            case 'GEO_TAGGING':
                return this.handleGeoTagging(step)
            case 'USER_INSTRUCTION':
            case 'AGENT_INSTRUCTION':
                return this.handleInstruction(step)
            default:
                return of({
                    success: false,
                    error: 'Unknown pre-call step type'
                })
        }
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log('🎯 PRE-CALL-HANDLER: Completing pre-call step:', step.type, step.id)
        return of({
            success: true,
            data: data,
            shouldProceed: true
        })
    }

    retry(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log('🎯 PRE-CALL-HANDLER: Retrying pre-call step:', step.type, step.id)
        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log('🎯 PRE-CALL-HANDLER: Cancelling pre-call step:', step.type, step.id)
    }

    getUIState(step: WorkflowStep): any {
        return {
            stepType: step.type,
            title: step.title,
            description: step.description,
            isPreCall: true
        }
    }

    private handleGeoTagging(step: WorkflowStep): Observable<StepHandlerResult> {
        return new Observable(observer => {
            console.log('🎯 PRE-CALL-HANDLER: Handling geo tagging...')
            
            if (!navigator.geolocation) {
                observer.next({
                    success: false,
                    error: 'Geolocation not supported'
                })
                observer.complete()
                return
            }

            const options = {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const geoData = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        timestamp: position.timestamp
                    }

                    console.log('🎯 PRE-CALL-HANDLER: Geolocation obtained:', geoData)
                    
                    // Check distance if required
                    if (step.subAction?.check_distance_from_input_address) {
                        // This would typically call a backend service to check distance
                        // For now, we'll simulate success
                        observer.next({
                            success: true,
                            data: {
                                geoData: geoData,
                                distanceCheck: {
                                    passed: true,
                                    distance: 0.5, // km
                                    address: step.subAction?.input_address
                                }
                            },
                            shouldProceed: true
                        })
                    } else {
                        observer.next({
                            success: true,
                            data: { geoData: geoData },
                            shouldProceed: true
                        })
                    }
                    observer.complete()
                },
                (error) => {
                    console.error('🎯 PRE-CALL-HANDLER: Geolocation error:', error)
                    observer.next({
                        success: false,
                        error: `Geolocation failed: ${error.message}`
                    })
                    observer.complete()
                },
                options
            )
        })
    }

    private handleInstruction(step: WorkflowStep): Observable<StepHandlerResult> {
        return new Observable(observer => {
            console.log('🎯 PRE-CALL-HANDLER: Handling instruction:', step.title)
            
            // Show instruction for a few seconds, then auto-proceed
            setTimeout(() => {
                observer.next({
                    success: true,
                    data: {
                        instructionShown: true,
                        timestamp: Date.now(),
                        title: step.title,
                        description: step.description
                    },
                    shouldProceed: true
                })
                observer.complete()
            }, 3000) // Show for 3 seconds
        })
    }
}
