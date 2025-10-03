import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

export interface QuestionnaireQuestion {
    title: string
    validated: boolean
    input_type: string
    otp_check: boolean
    mandatory: boolean
}

export interface QuestionnaireData {
    questions: QuestionnaireQuestion[]
}

@Component({
    selector: 'app-questionnaire-step',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
        <div class="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <div class="text-center">
                <!-- Step Header -->
                <div class="mb-6">
                    <h2
                        class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                        Questionnaire
                    </h2>
                    <p class="text-sm sm:text-base text-gray-600">
                        Question {{ currentQuestionIndex + 1 }} of
                        {{ totalQuestions }}
                    </p>
                </div>

                <!-- Progress Bar -->
                <div class="mb-6">
                    <div class="w-full bg-gray-200 rounded-full h-2">
                        <div
                            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            [style.width.%]="progressPercentage"></div>
                    </div>
                </div>

                <!-- Current Question -->
                <div class="mb-6">
                    <h3
                        class="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
                        {{ currentQuestion?.title }}
                    </h3>

                    <!-- Question Info -->
                    <p class="text-sm text-gray-600">
                        Review this question and click Next when ready to
                        proceed.
                    </p>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-center">
                    <button
                        (click)="onNextQuestion()"
                        [disabled]="isSubmitting"
                        class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors">
                        <div *ngIf="isSubmitting" class="flex items-center">
                            <svg
                                class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24">
                                <circle
                                    class="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    stroke-width="4"></circle>
                                <path
                                    class="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {{
                                isLastQuestion
                                    ? 'Completing...'
                                    : 'Processing...'
                            }}
                        </div>
                        <span *ngIf="!isSubmitting">
                            {{
                                isLastQuestion
                                    ? 'Complete Questionnaire'
                                    : 'Next Question'
                            }}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            textarea:focus {
                outline: none;
            }
        `,
    ],
})
export class QuestionnaireStepComponent implements OnInit {
    @Input() questionnaireData: QuestionnaireData | null = null
    @Output() questionnaireCompleted = new EventEmitter<{
        [key: string]: string
    }>()

    currentQuestionIndex = 0
    answers: { [key: string]: string } = {}
    isSubmitting = false

    get currentQuestion(): QuestionnaireQuestion | null {
        if (!this.questionnaireData?.questions) return null
        return (
            this.questionnaireData.questions[this.currentQuestionIndex] || null
        )
    }

    get totalQuestions(): number {
        return this.questionnaireData?.questions?.length || 0
    }

    get progressPercentage(): number {
        if (this.totalQuestions === 0) return 0
        return ((this.currentQuestionIndex + 1) / this.totalQuestions) * 100
    }

    get isLastQuestion(): boolean {
        return this.currentQuestionIndex === this.totalQuestions - 1
    }

    ngOnInit(): void {
        console.log(
            '🎯 QUESTIONNAIRE-STEP: Component initialized with data:',
            this.questionnaireData
        )
    }

    onNextQuestion(): void {
        if (this.isSubmitting) {
            return
        }

        this.isSubmitting = true

        // Mark question as viewed (no answer required)
        const questionKey = `question_${this.currentQuestionIndex + 1}`
        this.answers[questionKey] = 'viewed' // Just mark as viewed

        console.log('🎯 QUESTIONNAIRE-STEP: Question viewed:', questionKey)

        if (this.isLastQuestion) {
            // All questions completed - add a small delay for UX
            setTimeout(() => {
                console.log(
                    '🎯 QUESTIONNAIRE-STEP: All questions completed:',
                    this.answers
                )
                this.questionnaireCompleted.emit(this.answers)
                this.isSubmitting = false
            }, 1000)
        } else {
            // Move to next question - add a small delay for UX
            setTimeout(() => {
                this.currentQuestionIndex++
                this.isSubmitting = false
                console.log(
                    '🎯 QUESTIONNAIRE-STEP: Moving to question:',
                    this.currentQuestionIndex + 1
                )
            }, 500)
        }
    }
}
