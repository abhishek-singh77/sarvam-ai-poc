import {
    Component,
    OnInit,
    OnDestroy,
    AfterViewInit,
    ViewChild,
    ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router } from '@angular/router'
import { Subscription } from 'rxjs'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { MediaService } from '../../services/media.service'
import { VkycSessionComponent } from '../vkyc-session/vkyc-session.component'
import { NotificationComponent } from '../notification/notification.component'
import {
    ErrorModalComponent,
    ErrorModalData,
} from '../error-modal/error-modal.component'
import { SessionStorageService } from '../../services/session-storage.service'

@Component({
    selector: 'app-kyc',
    standalone: true,
    imports: [CommonModule, VkycSessionComponent, ErrorModalComponent],
    templateUrl: './kyc.component.html',
    styleUrls: ['./kyc.component.css'],
})
export class KYCComponent implements OnInit, OnDestroy {
    // Component state
    status: string = 'Ready'
    isLoading: boolean = false
    isSessionActive: boolean = false
    apiBase: string = 'http://localhost:8000'

    // Error modal state
    showErrorModal: boolean = false
    errorModalData: ErrorModalData | null = null

    private subscriptions: Subscription[] = []

    constructor(
        private roomService: EnterpriseRoomService,
        private mediaService: MediaService,
        private router: Router,
        private sessionStorage: SessionStorageService
    ) {}

    ngOnInit(): void {
        this.initializeSubscriptions()
        this.checkExistingSession()
    }

    private checkExistingSession(): void {
        // Check if we have existing session data
        const sessionData = this.sessionStorage.getSessionData()

        if (sessionData && sessionData.sessionId) {
            console.log(
                '🔄 Found existing session data, resuming session...',
                sessionData
            )
            this.isSessionActive = true
            this.setStatus('KYC session ready')
            // The VKYC session component will handle the rest based on existing session
        } else {
            console.log('🆕 No existing session data, creating new session')
            this.initializeNewSession()
        }
    }

    private async initializeNewSession(): Promise<void> {
        try {
            this.isLoading = true
            this.setStatus('Creating new KYC session...')
            console.log(
                '🎯 KYC: Creating new session (this should not happen if Home component already created one)'
            )

            const result = await this.roomService.initializeKYCSession()

            if (result.success) {
                this.isSessionActive = true
                this.setStatus('KYC session ready')
            } else {
                throw new Error(result.error || 'Failed to create session')
            }
        } catch (error: any) {
            console.error('Failed to initialize new session:', error)
            this.setStatus('Error: ' + error.message)
            this.showErrorModal = true
            this.errorModalData = {
                title: 'Session Creation Failed',
                message: error.message || 'Failed to create KYC session',
                type: 'general',
                showRetry: true,
                retryAction: () => this.initializeNewSession(),
            }
        } finally {
            this.isLoading = false
        }
    }

    private async rejoinSession(roomData: any): Promise<void> {
        try {
            // Set the status to indicate we're rejoining
            this.setStatus('Rejoining session...')

            // Validate that the session is still active
            if (this.isSessionValid(roomData)) {
                // The room data is already available, so we can proceed
                this.setStatus('Session rejoined successfully')

                // Session rejoined - user should start call from VKYC flow
                this.setStatus('Session rejoined. Start call from VKYC flow.')
            } else {
                this.setStatus('Session expired')
                this.showUserFriendlyError(
                    'The KYC session has expired. Please start a new session.'
                )
                setTimeout(() => {
                    this.returnToHome()
                }, 3000)
            }
        } catch (error: any) {
            console.error('Failed to rejoin session:', error)
            this.setStatus('Failed to rejoin session')
            this.showUserFriendlyError(
                'Failed to rejoin the KYC session. Please start a new session.'
            )
        }
    }

