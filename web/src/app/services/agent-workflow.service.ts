import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

export interface AgentPrompt {
    type: 'welcome' | 'step_instruction' | 'step_completion' | 'question'
    message: string
    stepType?: string
    stepTitle?: string
    captureType?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE'
    question?: string
    questionId?: string
}

export interface AgentWorkflowState {
    currentStep: any
    completedSteps: any[]
    currentPrompt: AgentPrompt | null
    isWaitingForResponse: boolean
    currentQuestion: any | null
    customerResponses: { [questionId: string]: string }
}

@Injectable({
    providedIn: 'root',
})
export class AgentWorkflowService {
    private workflowStateSubject = new BehaviorSubject<AgentWorkflowState>({
        currentStep: null,
        completedSteps: [],
        currentPrompt: null,
        isWaitingForResponse: false,
        currentQuestion: null,
        customerResponses: {},
    })

    public workflowState$ = this.workflowStateSubject.asObservable()

    constructor() {}

    /**
     * Initialize agent workflow when agent enters the meeting
     */
    initializeAgentWorkflow(workflowSteps: any[]): void {
        console.log('🎯 AGENT-WORKFLOW: Initializing agent workflow')

        // Find the first in-call step
        const firstInCallStep = workflowSteps.find(
            (step) => step.subActionStep === 'in_call'
        )

        if (firstInCallStep) {
            this.updateCurrentStep(firstInCallStep)
            this.generateWelcomePrompt()
        }
    }

    /**
     * Update the current step
     */
    updateCurrentStep(step: any): void {
        const currentState = this.workflowStateSubject.value
        this.workflowStateSubject.next({
            ...currentState,
            currentStep: step,
        })
        console.log('🎯 AGENT-WORKFLOW: Updated current step:', step)
    }

    /**
     * Mark a step as completed and move to next step
     */
    completeStep(step: any, nextStep?: any): void {
        const currentState = this.workflowStateSubject.value
        const completedSteps = [...currentState.completedSteps, step]

        this.workflowStateSubject.next({
            ...currentState,
            completedSteps,
            currentStep: nextStep || null,
        })

        if (nextStep) {
            this.generateStepCompletionPrompt(step, nextStep)
        } else {
            this.generateWorkflowCompletionPrompt()
        }
    }

    /**
     * Handle step completion from workflow runner
     */
    handleStepCompletion(completedStep: any, nextStep?: any): void {
        console.log(
            '🎯 AGENT-WORKFLOW: Handling step completion:',
            completedStep.id
        )

        // Generate completion prompt
        if (nextStep) {
            this.generateStepCompletionPrompt(completedStep, nextStep)
        } else {
            this.generateWorkflowCompletionPrompt()
        }
    }

    /**
     * Generate welcome prompt when agent enters
     */
    private generateWelcomePrompt(): void {
        const prompt: AgentPrompt = {
            type: 'welcome',
            message:
                "Hello! Welcome to the KYC verification process. I'm here to guide you through the steps. Let's get started with your verification.",
        }
        this.updateCurrentPrompt(prompt)
    }

    /**
     * Generate step instruction prompt based on current step
     */
    generateStepInstructionPrompt(): void {
        const currentState = this.workflowStateSubject.value
        const step = currentState.currentStep

        if (!step) return

        let prompt: AgentPrompt

        switch (step.type) {
            case 'FRAME_CAPTURE':
                if (step.frame_capture_type === 'FACE_CAPTURE') {
                    prompt = {
                        type: 'step_instruction',
                        message:
                            "Now I need to capture your selfie. Please look directly at the camera and make sure your face is clearly visible. I'll capture your photo automatically when you're ready.",
                        stepType: 'FRAME_CAPTURE',
                        stepTitle: step.title || 'Selfie Capture',
                        captureType: 'FACE_CAPTURE',
                    }
                } else if (step.frame_capture_type === 'DOCUMENT_CAPTURE') {
                    prompt = {
                        type: 'step_instruction',
                        message: `Now I need to capture your ${
                            step.strict_validation_type || 'document'
                        }. Please hold your document steady in front of the camera. Make sure all text is clearly visible and the document is well-lit.`,
                        stepType: 'FRAME_CAPTURE',
                        stepTitle: step.title || 'Document Capture',
                        captureType: 'DOCUMENT_CAPTURE',
                    }
                } else {
                    prompt = {
                        type: 'step_instruction',
                        message: `Let's proceed with ${
                            step.title || 'the next step'
                        }. Please follow the instructions carefully.`,
                        stepType: step.type,
                        stepTitle: step.title,
                    }
                }
                break

            case 'QUESTIONNAIRE':
                prompt = {
                    type: 'step_instruction',
                    message:
                        "Now I'll ask you some questions. Please answer them clearly and accurately. I'll display each question on screen and wait for your response.",
                    stepType: 'QUESTIONNAIRE',
                    stepTitle: step.title || 'Questionnaire',
                }
                break

            default:
                prompt = {
                    type: 'step_instruction',
                    message: `Let's proceed with ${
                        step.title || 'the next step'
                    }. Please follow the instructions carefully.`,
                    stepType: step.type,
                    stepTitle: step.title,
                }
        }

        this.updateCurrentPrompt(prompt)
    }

