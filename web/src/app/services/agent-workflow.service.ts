import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

export interface AgentPrompt {
    type: 'welcome' | 'step_instruction' | 'step_completion' | 'question'
    message: string
    stepType?: string
    stepTitle?: string
    captureType?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE' | 'QUESTIONNAIRE'
    question?: string
    questionId?: string
    showProceedButton?: boolean
    proceedButtonText?: string
}

export interface AgentWorkflowState {
    currentStep: any
    completedSteps: any[]
    currentPrompt: AgentPrompt | null
    isWaitingForResponse: boolean
    currentQuestion: any | null
    customerResponses: { [questionId: string]: string }
    allWorkflowSteps: any[]
    currentStepNumber: number
    totalSteps: number
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
        allWorkflowSteps: [],
        currentStepNumber: 0,
        totalSteps: 0,
    })

    public workflowState$ = this.workflowStateSubject.asObservable()

    constructor() {}

    /**
     * Initialize agent workflow when agent enters the meeting
     */
    initializeAgentWorkflow(workflowSteps: any[]): void {
        console.log(
            '🎯 AGENT-WORKFLOW: Initializing agent workflow with',
            workflowSteps.length,
            'steps'
        )

        // Log the steps in order to debug
        console.log(
            '🎯 AGENT-WORKFLOW: Steps in order:',
            workflowSteps.map((step, index) => ({
                index,
                id: step.id,
                title: step.title,
                type: step.type,
                phase: step.phase || step.sub_action_step,
                order: step.order,
            }))
        )

        // Store all workflow steps
        const currentState = this.workflowStateSubject.value
        this.workflowStateSubject.next({
            ...currentState,
            allWorkflowSteps: workflowSteps,
            totalSteps: workflowSteps.length,
        })

        // Find the first in-call step - use the properly sorted steps
        const firstInCallStep = workflowSteps.find(
            (step) => step.phase === 'in_call'
        )

        if (firstInCallStep) {
            const stepNumber = workflowSteps.indexOf(firstInCallStep) + 1
            console.log('🎯 AGENT-WORKFLOW: First in-call step found:', {
                id: firstInCallStep.id,
                title: firstInCallStep.title,
                type: firstInCallStep.type,
                stepNumber,
            })
            this.updateCurrentStep(firstInCallStep, stepNumber)
            this.generateWelcomePrompt(workflowSteps)
        } else {
            console.warn(
                '🎯 AGENT-WORKFLOW: No in-call step found in workflow steps'
            )
        }
    }

    /**
     * Update the current step
     */
    updateCurrentStep(step: any, stepNumber?: number): void {
        const currentState = this.workflowStateSubject.value
        const calculatedStepNumber =
            stepNumber || this.calculateStepNumber(step)

        this.workflowStateSubject.next({
            ...currentState,
            currentStep: step,
            currentStepNumber: calculatedStepNumber,
        })
        console.log(
            '🎯 AGENT-WORKFLOW: Updated current step:',
            step,
            'Step number:',
            calculatedStepNumber
        )
    }

    /**
     * Calculate step number from all workflow steps
     */
    private calculateStepNumber(step: any): number {
        const currentState = this.workflowStateSubject.value
        const index = currentState.allWorkflowSteps.findIndex(
            (s) => s.id === step.id
        )
        return index >= 0 ? index + 1 : 0
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

        // Add completed step to completed steps list
        const currentState = this.workflowStateSubject.value
        const updatedCompletedSteps = [
            ...currentState.completedSteps,
            completedStep,
        ]

        this.workflowStateSubject.next({
            ...currentState,
            completedSteps: updatedCompletedSteps,
        })

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
    private generateWelcomePrompt(workflowSteps: any[]): void {
        const inCallSteps = workflowSteps.filter(
            (step) => step.subActionStep === 'in_call'
        )
        const stepDescriptions = inCallSteps
            .map((step, index) => {
                const stepNumber = index + 1
                let description = `${stepNumber}. ${step.title || step.type}`
                if (step.type === 'FRAME_CAPTURE') {
                    const captureType =
                        step.frame_capture_type || step.data?.frame_capture_type
                    if (captureType === 'FACE_CAPTURE') {
                        description +=
                            ' - We will capture your selfie for identity verification'
                    } else if (captureType === 'DOCUMENT_CAPTURE') {
                        description += ` - We will capture your ${
                            step.strict_validation_type || 'document'
                        } for verification`
                    }
                } else if (step.type === 'QUESTIONNAIRE') {
                    description +=
                        ' - I will ask you some questions to verify your information'
                }
                return description
            })
            .join('\n')

        const prompt: AgentPrompt = {
            type: 'welcome',
            message: `Welcome! I am your AI assistant for the KYC verification process. I will guide you through ${inCallSteps.length} steps to complete your verification:

${stepDescriptions}

Please follow my instructions carefully, and I'll help you complete each step successfully. Let's begin with the first step!`,
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
                const captureType =
                    step.frame_capture_type ||
                    step.data?.frame_capture_type ||
                    step.data?.captureType
                console.log(
                    '🎯 AGENT-WORKFLOW: Frame capture type:',
                    captureType,
                    'for step:',
                    step
                )

                if (captureType === 'FACE_CAPTURE') {
                    const stepNumber = currentState.currentStepNumber
                    const totalSteps = currentState.totalSteps
                    prompt = {
                        type: 'step_instruction',
                        message: `Step ${stepNumber} of ${totalSteps}: Now I need to capture your selfie for identity verification. Please look directly at the camera, ensure good lighting, and keep your face centered. You can use the camera button below to capture when you're ready.`,
                        stepType: 'FRAME_CAPTURE',
                        stepTitle: step.title || 'Selfie Capture',
                        captureType: 'FACE_CAPTURE',
                        showProceedButton: true,
                        proceedButtonText: 'Capture Photo',
                    }
                } else if (captureType === 'DOCUMENT_CAPTURE') {
                    const stepNumber = currentState.currentStepNumber
                    const totalSteps = currentState.totalSteps
                    prompt = {
                        type: 'step_instruction',
                        message: `Step ${stepNumber} of ${totalSteps}: Now I need to capture your ${
                            step.strict_validation_type || 'document'
                        } for verification. Please hold the document steady in front of the camera, ensure all text is clearly visible and well-lit. You can use the camera button below to capture when ready.`,
                        stepType: 'FRAME_CAPTURE',
                        stepTitle: step.title || 'Document Capture',
                        captureType: 'DOCUMENT_CAPTURE',
                        showProceedButton: true,
                        proceedButtonText: 'Capture Document',
                    }
                } else {
                    prompt = {
                        type: 'step_instruction',
                        message: `Let's proceed with ${
                            step.title || 'the next step'
                        }. Please follow the instructions carefully and use the proceed button when ready.`,
                        stepType: step.type,
                        stepTitle: step.title,
                        showProceedButton: true,
                        proceedButtonText: 'Proceed',
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
        const currentState = this.workflowStateSubject.value
        const completedStepNumber = this.calculateStepNumber(completedStep)
        const nextStepNumber = this.calculateStepNumber(nextStep)
        const totalSteps = currentState.totalSteps

        let message = ''

        if (completedStep.type === 'FRAME_CAPTURE') {
            if (completedStep.frame_capture_type === 'FACE_CAPTURE') {
                message = `✅ Excellent! Step ${completedStepNumber} completed - Your selfie has been captured successfully. `
            } else if (
                completedStep.frame_capture_type === 'DOCUMENT_CAPTURE'
            ) {
                message = `✅ Perfect! Step ${completedStepNumber} completed - Your document has been captured successfully. `
            }
        } else if (completedStep.type === 'QUESTIONNAIRE') {
            message = `✅ Great! Step ${completedStepNumber} completed - Thank you for answering the questions. `
        } else {
            message = `✅ Step ${completedStepNumber} completed successfully. `
        }

        message += `Now let's move to Step ${nextStepNumber} of ${totalSteps}: ${
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
            allWorkflowSteps: [],
            currentStepNumber: 0,
            totalSteps: 0,
        })
    }
}
