import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

export interface Notification {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    duration?: number
    timestamp: Date
}

@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private notificationsSubject = new BehaviorSubject<Notification[]>([])
    public notifications$ = this.notificationsSubject.asObservable()

    private notificationId = 0

    showSuccess(title: string, message: string, duration: number = 5000): void {
        this.addNotification({
            id: this.generateId(),
            type: 'success',
            title,
            message,
            duration,
            timestamp: new Date()
        })
    }

    showError(title: string, message: string, duration: number = 7000): void {
        this.addNotification({
            id: this.generateId(),
            type: 'error',
            title,
            message,
            duration,
            timestamp: new Date()
        })
    }

    showWarning(title: string, message: string, duration: number = 6000): void {
        this.addNotification({
            id: this.generateId(),
            type: 'warning',
            title,
            message,
            duration,
            timestamp: new Date()
        })
    }

    showInfo(title: string, message: string, duration: number = 5000): void {
        this.addNotification({
            id: this.generateId(),
            type: 'info',
            title,
            message,
            duration,
            timestamp: new Date()
        })
    }

    removeNotification(id: string): void {
        const currentNotifications = this.notificationsSubject.value
        const filteredNotifications = currentNotifications.filter(n => n.id !== id)
        this.notificationsSubject.next(filteredNotifications)
    }

    clearAll(): void {
        this.notificationsSubject.next([])
    }

    private addNotification(notification: Notification): void {
        const currentNotifications = this.notificationsSubject.value
        const newNotifications = [...currentNotifications, notification]
        this.notificationsSubject.next(newNotifications)

        // Auto-remove notification after duration
        if (notification.duration && notification.duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification.id)
            }, notification.duration)
        }
    }

    private generateId(): string {
        return `notification-${++this.notificationId}-${Date.now()}`
    }
}
