import {
    Component,
    OnInit,
    OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router, RouterModule } from '@angular/router'
import { Subscription } from 'rxjs'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { NotificationComponent } from '../notification/notification.component'

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        NotificationComponent,
    ],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
    // Component state
    status: string = 'Ready'
    isLoading: boolean = false
    apiBase: string = 'http://localhost:8000'

    private subscriptions: Subscription[] = []

    constructor(
        private roomService: EnterpriseRoomService,
        private router: Router
    ) {}

    ngOnInit(): void {
        // No subscriptions needed for a pure landing page
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe())
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


    async proceedToKYC(): Promise<void> {
        this.isLoading = true
        this.setStatus('Initializing KYC session...')

        try {
            // First, initialize the KYC session (this calls the /create API)
            const result = await this.roomService.initializeKYCSession()

            if (result.success) {
                this.setStatus('KYC session ready')
                // Only navigate to KYC route after successful initialization
                this.router.navigate(['/kyc'])
            } else {
                this.setStatus('Error: ' + (result.error || 'Unknown error'))
                this.showUserFriendlyError(result.error || 'Unknown error')
            }
        } catch (error: any) {
            const errorMessage =
                error.message || 'Failed to initialize KYC session'
            this.setStatus('Error: ' + errorMessage)
            this.showUserFriendlyError(errorMessage)
        } finally {
            this.isLoading = false
        }
    }

    // Show user-friendly error messages
    private showUserFriendlyError(error: string): void {
        console.error('KYC Session Error:', error)
        // For a landing page, we'll just log the error and update status
        // The actual error handling will be done in the VKYC session component
        this.setStatus('Error: ' + error)
    }

    // Helper method to set status
    private setStatus(status: string): void {
        this.status = status
    }

}

