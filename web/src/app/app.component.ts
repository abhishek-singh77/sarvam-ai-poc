import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router, NavigationEnd, RouterOutlet } from '@angular/router'
import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import { EnterpriseRoomService } from './services/enterprise-room.service'
import { MediaService } from './services/media.service'
import { NotificationComponent } from './components/notification/notification.component'

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, RouterOutlet, NotificationComponent],
    templateUrl: './app.component.html',
    styleUrls: [],
})
export class AppComponent implements OnInit, OnDestroy {
    // Component state
    currentRoute: string = ''
    status: string = 'Ready'
    apiBase: string = 'http://localhost:8000'

    private subscriptions: Subscription[] = []

    constructor(
        private roomService: EnterpriseRoomService,
        private mediaService: MediaService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.initializeSubscriptions()
    }

    private initializeSubscriptions(): void {
        // Subscribe to route changes
        this.subscriptions.push(
            this.router.events
                .pipe(filter((event) => event instanceof NavigationEnd))
                .subscribe((event: NavigationEnd) => {
                    this.currentRoute = event.url
                })
        )

        // Subscribe to room service status changes (only for KYC session)
        this.subscriptions.push(
            this.roomService.status$.subscribe((status) => {
                console.log('Room service status received:', status)
                // Only update status if we're in KYC route
                if (this.currentRoute === '/kyc') {
                    console.log('Updating status from room service:', status)
                    this.status = status
                } else {
                    console.log(
                        'Filtered out status (not in KYC route):',
                        status
                    )
                }
            })
        )
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
}
