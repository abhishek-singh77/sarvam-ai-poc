import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'
import { Subscription } from 'rxjs'
import {
    AgentWorkflowService,
    AgentPrompt,
    AgentWorkflowState,
} from '../../services/agent-workflow.service'

@Component({
    selector: 'app-agent-prompt-display',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="agent-prompt-container">
            <!-- Agent Message Bubble -->
            <div *ngIf="currentPrompt" class="agent-message-bubble">
                <div class="agent-avatar">
                    <svg
                        class="w-6 h-6 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20">
                        <path
                            fill-rule="evenodd"
                            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                            clip-rule="evenodd"></path>
                    </svg>
                </div>
                <div class="agent-message">
                    <div class="message-text">{{ currentPrompt.message }}</div>
                    <div class="message-time">{{ currentTime }}</div>
                </div>
            </div>

            <!-- Proceed Button for Step Instructions -->
            <div
                *ngIf="
                    currentPrompt?.showProceedButton &&
                    currentPrompt?.type === 'step_instruction'
                "
                class="proceed-button-container">
                <button (click)="onProceedClick()" class="proceed-button">
                    <svg
                        class="w-5 h-5 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"></path>
                    </svg>
                    {{ currentPrompt?.proceedButtonText || 'Proceed' }}
                </button>
            </div>

            <!-- Customer Response Display -->
            <div
                *ngIf="customerResponses && getCustomerResponses().length > 0"
                class="customer-responses">
                <div
                    *ngFor="let response of getCustomerResponses()"
                    class="customer-response-item">
                    <div class="response-question">
                        <strong>{{ response.question }}</strong>
                    </div>
                    <div class="response-answer">
                        <span *ngIf="!response.isEditing">{{
                            response.answer
                        }}</span>
                        <div *ngIf="response.isEditing" class="edit-mode">
                            <input
                                [(ngModel)]="response.editValue"
                                class="edit-input"
                                (keyup.enter)="saveResponse(response)"
                                (keyup.escape)="cancelEdit(response)" />
                            <div class="edit-actions">
                                <button
                                    (click)="saveResponse(response)"
                                    class="save-btn">
                                    Save
                                </button>
                                <button
                                    (click)="cancelEdit(response)"
                                    class="cancel-btn">
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <button
                            *ngIf="!response.isEditing"
                            (click)="startEdit(response)"
                            class="edit-btn">
                            <svg
                                class="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Current Question Input -->
            <div
                *ngIf="isWaitingForResponse && currentQuestion"
                class="current-question-input">
                <div class="question-prompt">
                    <strong>Please answer: {{ currentQuestion.title }}</strong>
                </div>
                <div class="input-container">
                    <input
                        [(ngModel)]="currentResponse"
                        placeholder="Type your answer here..."
                        class="response-input"
                        (keyup.enter)="submitResponse()" />
                    <button
                        (click)="submitResponse()"
                        class="submit-btn"
                        [disabled]="!currentResponse.trim()">
                        Submit
                    </button>
                </div>
            </div>

            <!-- Start Questions Button (fallback) -->
            <div
                *ngIf="
                    workflowState?.currentStep?.type === 'QUESTIONNAIRE' &&
                    !currentQuestion &&
                    !isWaitingForResponse
                "
                class="start-questions-container">
                <div class="start-questions-prompt">
                    <strong>Ready to start the questionnaire?</strong>
                </div>
                <button (click)="startQuestions()" class="start-questions-btn">
                    Start Questions
                </button>
            </div>
        </div>
    `,
    styles: [
        `
            .agent-prompt-container {
                max-width: 100%;
                margin: 0 auto;
                padding: 1rem;
            }

            .agent-message-bubble {
                display: flex;
                align-items: flex-start;
                margin-bottom: 1rem;
                animation: slideIn 0.3s ease-out;
            }

            .agent-avatar {
                width: 2.5rem;
                height: 2.5rem;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 0.75rem;
                flex-shrink: 0;
            }

            .agent-message {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 1rem;
                padding: 0.75rem 1rem;
                max-width: 80%;
                position: relative;
            }

            .message-text {
                color: #1e293b;
                font-size: 0.875rem;
                line-height: 1.5;
                margin-bottom: 0.25rem;
            }

            .message-time {
                color: #64748b;
                font-size: 0.75rem;
            }

            .customer-responses {
                margin-top: 1rem;
            }

            .customer-response-item {
                background: #f1f5f9;
                border: 1px solid #cbd5e1;
                border-radius: 0.75rem;
                padding: 1rem;
                margin-bottom: 0.75rem;
            }

            .response-question {
                color: #475569;
                font-size: 0.875rem;
                margin-bottom: 0.5rem;
            }

            .response-answer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                color: #1e293b;
                font-size: 0.875rem;
            }

            .edit-mode {
                display: flex;
                flex-direction: column;
                width: 100%;
            }

            .edit-input {
                border: 1px solid #d1d5db;
                border-radius: 0.375rem;
                padding: 0.5rem;
                margin-bottom: 0.5rem;
                font-size: 0.875rem;
            }

            .edit-actions {
                display: flex;
                gap: 0.5rem;
            }

            .save-btn,
            .cancel-btn {
                padding: 0.25rem 0.75rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                border: none;
                cursor: pointer;
            }

            .save-btn {
                background: #10b981;
                color: white;
            }

            .cancel-btn {
                background: #6b7280;
                color: white;
            }

            .edit-btn {
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 0.375rem;
                padding: 0.25rem;
                cursor: pointer;
                margin-left: 0.5rem;
            }

            .current-question-input {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 0.75rem;
                padding: 1rem;
                margin-top: 1rem;
            }

            .question-prompt {
                color: #92400e;
                font-size: 0.875rem;
                margin-bottom: 0.75rem;
            }

            .input-container {
                display: flex;
                gap: 0.5rem;
            }

            .response-input {
                flex: 1;
                border: 1px solid #d1d5db;
                border-radius: 0.375rem;
                padding: 0.5rem;
                font-size: 0.875rem;
            }

            .submit-btn {
                background: #10b981;
                color: white;
                border: none;
                border-radius: 0.375rem;
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                cursor: pointer;
            }

            .submit-btn:disabled {
                background: #9ca3af;
                cursor: not-allowed;
            }

            .proceed-button-container {
                display: flex;
                justify-content: center;
                margin: 1rem 0;
            }

            .proceed-button {
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                border: none;
                border-radius: 0.75rem;
                padding: 0.75rem 1.5rem;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                transition: all 0.2s ease;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }

            .proceed-button:hover {
                background: linear-gradient(135deg, #059669 0%, #047857 100%);
                transform: translateY(-1px);
                box-shadow: 0 6px 8px -1px rgba(0, 0, 0, 0.15);
            }

            .proceed-button:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
            }

            .start-questions-container {
                background: #fef3c7;
                border: 1px solid #f59e0b;
                border-radius: 0.75rem;
                padding: 1rem;
                margin-top: 1rem;
                text-align: center;
            }

            .start-questions-prompt {
                color: #92400e;
                font-size: 0.875rem;
                margin-bottom: 0.75rem;
            }

            .start-questions-btn {
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 0.375rem;
                padding: 0.5rem 1rem;
                font-size: 0.875rem;
                cursor: pointer;
                transition: background-color 0.2s ease;
            }

            .start-questions-btn:hover {
                background: #d97706;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `,
    ],
})
export class AgentPromptDisplayComponent implements OnInit, OnDestroy {
    @Input() workflowState: AgentWorkflowState | null = null
    @Output() responseSubmitted = new EventEmitter<{
        questionId: string
        response: string
    }>()
    @Output() responseUpdated = new EventEmitter<{
        questionId: string
        response: string
    }>()
    @Output() proceed = new EventEmitter<void>()

