import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router, RouterModule } from '@angular/router'
import { Subscription } from 'rxjs'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { NotificationComponent } from '../notification/notification.component'

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy {
    // Component state
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

    async proceedToKYC(): Promise<void> {
        this.isLoading = true

        try {
            // First, initialize the KYC session (this calls the /create API)
            const result = await this.roomService.initializeKYCSession()

            if (result.success) {
                // Only navigate to KYC route after successful initialization
                this.router.navigate(['/kyc'])
            } else {
                console.error(
                    'KYC session initialization failed:',
                    result.error
                )
            }
        } catch (error: any) {
            const errorMessage =
                error.message || 'Failed to initialize KYC session'
            console.error('KYC session error:', errorMessage)
        } finally {
            this.isLoading = false
        }
    }
}
