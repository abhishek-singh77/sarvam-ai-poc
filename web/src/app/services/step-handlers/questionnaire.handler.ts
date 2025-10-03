import { Injectable } from '@angular/core'
import { Observable, BehaviorSubject, of } from 'rxjs'
import { WorkflowStep } from '../../services/workflow-runner.service'
import { StepHandler, StepHandlerResult } from './step-handler.interface'
import { SubmissionService, QuestionnairePayload } from '../submission.service'
import { AgentWorkflowService } from '../agent-workflow.service'

@Injectable({
    providedIn: 'root',
})
export class QuestionnaireHandler implements StepHandler {
    private currentStep: WorkflowStep | null = null
    private currentQuestionIndex = 0
    private answers: { [questionId: string]: string } = {}
    private isListening = false

    constructor(
        private submissionService: SubmissionService,
        private agentWorkflowService: AgentWorkflowService
    ) {}

    canHandle(step: WorkflowStep): boolean {
        return step.type === 'QUESTIONNAIRE'
    }

    start(step: WorkflowStep): Observable<StepHandlerResult> {
        this.currentStep = step
        this.currentQuestionIndex = 0
        this.answers = {}

        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Starting questionnaire:',
            step.id
        )

        // Initialize with first question
        const questions =
            step.data?.questions || step.data?.questionnaire?.questions || []
        if (questions.length === 0) {
            console.error(
                '🎯 QUESTIONNAIRE-HANDLER: No questions found in step data:',
                {
                    stepId: step.id,
                    stepData: step.data,
                    hasQuestions: !!step.data?.questions,
                    hasQuestionnaire: !!step.data?.questionnaire,
                    hasQuestionnaireQuestions:
                        !!step.data?.questionnaire?.questions,
                }
            )
            return of({
                success: false,
                error: 'No questions found',
            })
        }