    currentPrompt: AgentPrompt | null = null
    customerResponses: { [questionId: string]: string } = {}
    currentQuestion: any | null = null
    isWaitingForResponse = false
    currentResponse = ''
    currentTime = ''

    private subscriptions: Subscription = new Subscription()

    constructor(private agentWorkflowService: AgentWorkflowService) {}

    ngOnInit(): void {
        this.updateCurrentTime()
        setInterval(() => this.updateCurrentTime(), 1000)

        // Subscribe to workflow state changes
        this.subscriptions.add(
            this.agentWorkflowService.workflowState$.subscribe((state) => {
                this.currentPrompt = state.currentPrompt
                this.customerResponses = state.customerResponses
                this.currentQuestion = state.currentQuestion
                this.isWaitingForResponse = state.isWaitingForResponse

                // Fallback: If no current question but we have a questionnaire step, show the first question
                if (
                    !this.currentQuestion &&
                    state.currentStep?.type === 'QUESTIONNAIRE'
                ) {
                    const questions = state.currentStep?.data?.questions || []
                    if (questions.length > 0 && !this.currentPrompt) {
                        console.log(
                            '🎯 AGENT-PROMPT: Fallback - showing first question from step data'
                        )
                        this.agentWorkflowService.askQuestion(
                            questions[0],
                            0,
                            questions
                        )
                    }
                }
            })
        )
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
    }

    getCustomerResponses(): any[] {
        return Object.entries(this.customerResponses).map(
            ([questionId, answer]) => ({
                questionId,
                question: this.getQuestionText(questionId),
                answer,
                isEditing: false,
                editValue: answer,
            })
        )
    }

    private getQuestionText(questionId: string): string {
        // This would ideally come from the workflow state
        // For now, return a generic question text
        return `Question ${questionId.split('_')[1] || 'Unknown'}`
    }

    submitResponse(): void {
        if (this.currentResponse.trim() && this.currentQuestion) {
            const questionId = `question_${Date.now()}`
            this.responseSubmitted.emit({
                questionId,
                response: this.currentResponse.trim(),
            })
            this.currentResponse = ''
        }
    }

    startEdit(response: any): void {
        response.isEditing = true
        response.editValue = response.answer
    }

    saveResponse(response: any): void {
        if (response.editValue.trim()) {
            this.responseUpdated.emit({
                questionId: response.questionId,
                response: response.editValue.trim(),
            })
            response.isEditing = false
        }
    }

    cancelEdit(response: any): void {
        response.isEditing = false
        response.editValue = response.answer
    }

    onProceedClick(): void {
        console.log('🎯 AGENT-PROMPT: Proceed button clicked')
        this.proceed.emit()
    }

    startQuestions(): void {
        console.log('🎯 AGENT-PROMPT: Start questions button clicked')

        if (this.workflowState?.currentStep?.type === 'QUESTIONNAIRE') {
            const questions =
                this.workflowState.currentStep?.data?.questions || []
            if (questions.length > 0) {
                console.log(
                    '🎯 AGENT-PROMPT: Starting questionnaire with',
                    questions.length,
                    'questions'
                )
                this.agentWorkflowService.startQuestionnaire(questions)
            } else {
                console.warn(
                    '🎯 AGENT-PROMPT: No questions found in questionnaire step'
                )
            }
        }
    }

    private updateCurrentTime(): void {
        this.currentTime = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
        })
    }
}
