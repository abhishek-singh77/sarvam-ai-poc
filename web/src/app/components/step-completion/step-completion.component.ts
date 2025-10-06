import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface StepCompletionData {
    stepTitle: string
    stepDescription: string
    isCompleted: boolean
    isLastStep: boolean
    analysisResult?: any
    isLoading?: boolean
    error?: string
}

@Component({
    selector: 'app-step-completion',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="bg-white rounded-xl p-4 sm:p-6 shadow-lg glass-card">
            <div class="text-center">
                <!-- Step Header -->
                <div class="mb-6">
                    <div
                        class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center shadow-modern"
                        [ngClass]="
                            data.isCompleted
                                ? 'bg-gradient-to-r from-green-100 to-emerald-100 animate-glow'
                                : 'bg-gradient-to-r from-blue-100 to-indigo-100'
                        ">
                        <svg
                            *ngIf="data.isCompleted"
                            class="w-8 h-8 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M5 13l4 4L19 7"></path>
                        </svg>
                        <svg
                            *ngIf="!data.isCompleted"
                            class="w-8 h-8 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path>
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                    </div>
                    <h2
                        class="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                        {{ data.stepTitle }}
                    </h2>
                    <p class="text-sm sm:text-base text-gray-600">
                        {{
                            data.isCompleted
                                ? 'Step completed successfully!'
                                : 'Click the button below to start this step.'
                        }}
                    </p>
                </div>

                <!-- Analysis Results (if available) -->
                <div
                    *ngIf="data.analysisResult && data.isCompleted"
                    class="mb-6">
                    <div class="bg-gray-50 rounded-lg p-4 text-left">
                        <h4 class="font-semibold text-gray-900 mb-2">
                            Analysis Results:
                        </h4>
                        <div class="text-sm text-gray-700 space-y-1">
                            <div
                                *ngIf="
                                    data.analysisResult.face_detected !==
                                    undefined
                                ">
                                <span class="font-medium">Face Detected:</span>
                                <span
                                    [ngClass]="
                                        data.analysisResult.face_detected
                                            ? 'text-green-600'
                                            : 'text-red-600'
                                    ">
                                    {{
                                        data.analysisResult.face_detected
                                            ? 'Yes'
                                            : 'No'
                                    }}
                                </span>
                            </div>
                            <div *ngIf="data.analysisResult.image_quality">
                                <span class="font-medium">Image Quality:</span>
                                <span class="capitalize">{{
                                    data.analysisResult.image_quality
                                }}</span>
                            </div>
                            <div *ngIf="data.analysisResult.confidence_score">
                                <span class="font-medium"
                                    >Confidence Score:</span
                                >
                                <span
                                    >{{
                                        (
                                            data.analysisResult
                                                .confidence_score * 100
                                        ).toFixed(1)
                                    }}%</span
                                >
                            </div>
                            <div *ngIf="data.analysisResult.document_type">
                                <span class="font-medium">Document Type:</span>
                                <span>{{
                                    data.analysisResult.document_type
                                }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Error Message -->
                <div *ngIf="data.error" class="mb-4">
                    <div class="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p class="text-red-700 text-sm">{{ data.error }}</p>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-center">
                    <button
                        *ngIf="!data.isCompleted && !data.isLoading"
                        (click)="onStartStep()"
                        class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern">
                        Start {{ data.stepTitle }}
                    </button>

                    <button
                        *ngIf="data.isLoading"
                        disabled
                        class="bg-gray-400 cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium">
                        <div class="flex items-center">
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
                            Processing...
                        </div>
                    </button>

                    <button
                        *ngIf="
                            data.isCompleted &&
                            !data.isLastStep &&
                            !data.isLoading
                        "
                        (click)="onNextStep()"
                        class="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern">
                        Next Step
                    </button>

                    <button
                        *ngIf="
                            data.isCompleted &&
                            data.isLastStep &&
                            !data.isLoading
                        "
                        (click)="onFinish()"
                        class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl btn-modern animate-glow">
                        Finish KYC
                    </button>
                </div>
            </div>
        </div>
    `,
})
export class StepCompletionComponent {
    @Input() data: StepCompletionData = {
        stepTitle: '',
        stepDescription: '',
        isCompleted: false,
        isLastStep: false,
    }

    @Output() startStep = new EventEmitter<void>()
    @Output() nextStep = new EventEmitter<void>()
    @Output() finish = new EventEmitter<void>()

    onStartStep(): void {
        console.log('🎯 STEP-COMPLETION: Start step requested')
        this.startStep.emit()
    }

    onNextStep(): void {
        console.log('🎯 STEP-COMPLETION: Next step requested')
        this.nextStep.emit()
    }

    onFinish(): void {
        console.log('🎯 STEP-COMPLETION: Finish requested')
        this.finish.emit()
    }

    onEndKyc(): void {
        console.log('🎯 STEP-COMPLETION: End KYC requested')
        this.finish.emit()
    }
}