        // Trigger agent workflow service to show the first question
        this.agentWorkflowService.askQuestion(questions[0], 0, questions)
        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Triggered agent workflow to show first question'
        )

        return of({
            success: true,
            data: {
                currentQuestion: questions[0],
                questionIndex: 0,
                totalQuestions: questions.length,
                answers: this.answers,
            },
        })
    }

    complete(step: WorkflowStep, data: any): Observable<StepHandlerResult> {
        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Completing questionnaire:',
            step.id
        )

        return new Observable((observer) => {
            this.submitAnswers(step)
                .then((result) => {
                    observer.next(result)
                    observer.complete()
                })
                .catch((error) => {
                    observer.next({
                        success: false,
                        error: error.message,
                    })
                    observer.complete()
                })
        })
    }

    retry(step: WorkflowStep): Observable<StepHandlerResult> {
        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Retrying questionnaire:',
            step.id
        )

        // Clear previous answers and restart
        this.answers = {}
        this.currentQuestionIndex = 0

        return this.start(step)
    }

    cancel(step: WorkflowStep): void {
        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Cancelling questionnaire:',
            step.id
        )
        this.stopListening()
    }

    getUIState(step: WorkflowStep): any {
        const questions =
            step.data?.questions || step.data?.questionnaire?.questions || []
        const currentQuestion = questions[this.currentQuestionIndex]

        return {
            currentQuestion: currentQuestion,
            questionIndex: this.currentQuestionIndex,
            totalQuestions: questions.length,
            answers: this.answers,
            isListening: this.isListening,
            canProceed: this.areAllQuestionsAnswered(questions),
            progress: (this.currentQuestionIndex / questions.length) * 100,
        }
    }

    /**
     * Answer the current question
     */
    answerQuestion(questionId: string, answer: string): void {
        this.answers[questionId] = answer
        console.log(
            '🎯 QUESTIONNAIRE-HANDLER: Answered question:',
            questionId,
            answer
        )

        // Move to next question if this was the current question
        if (!this.currentStep) return

        const questions = this.currentStep.data?.questions || []
        const currentQuestion = questions[this.currentQuestionIndex]

        if (currentQuestion && questionId === currentQuestion.title) {
            this.currentQuestionIndex++

            // If there are more questions, show the next one
            if (this.currentQuestionIndex < questions.length) {
                const nextQuestion = questions[this.currentQuestionIndex]
                this.agentWorkflowService.askQuestion(
                    nextQuestion,
                    this.currentQuestionIndex,
                    questions
                )
                console.log(
                    '🎯 QUESTIONNAIRE-HANDLER: Showing next question:',
                    nextQuestion.title
                )
            } else {
                // All questions answered, complete the questionnaire
                console.log(
                    '🎯 QUESTIONNAIRE-HANDLER: All questions answered, completing questionnaire'
                )
                this.complete(this.currentStep, this.answers).subscribe()
            }
        }
    }

    /**
     * Move to next question
     */
    nextQuestion(): boolean {
        if (!this.currentStep) return false

        const questions = this.currentStep.data?.questions || []
        if (this.currentQuestionIndex < questions.length - 1) {
            this.currentQuestionIndex++
            return true
        }
        return false
    }

    /**
     * Move to previous question
     */
    previousQuestion(): boolean {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--
            return true
        }
        return false
    }

    /**
     * Start voice recognition for current question
     */
    startVoiceRecognition(): Observable<string> {
        return new Observable((observer) => {
            if (
                !('webkitSpeechRecognition' in window) &&
                !('SpeechRecognition' in window)
            ) {
                observer.error('Speech recognition not supported')
                return
            }

            const SpeechRecognition =
                (window as any).SpeechRecognition ||
                (window as any).webkitSpeechRecognition
            const recognition = new SpeechRecognition()

            recognition.continuous = false
            recognition.interimResults = false
            recognition.lang = 'en-US'

            recognition.onstart = () => {
                this.isListening = true
                console.log(
                    '🎯 QUESTIONNAIRE-HANDLER: Voice recognition started'
                )
            }

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript
                console.log(
                    '🎯 QUESTIONNAIRE-HANDLER: Voice recognition result:',
                    transcript
                )
                observer.next(transcript)
                observer.complete()
            }

            recognition.onerror = (event: any) => {
                console.error(
                    '🎯 QUESTIONNAIRE-HANDLER: Voice recognition error:',
                    event.error
                )
                observer.error(event.error)
            }

            recognition.onend = () => {
                this.isListening = false
                console.log('🎯 QUESTIONNAIRE-HANDLER: Voice recognition ended')
            }

            recognition.start()
        })
    }

    /**
     * Stop voice recognition
     */
    stopListening(): void {
        this.isListening = false
        // Note: Speech recognition will stop automatically when result is received
    }

    private async submitAnswers(
        step: WorkflowStep
    ): Promise<StepHandlerResult> {
        try {
            const payload: QuestionnairePayload = {
                stepRef: step.id,
                answers: this.answers,
                metadata: {
                    timestamp: Date.now(),
                    source: 'voice', // Could be 'text' or 'manual' based on input method
                },
            }

            const submissionResult = await this.submissionService.submitAnswers(
                payload
            )

            if (!submissionResult.success) {
                return {
                    success: false,
                    error: submissionResult.error,
                }
            }

            // Complete the step
            const completeResult = await this.submissionService.completeStep(
                this.getSessionId(),
                step.id,
                {
                    answers: this.answers,
                    submissionResult: submissionResult,
                }
            )

            return {
                success: true,
                data: {
                    answers: this.answers,
                    submissionResult: submissionResult,
                    completeResult: completeResult,
                },
                shouldProceed: true,
            }
        } catch (error) {
            console.error('🎯 QUESTIONNAIRE-HANDLER: Submission failed:', error)
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }
    }

    private areAllQuestionsAnswered(questions: any[]): boolean {
        return questions.every((question) => {
            const questionId = question.id || question.title
            return (
                this.answers[questionId] &&
                this.answers[questionId].trim() !== ''
            )
        })
    }

    private getSessionId(): string {
        // This should come from the session service
        return 'current-session'
    }
}
