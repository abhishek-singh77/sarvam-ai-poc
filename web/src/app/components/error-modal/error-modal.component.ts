import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface ErrorModalData {
    title: string
    message: string
    type: 'network' | 'server' | 'agent' | 'configuration' | 'general'
    showRetry: boolean
    retryAction?: () => void
}

@Component({
    selector: 'app-error-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div *ngIf="isVisible" class="fixed inset-0 z-50 overflow-y-auto">
            <div
                class="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <!-- Background overlay -->
                <div
                    class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                    (click)="close()"></div>

                <!-- Modal panel -->
                <div
                    class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <!-- Icon and title -->
                        <div class="sm:flex sm:items-start">
                            <div
                                class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10"
                                [ngClass]="getIconClass()">
                                <svg
                                    class="h-6 w-6"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        *ngIf="errorData?.type === 'network'"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z"></path>
                                    <path
                                        *ngIf="errorData?.type === 'server'"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                                    <path
                                        *ngIf="errorData?.type === 'agent'"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    <path
                                        *ngIf="
                                            errorData?.type === 'configuration'
                                        "
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    <path
                                        *ngIf="errorData?.type === 'general'"
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                            </div>
                            <div
                                class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                                <h3
                                    class="text-lg leading-6 font-medium text-gray-900"
                                    id="modal-title">
                                    {{ errorData?.title || 'Error' }}
                                </h3>
                                <div class="mt-2">
                                    <p class="text-sm text-gray-500">
                                        {{
                                            errorData?.message ||
                                                'An unexpected error occurred.'
                                        }}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div
                        class="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            *ngIf="errorData?.showRetry"
                            type="button"
                            class="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                            (click)="retry()">
                            Try Again
                        </button>
                        <button
                            type="button"
                            class="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                            (click)="close()">
                            {{ errorData?.showRetry ? 'Cancel' : 'Close' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .bg-red-100 {
                background-color: rgb(254 226 226);
            }
            .bg-yellow-100 {
                background-color: rgb(254 249 195);
            }
            .bg-blue-100 {
                background-color: rgb(219 234 254);
            }
            .bg-orange-100 {
                background-color: rgb(255 237 213);
            }
            .bg-gray-100 {
                background-color: rgb(243 244 246);
            }

            .text-red-600 {
                color: rgb(220 38 38);
            }
            .text-yellow-600 {
                color: rgb(202 138 4);
            }
            .text-blue-600 {
                color: rgb(37 99 235);
            }
            .text-orange-600 {
                color: rgb(234 88 12);
            }
            .text-gray-600 {
                color: rgb(75 85 99);
            }
        `,
    ],
})
export class ErrorModalComponent {
    @Input() isVisible: boolean = false
    @Input() errorData: ErrorModalData | null = null
    @Output() closeModal = new EventEmitter<void>()
    @Output() retryAction = new EventEmitter<void>()

    close(): void {
        this.closeModal.emit()
    }

    retry(): void {
        if (this.errorData?.retryAction) {
            this.errorData.retryAction()
        }
        this.retryAction.emit()
    }

    getIconClass(): string {
        if (!this.errorData) return 'bg-gray-100 text-gray-600'

        switch (this.errorData.type) {
            case 'network':
                return 'bg-red-100 text-red-600'
            case 'server':
                return 'bg-yellow-100 text-yellow-600'
            case 'agent':
                return 'bg-orange-100 text-orange-600'
            case 'configuration':
                return 'bg-blue-100 text-blue-600'
            default:
                return 'bg-gray-100 text-gray-600'
        }
    }
}
