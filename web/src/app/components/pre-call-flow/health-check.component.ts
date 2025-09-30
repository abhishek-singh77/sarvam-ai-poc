import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface HealthCheckItem {
    name: string
    icon: string
    status: 'pending' | 'checking' | 'completed' | 'failed'
    description: string
}

@Component({
    selector: 'app-health-check',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './health-check.component.html',
    styleUrls: ['./health-check.component.css'],
})
export class HealthCheckComponent implements OnInit {
    @Input() title: string = "Meanwhile, let's Health Check for"
    @Input() healthChecks: HealthCheckItem[] = []
    @Input() autoStart: boolean = true

    @Output() allChecksComplete = new EventEmitter<void>()
    @Output() proceed = new EventEmitter<void>()
    @Output() cancel = new EventEmitter<void>()

    ngOnInit(): void {
        if (this.autoStart) {
            this.startHealthChecks()
        }
    }

    startHealthChecks(): void {
        this.healthChecks.forEach((check, index) => {
            setTimeout(() => {
                this.performHealthCheck(check)
            }, index * 1000) // Stagger checks by 1 second
        })
    }

    private async performHealthCheck(check: HealthCheckItem): Promise<void> {
        check.status = 'checking'

        // Simulate health check based on type
        const delay = Math.random() * 2000 + 1000 // 1-3 seconds

        setTimeout(() => {
            // Simulate success for most checks
            const success = Math.random() > 0.1 // 90% success rate
            check.status = success ? 'completed' : 'failed'

            // Check if all checks are complete
            const allComplete = this.healthChecks.every(
                (c) => c.status === 'completed' || c.status === 'failed'
            )
            if (allComplete) {
                this.allChecksComplete.emit()
            }
        }, delay)
    }

    onProceed(): void {
        this.proceed.emit()
    }

    onCancel(): void {
        this.cancel.emit()
    }

    canProceed(): boolean {
        return this.healthChecks.every((check) => check.status === 'completed')
    }
}
