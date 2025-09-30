import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-agent-join-popup',
    standalone: true,
    imports: [CommonModule],
    template: `
        <!-- Backdrop -->
        <div
            *ngIf="isVisible"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <!-- Popup Content -->
            <div
                class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8">
                <!-- Header -->
                <div class="text-center mb-6">
                    <div
                        class="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <!-- Loading Spinner -->
                        <svg
                            *ngIf="isLoading"
                            class="w-8 h-8 text-white animate-spin"
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
                        <!-- Success Icon -->
                        <svg
                            *ngIf="!isLoading && isReady"
                            class="w-8 h-8 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20">
                            <path
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clip-rule="evenodd"></path>
                        </svg>
                        <!-- Default Icon -->
                        <svg
                            *ngIf="!isLoading && !isReady"
                            class="w-8 h-8 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">
                        {{ title }}
                    </h3>
                    <p class="text-gray-600">{{ description }}</p>
                </div>

                <!-- Loading Steps -->
                <div *ngIf="isLoading" class="space-y-3 mb-6">
                    <div class="flex items-center space-x-3">
                        <div
                            class="w-6 h-6 rounded-full flex items-center justify-center"
                            [ngClass]="
                                currentStep >= 1
                                    ? 'bg-green-500'
                                    : 'bg-gray-200'
                            ">
                            <svg
                                *ngIf="currentStep >= 1"
                                class="w-4 h-4 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd"></path>
                            </svg>
                            <div
                                *ngIf="currentStep < 1"
                                class="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                        <span
                            class="text-sm"
                            [ngClass]="
                                currentStep >= 1
                                    ? 'text-gray-900'
                                    : 'text-gray-500'
                            "
                            >Initializing AI Agent</span
                        >
                    </div>

                    <div class="flex items-center space-x-3">
                        <div
                            class="w-6 h-6 rounded-full flex items-center justify-center"
                            [ngClass]="
                                currentStep >= 2
                                    ? 'bg-green-500'
                                    : 'bg-gray-200'
                            ">
                            <svg
                                *ngIf="currentStep >= 2"
                                class="w-4 h-4 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd"></path>
                            </svg>
                            <div
                                *ngIf="currentStep < 2"
                                class="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                        <span
                            class="text-sm"
                            [ngClass]="
                                currentStep >= 2
                                    ? 'text-gray-900'
                                    : 'text-gray-500'
                            "
                            >Connecting to Video Stream</span
                        >
                    </div>

                    <div class="flex items-center space-x-3">
                        <div
                            class="w-6 h-6 rounded-full flex items-center justify-center"
                            [ngClass]="
                                currentStep >= 3
                                    ? 'bg-green-500'
                                    : 'bg-gray-200'
                            ">
                            <svg
                                *ngIf="currentStep >= 3"
                                class="w-4 h-4 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clip-rule="evenodd"></path>
                            </svg>
                            <div
                                *ngIf="currentStep < 3"
                                class="w-2 h-2 bg-gray-400 rounded-full"></div>
                        </div>
                        <span
                            class="text-sm"
                            [ngClass]="
                                currentStep >= 3
                                    ? 'text-gray-900'
                                    : 'text-gray-500'
                            "
                            >Agent Ready</span
                        >
                    </div>
                </div>

                <!-- Agent Info -->
                <div
                    *ngIf="!isLoading && isReady"
                    class="bg-gray-50 rounded-lg p-4 mb-6">
                    <div class="flex items-center space-x-3">
                        <div
                            class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <svg
                                class="w-5 h-5 text-green-600"
                                fill="currentColor"
                                viewBox="0 0 20 20">
                                <path
                                    fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clip-rule="evenodd"></path>
                            </svg>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">AI Agent</p>
                            <p class="text-sm text-gray-500">
                                Stream enabled and ready
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Auto-close message -->
                <div *ngIf="!isLoading && isReady" class="flex justify-center">
                    <div class="text-center">
                        <p class="text-sm text-gray-600 mb-2">
                            Agent is ready!
                        </p>
                        <p class="text-xs text-gray-500">
                            This popup will close automatically...
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .animate-pulse {
                animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }

            @keyframes pulse {
                0%,
                100% {
                    opacity: 1;
                }
                50% {
                    opacity: 0.5;
                }
            }
        `,
    ],
})
export class AgentJoinPopupComponent {
    @Input() isVisible = false
    @Input() isLoading = true
    @Input() isReady = false
    @Input() currentStep = 0
    @Input() title = 'AI Agent Joining...'
    @Input() description =
        'Please wait while we initialize your AI agent and connect to the video stream.'
    @Input() agentInfo: any = null

    @Output() join = new EventEmitter<void>()

    onJoin(): void {
        this.join.emit()
    }
}
