import { Component, Input, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Subscription } from 'rxjs'

interface WorkflowStep {
    id: string
    type: string
    title: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    data: any
    instructions?: string
    questions?: any[]
    document_types?: string[]
}

interface WorkflowProgress {
    total: number
    completed: number
    current: number
    percentage: number
}

@Component({
    selector: 'app-workflow-progress',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="workflow-progress-container">
            <!-- Progress Header -->
            <div class="progress-header">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">
                    KYC Verification Progress
                </h3>
                <div class="progress-bar-container">
                    <div class="progress-bar">
                        <div
                            class="progress-fill"
                            [style.width.%]="progress.percentage"></div>
                    </div>
                    <div class="progress-text">
                        {{ progress.completed }} of {{ progress.total }} steps
                        completed ({{ progress.percentage }}%)
                    </div>
                </div>
            </div>

            <!-- Steps List -->
            <div class="steps-container">
                <div
                    *ngFor="let step of steps; let i = index"
                    class="step-item"
                    [class.completed]="step.status === 'completed'"
                    [class.in-progress]="step.status === 'in_progress'"
                    [class.failed]="step.status === 'failed'">
                    <!-- Step Icon -->
                    <div class="step-icon">
                        <div
                            *ngIf="step.status === 'completed'"
                            class="icon-completed">
                            <svg
                                class="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div
                            *ngIf="step.status === 'in_progress'"
                            class="icon-in-progress">
                            <div
                                class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        </div>
                        <div
                            *ngIf="step.status === 'failed'"
                            class="icon-failed">
                            <svg
                                class="w-5 h-5"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                    clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div
                            *ngIf="step.status === 'pending'"
                            class="icon-pending">
                            <div
                                class="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                        </div>
                    </div>

                    <!-- Step Content -->
                    <div class="step-content">
                        <div class="step-title">{{ step.title }}</div>
                        <div class="step-description">
                            {{ step.description }}
                        </div>

                        <!-- Step Instructions -->
                        <div
                            *ngIf="
                                step.instructions &&
                                step.status === 'in_progress'
                            "
                            class="step-instructions">
                            <div class="instructions-label">Instructions:</div>
                            <div class="instructions-text">
                                {{ step.instructions }}
                            </div>
                        </div>

                        <!-- Step Data (for completed steps) -->
                        <div
                            *ngIf="step.data && step.status === 'completed'"
                            class="step-data">
                            <div class="data-label">Completed Data:</div>
                            <div class="data-content">
                                <div
                                    *ngIf="
                                        step.type === 'questionnaire' &&
                                        step.data.answers
                                    "
                                    class="questionnaire-data">
                                    <div
                                        *ngFor="let answer of step.data.answers"
                                        class="answer-item">
                                        <span class="answer-question"
                                            >{{ answer.question }}:</span
                                        >
                                        <span class="answer-value">{{
                                            answer.answer
                                        }}</span>
                                    </div>
                                </div>
                                <div
                                    *ngIf="
                                        step.type === 'selfie_capture' &&
                                        step.data.image_url
                                    "
                                    class="selfie-data">
                                    <div class="image-preview">
                                        <img
                                            [src]="step.data.image_url"
                                            alt="Selfie"
                                            class="preview-image" />
                                    </div>
                                </div>
                                <div
                                    *ngIf="
                                        step.type === 'id_upload' &&
                                        step.data.document_url
                                    "
                                    class="document-data">
                                    <div class="document-info">
                                        <div class="document-type">
                                            {{ step.data.document_type }}
                                        </div>
                                        <div class="image-preview">
                                            <img
                                                [src]="step.data.document_url"
                                                alt="ID Document"
                                                class="preview-image" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Step Error (for failed steps) -->
                        <div
                            *ngIf="step.data && step.data.error"
                            class="step-error">
                            <div class="error-message">
                                {{ step.data.error }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .workflow-progress-container {
                @apply bg-white rounded-lg shadow-md p-6;
            }

            .progress-header {
                @apply mb-6;
            }

            .progress-bar-container {
                @apply space-y-2;
            }

            .progress-bar {
                @apply w-full bg-gray-200 rounded-full h-3;
            }

            .progress-fill {
                @apply bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 ease-out;
            }

            .progress-text {
                @apply text-sm text-gray-600 text-center;
            }

            .steps-container {
                @apply space-y-4;
            }

            .step-item {
                @apply flex items-start space-x-4 p-4 rounded-lg border transition-all duration-200;
                @apply border-gray-200 bg-gray-50;
            }

            .step-item.completed {
                @apply border-green-200 bg-green-50;
            }

            .step-item.in-progress {
                @apply border-blue-200 bg-blue-50;
            }

            .step-item.failed {
                @apply border-red-200 bg-red-50;
            }

            .step-icon {
                @apply flex-shrink-0 mt-1;
            }

            .icon-completed {
                @apply text-green-600;
            }

            .icon-in-progress {
                @apply text-blue-600;
            }

            .icon-failed {
                @apply text-red-600;
            }

            .icon-pending {
                @apply text-gray-400;
            }

            .step-content {
                @apply flex-1 min-w-0;
            }

            .step-title {
                @apply text-lg font-semibold text-gray-800 mb-1;
            }

            .step-description {
                @apply text-sm text-gray-600 mb-2;
            }

            .step-instructions {
                @apply mt-3 p-3 bg-blue-100 rounded-lg;
            }

            .instructions-label {
                @apply text-sm font-medium text-blue-800 mb-1;
            }

            .instructions-text {
                @apply text-sm text-blue-700;
            }

            .step-data {
                @apply mt-3 p-3 bg-green-100 rounded-lg;
            }

            .data-label {
                @apply text-sm font-medium text-green-800 mb-2;
            }

            .data-content {
                @apply space-y-2;
            }

            .questionnaire-data {
                @apply space-y-2;
            }

            .answer-item {
                @apply flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-2;
            }

            .answer-question {
                @apply text-sm font-medium text-gray-700;
            }

            .answer-value {
                @apply text-sm text-gray-900 font-semibold;
            }

            .selfie-data,
            .document-data {
                @apply space-y-2;
            }

            .image-preview {
                @apply max-w-xs;
            }

            .preview-image {
                @apply w-full h-auto rounded-lg border border-gray-300;
            }

            .document-type {
                @apply text-sm font-medium text-gray-700;
            }

            .step-error {
                @apply mt-3 p-3 bg-red-100 rounded-lg;
            }

            .error-message {
                @apply text-sm text-red-700;
            }

            .animate-spin {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `,
    ],
})
export class WorkflowProgressComponent implements OnInit, OnDestroy {
    @Input() roomId: string = ''

    steps: WorkflowStep[] = []
    progress: WorkflowProgress = {
        total: 0,
        completed: 0,
        current: 0,
        percentage: 0,
    }

    private refreshInterval: any
    private subscriptions: Subscription = new Subscription()

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        if (this.roomId) {
            this.loadWorkflowProgress()
            // Refresh every 5 seconds
            this.refreshInterval = setInterval(() => {
                this.loadWorkflowProgress()
            }, 5000)
        }
    }

    ngOnDestroy(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
        this.subscriptions.unsubscribe()
    }

    private loadWorkflowProgress(): void {
        if (!this.roomId) return

        this.http
            .get(
                `http://localhost:8000/api/v1/sessions/workflow/progress/${this.roomId}`
            )
            .subscribe({
                next: (response: any) => {
                    if (response.status === 'success') {
                        this.steps = response.steps || []
                        this.progress = response.progress || this.progress
                    }
                },
                error: (error) => {
                    console.error('Failed to load workflow progress:', error)
                },
            })
    }

    getStepStatusClass(step: WorkflowStep): string {
        switch (step.status) {
            case 'completed':
                return 'completed'
            case 'in_progress':
                return 'in-progress'
            case 'failed':
                return 'failed'
            default:
                return ''
        }
    }
}