    /**
     * Generate step completion prompt
     */
    private generateStepCompletionPrompt(
        completedStep: any,
        nextStep: any
    ): void {
        let message = ''

        if (completedStep.type === 'FRAME_CAPTURE') {
            if (completedStep.frame_capture_type === 'FACE_CAPTURE') {
                message = 'Great! Your selfie has been captured successfully. '
            } else if (
                completedStep.frame_capture_type === 'DOCUMENT_CAPTURE'
            ) {
                message =
                    'Perfect! Your document has been captured successfully. '
            }
        } else if (completedStep.type === 'QUESTIONNAIRE') {
            message = 'Thank you for answering the questions. '
        }

        message += `Now let's move to the next step: ${
            nextStep.title || 'Next Step'
        }.`

        const prompt: AgentPrompt = {
            type: 'step_completion',
            message,
            stepType: nextStep.type,
            stepTitle: nextStep.title,
        }

        this.updateCurrentPrompt(prompt)

        // Generate instruction for next step after a short delay
        setTimeout(() => {
            this.generateStepInstructionPrompt()
        }, 2000)
    }

    /**
     * Generate workflow completion prompt
     */
    private generateWorkflowCompletionPrompt(): void {
        const prompt: AgentPrompt = {
            type: 'step_completion',
            message:
                "Excellent! You've completed all the verification steps. Your KYC process is now complete. Thank you for your cooperation!",
        }
        this.updateCurrentPrompt(prompt)
    }

    /**
     * Start questionnaire with first question
     */
    startQuestionnaire(questions: any[]): void {
        if (questions.length > 0) {
            this.askQuestion(questions[0], 0, questions)
        }
    }

    /**
     * Ask a specific question
     */
    askQuestion(
        question: any,
        questionIndex: number,
        allQuestions: any[]
    ): void {
        const prompt: AgentPrompt = {
            type: 'question',
            message: question.title,
            question: question.title,
            questionId: `question_${questionIndex}`,
        }

        const currentState = this.workflowStateSubject.value
        this.workflowStateSubject.next({
            ...currentState,
            currentPrompt: prompt,
            currentQuestion: question,
            isWaitingForResponse: true,
        })
    }

    /**
     * Handle customer response to a question
     */
    handleCustomerResponse(questionId: string, response: string): void {
        const currentState = this.workflowStateSubject.value
        const customerResponses = {
            ...currentState.customerResponses,
            [questionId]: response,
        }

        this.workflowStateSubject.next({
            ...currentState,
            customerResponses,
            isWaitingForResponse: false,
        })

        console.log('🎯 AGENT-WORKFLOW: Customer response received:', {
            questionId,
            response,
        })
    }

    /**
     * Update current prompt
     */
    private updateCurrentPrompt(prompt: AgentPrompt): void {
        const currentState = this.workflowStateSubject.value
        this.workflowStateSubject.next({
            ...currentState,
            currentPrompt: prompt,
        })
        console.log('🎯 AGENT-WORKFLOW: Updated prompt:', prompt)
    }

    /**
     * Get current workflow state
     */
    getCurrentState(): AgentWorkflowState {
        return this.workflowStateSubject.value
    }

    /**
     * Reset workflow state
     */
    reset(): void {
        this.workflowStateSubject.next({
            currentStep: null,
            completedSteps: [],
            currentPrompt: null,
            isWaitingForResponse: false,
            currentQuestion: null,
            customerResponses: {},
        })
    }
}
