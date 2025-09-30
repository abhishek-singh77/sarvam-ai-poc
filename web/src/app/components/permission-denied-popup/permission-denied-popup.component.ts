import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface PermissionDeniedItem {
    name: string
    icon: string
    description: string
    error: string
}

@Component({
    selector: 'app-permission-denied-popup',
    standalone: true,
    imports: [CommonModule],
    template: `
        <!-- Backdrop -->
        <div
            *ngIf="isVisible"
            class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <!-- Popup Content -->
            <div
                class="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8">
                <!-- Header -->
                <div class="text-center mb-6">
                    <div
                        class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                            class="w-8 h-8 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-gray-900 mb-2">
                        Permissions Required
                    </h3>
                    <p class="text-gray-600">
                        Please grant the following permissions to continue with the KYC process.
                    </p>
                </div>

                <!-- Permission Issues -->
                <div class="space-y-4 mb-6">
                    <div
                        *ngFor="let item of deniedPermissions"
                        class="flex items-start space-x-3 p-4 bg-red-50 rounded-lg border border-red-200">
                        <div class="flex-shrink-0">
                            <div
                                class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <!-- Camera Icon -->
                                <svg
                                    *ngIf="item.icon === 'camera'"
                                    class="w-5 h-5 text-red-600"
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

                                <!-- Microphone Icon -->
                                <svg
                                    *ngIf="item.icon === 'microphone'"
                                    class="w-5 h-5 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                                </svg>

                                <!-- Location Icon -->
                                <svg
                                    *ngIf="item.icon === 'location'"
                                    class="w-5 h-5 text-red-600"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                    <path
                                        stroke-linecap="round"
                                        stroke-linejoin="round"
                                        stroke-width="2"
                                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                            </div>
                        </div>
                        <div class="flex-1">
                            <h4 class="font-medium text-gray-900 mb-1">
                                {{ item.name }}
                            </h4>
                            <p class="text-sm text-gray-600 mb-2">
                                {{ item.description }}
                            </p>
                            <p class="text-sm text-red-600 font-medium">
                                {{ item.error }}
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Instructions -->
                <div class="bg-blue-50 rounded-lg p-4 mb-6">
                    <h4 class="font-medium text-blue-900 mb-2">
                        How to grant permissions:
                    </h4>
                    <ul class="text-sm text-blue-800 space-y-1">
                        <li>• Look for the permission prompt in your browser</li>
                        <li>• Click "Allow" when prompted</li>
                        <li>• If you missed the prompt, click the lock icon in your address bar</li>
                        <li>• Make sure permissions are set to "Allow"</li>
                    </ul>
                </div>

                <!-- Action Buttons -->
                <div class="flex space-x-3">
                    <button
                        (click)="onCancel()"
                        class="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                        Cancel
                    </button>
                    <button
                        (click)="onRetry()"
                        class="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-medium">
                        Retry Health Check
                    </button>
                </div>
            </div>
        </div>
    `,
})
export class PermissionDeniedPopupComponent {
    @Input() isVisible = false
    @Input() deniedPermissions: PermissionDeniedItem[] = []

    @Output() retry = new EventEmitter<void>()
    @Output() cancel = new EventEmitter<void>()

    onRetry(): void {
        this.retry.emit()
    }

    onCancel(): void {
        this.cancel.emit()
    }
}