    private isSessionValid(roomData: any): boolean {
        if (!roomData || !roomData.roomId) {
            return false
        }

        // For now, we'll consider the session valid if we have room data
        // In the future, we could add timestamp checks or server validation
        // Check if the room data was created recently (e.g., within last 24 hours)
        const now = new Date().getTime()
        const sessionTimeout = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

        // If roomData has a timestamp, check it
        if (roomData.timestamp) {
            const sessionAge = now - roomData.timestamp
            return sessionAge < sessionTimeout
        }

        // If no timestamp, assume it's valid (for backward compatibility)
        return true
    }

    private initializeSubscriptions(): void {
        // Subscribe to room service status changes
        this.subscriptions.push(
            this.roomService.status$.subscribe((status) => {
                console.log('Room service status received:', status)
                this.status = status
                this.isLoading = this.isStatusLoading(status)
            })
        )
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe())
        this.roomService.cleanup()
        this.mediaService.stopCurrentStream()
    }

    getStatusClass(): string {
        const statusLower = this.status.toLowerCase()

        if (
            statusLower.includes('error') ||
            statusLower.includes('failed') ||
            statusLower.includes('denied')
        ) {
            return 'bg-red-100 text-red-800 border-red-200'
        }

        if (
            statusLower.includes('ready') ||
            statusLower.includes('enabled') ||
            statusLower.includes('success')
        ) {
            return 'bg-green-100 text-green-800 border-green-200'
        }

        if (
            statusLower.includes('loading') ||
            statusLower.includes('requesting') ||
            statusLower.includes('initializing')
        ) {
            return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }

        return 'bg-blue-100 text-blue-800 border-blue-200'
    }

    private isStatusLoading(status: string): boolean {
        const loadingStatuses = [
            'loading',
            'requesting',
            'initializing',
            'creating',
            'joining',
            'starting',
        ]
        return loadingStatuses.some((loadingStatus) =>
            status.toLowerCase().includes(loadingStatus)
        )
    }

    // Show user-friendly error messages with retry options
    private showUserFriendlyError(error: string): void {
        let title = 'KYC Session Error'
        let message = 'An error occurred while starting the KYC session.'
        let type: 'network' | 'server' | 'agent' | 'configuration' | 'general' =
            'general'
        let showRetry = true

        if (
            error.includes('Cannot connect to server') ||
            error.includes('Network error')
        ) {
            title = 'Connection Error'
            message =
                'Unable to connect to the server. Please check your internet connection and try again.'
            type = 'network'
        } else if (error.includes('Server error') || error.includes('500')) {
            title = 'Server Error'
            message =
                'Server error occurred. Please try again in a few moments.'
            type = 'server'
        } else if (
            error.includes('Service unavailable') ||
            error.includes('503')
        ) {
            title = 'Service Unavailable'
            message =
                'Service is temporarily unavailable. Please try again later.'
            type = 'server'
        } else if (
            error.includes('AI agent') ||
            error.includes('agent initialization')
        ) {
            title = 'AI Agent Error'
            message =
                'AI agent initialization failed. Please try again or contact support if the issue persists.'
            type = 'agent'
        } else if (
            error.includes('Invalid agent configuration') ||
            error.includes('400')
        ) {
            title = 'Configuration Error'
            message =
                'Configuration error. Please contact support for assistance.'
            type = 'configuration'
            showRetry = false
        }

        this.errorModalData = {
            title,
            message,
            type,
            showRetry,
            retryAction: () => this.returnToHome(),
        }
        this.showErrorModal = true
    }

    // Error modal handlers
    onErrorModalClose(): void {
        this.showErrorModal = false
        this.errorModalData = null
    }

    onErrorModalRetry(): void {
        this.showErrorModal = false
        this.errorModalData = null
        // Redirect to home to start a new session
        this.returnToHome()
    }

    returnToHome(): void {
        this.router.navigate(['/home'])
    }

    // Helper method to set status
    private setStatus(status: string): void {
        this.status = status
    }
}
