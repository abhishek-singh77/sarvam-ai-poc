import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import {
    HealthCheckService,
    HealthCheckResult,
} from '../../services/health-check.service'
import {
    PermissionDeniedPopupComponent,
    PermissionDeniedItem,
} from '../permission-denied-popup/permission-denied-popup.component'
import { HealthCheckDataService } from '../../services/health-check-data.service'
import { SessionStorageService } from '../../services/session-storage.service'

export interface HealthCheckItem {
    name: string
    icon: string
    status: 'pending' | 'checking' | 'completed' | 'failed'
    description: string
}

@Component({
    selector: 'app-health-check',
    standalone: true,
    imports: [CommonModule, PermissionDeniedPopupComponent],
    templateUrl: './health-check.component.html',
    styleUrls: ['./health-check.component.css'],
})
export class HealthCheckComponent implements OnInit, OnDestroy {
    @Input() title: string = "Meanwhile, let's Health Check for"
    @Input() autoStart: boolean = true

    @Output() allChecksComplete = new EventEmitter<void>()
    @Output() proceed = new EventEmitter<{
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }>()
    @Output() cancel = new EventEmitter<void>()

    healthChecks: HealthCheckResult[] = []
    showPermissionDeniedPopup = false
    deniedPermissions: PermissionDeniedItem[] = []
    private subscription = new Subscription()

    constructor(
        private healthCheckService: HealthCheckService,
        private healthCheckDataService: HealthCheckDataService,
        private sessionStorage: SessionStorageService
    ) {}

    ngOnInit(): void {
        // Subscribe to health check updates
        this.subscription.add(
            this.healthCheckService.healthChecks$.subscribe((checks) => {
                this.healthChecks = checks

                // Check if all checks are complete
                const allComplete = checks.every(
                    (c) => c.status === 'completed' || c.status === 'failed'
                )
                if (allComplete) {
                    this.allChecksComplete.emit()

                    // Check for permission denied errors
                    const failedChecks = checks.filter(
                        (c) => c.status === 'failed'
                    )
                    const permissionErrors = failedChecks.filter(
                        (c) =>
                            c.error?.includes('denied') ||
                            c.error?.includes('permission') ||
                            c.error?.includes('access')
                    )

                    if (permissionErrors.length > 0) {
                        this.showPermissionDeniedPopup = true
                        this.deniedPermissions = permissionErrors.map(
                            (check) => ({
                                name: check.name,
                                icon: check.icon,
                                description: check.description,
                                error: check.error || 'Permission denied',
                            })
                        )
                    }
                }
            })
        )

        if (this.autoStart) {
            this.startHealthChecks()
        }
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe()
    }

    async startHealthChecks(): Promise<void> {
        await this.healthCheckService.startHealthChecks()
    }

    async onProceed(): Promise<void> {
        if (this.canProceed()) {
            const locationData = this.healthCheckService.getLocationData()
            const networkSpeed = this.healthCheckService.getNetworkSpeed()
            const isVpnDetected = false // VPN detection removed

            // Store health check data to backend immediately
            try {
                const sessionData = this.sessionStorage.getSessionData()
                if (sessionData) {
                    const healthCheckRequest =
                        this.healthCheckDataService.createHealthCheckDataRequest(
                            sessionData.sessionId,
                            locationData,
                            networkSpeed,
                            isVpnDetected
                        )

                    console.log(
                        '🎯 HEALTH-CHECK: Storing health check data to backend...'
                    )
                    console.log(
                        '🎯 HEALTH-CHECK: Request data:',
                        healthCheckRequest
                    )

                    const response = await this.healthCheckDataService
                        .storeHealthCheckData(healthCheckRequest)
                        .toPromise()

                    console.log(
                        '🎯 HEALTH-CHECK: Health check data stored successfully:',
                        response
                    )
                    console.log(
                        '🎯 HEALTH-CHECK: Response status:',
                        response?.status
                    )
                    console.log(
                        '🎯 HEALTH-CHECK: Response message:',
                        response?.message
                    )
                } else {
                    console.warn(
                        '🎯 HEALTH-CHECK: No session data found, skipping health check data storage'
                    )
                }
            } catch (error) {
                console.error(
                    '🎯 HEALTH-CHECK: Failed to store health check data:',
                    error
                )
                console.error('🎯 HEALTH-CHECK: Error details:', {
                    message: (error as any)?.message,
                    status: (error as any)?.status,
                    statusText: (error as any)?.statusText,
                    url: (error as any)?.url,
                    error: (error as any)?.error,
                })
                // Don't block the flow if health check data storage fails
            }

            this.proceed.emit({
                locationData,
                networkSpeed,
                isVpnDetected,
            })
        }
    }

    onCancel(): void {
        this.cancel.emit()
    }

    canProceed(): boolean {
        return this.healthCheckService.canProceed()
    }

    getFailedChecks(): HealthCheckResult[] {
        return this.healthCheckService.getFailedChecks()
    }

    onRetryHealthCheck(): void {
        this.showPermissionDeniedPopup = false
        this.deniedPermissions = []
        // Re-run only the failed checks without resetting all
        this.retryFailedChecks()
    }

    private async retryFailedChecks(): Promise<void> {
        const failedChecks = this.healthChecks.filter(
            (check) => check.status === 'failed'
        )

        console.log(
            '🔄 Retrying failed checks:',
            failedChecks.map((c) => c.name)
        )

        for (const check of failedChecks) {
            // Reset the check status to pending
            this.healthCheckService.updateCheckStatus(check.name, 'pending')

            // Add a small delay between retries
            await new Promise((resolve) => setTimeout(resolve, 500))

            // Re-run the specific check
            if (check.name === 'Camera') {
                await this.healthCheckService.retryCameraCheck()
            } else if (check.name === 'Microphone') {
                await this.healthCheckService.retryMicrophoneCheck()
            } else if (check.name === 'Location') {
                await this.healthCheckService.retryLocationCheck()
            } else if (check.name === 'Network Speed') {
                await this.healthCheckService.retryNetworkSpeedCheck()
            } else if (check.name === 'Browser') {
                await this.healthCheckService.retryBrowserCheck()
            }
        }

        // Check if all checks are now complete
        const updatedChecks = this.healthChecks
        const allComplete = updatedChecks.every(
            (c) => c.status === 'completed' || c.status === 'failed'
        )

        if (allComplete) {
            this.allChecksComplete.emit()

            // Check for any remaining permission errors
            const stillFailed = updatedChecks.filter(
                (c) => c.status === 'failed'
            )
            const permissionErrors = stillFailed.filter(
                (c) =>
                    c.error?.includes('denied') ||
                    c.error?.includes('permission') ||
                    c.error?.includes('access')
            )

            if (permissionErrors.length > 0) {
                this.showPermissionDeniedPopup = true
                this.deniedPermissions = permissionErrors.map((check) => ({
                    name: check.name,
                    icon: check.icon,
                    description: check.description,
                    error: check.error || 'Permission denied',
                }))
            }
        }
    }

    onPermissionDeniedCancel(): void {
        this.showPermissionDeniedPopup = false
        this.cancel.emit()
    }
}
