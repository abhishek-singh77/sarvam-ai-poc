import { Component, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import {
    NotificationService,
    Notification,
} from '../../services/notification.service'

@Component({
    selector: 'app-notification',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './notification.component.html',
    styles: [
        `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .animate-slide-in {
                animation: slideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .animate-slide-out {
                animation: slideOut 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            /* Hover effects for better interactivity */
            .notification-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
                    0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }

            /* Smooth transitions for all interactive elements */
            .notification-card {
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
        `,
    ],
})
export class NotificationComponent implements OnInit, OnDestroy {
    notifications: (Notification & { removing?: boolean })[] = []
    private subscription: Subscription = new Subscription()

    constructor(private notificationService: NotificationService) {}

    ngOnInit(): void {
        this.subscription.add(
            this.notificationService.notifications$.subscribe(
                (notifications) => {
                    this.notifications = notifications.map((n) => ({
                        ...n,
                        removing: false,
                    }))
                }
            )
        )
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe()
    }

    removeNotification(id: string): void {
        const notification = this.notifications.find((n) => n.id === id)
        if (notification) {
            notification.removing = true
            setTimeout(() => {
                this.notificationService.removeNotification(id)
            }, 300)
        }
    }

    getProgressWidth(notification: Notification): number {
        if (!notification.duration) return 100

        const elapsed = Date.now() - notification.timestamp.getTime()
        const remaining = Math.max(0, notification.duration - elapsed)
        return (remaining / notification.duration) * 100
    }
}
