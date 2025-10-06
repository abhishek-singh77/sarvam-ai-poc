import { Injectable } from '@angular/core'
import { WorkflowStep } from '../workflow-runner.service'
import { StepHandler } from './step-handler.interface'
import { FrameCaptureHandler } from './frame-capture.handler'
import { QuestionnaireHandler } from './questionnaire.handler'
import { PreCallHandler } from './pre-call.handler'

@Injectable({
    providedIn: 'root',
})
export class StepHandlerRegistry {
    private handlers: StepHandler[] = []

    constructor(
        private frameCaptureHandler: FrameCaptureHandler,
        private questionnaireHandler: QuestionnaireHandler,
        private preCallHandler: PreCallHandler
    ) {
        this.registerHandlers()
    }

    private registerHandlers(): void {
        this.handlers = [
            this.frameCaptureHandler,
            this.questionnaireHandler,
            this.preCallHandler,
        ]
    }

    /**
     * Get the appropriate handler for a step
     */
    getHandler(step: WorkflowStep): StepHandler | null {
        return this.handlers.find((handler) => handler.canHandle(step)) || null
    }

    /**
     * Get all registered handlers
     */
    getAllHandlers(): StepHandler[] {
        return [...this.handlers]
    }

    /**
     * Register a new handler
     */
    registerHandler(handler: StepHandler): void {
        this.handlers.push(handler)
    }

    /**
     * Unregister a handler
     */
    unregisterHandler(handler: StepHandler): void {
        const index = this.handlers.indexOf(handler)
        if (index > -1) {
            this.handlers.splice(index, 1)
        }
    }
}
