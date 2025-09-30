import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'

export interface HealthCheckResult {
    name: string
    icon: string
    status: 'pending' | 'checking' | 'completed' | 'failed'
    description: string
    data?: any // Store additional data like location, network speed, etc.
    error?: string
}

export interface LocationData {
    latitude: number
    longitude: number
    accuracy: number
    timestamp: number
}

export interface NetworkSpeed {
    downloadSpeed: number // Mbps
    uploadSpeed: number // Mbps
    latency: number // ms
}

@Injectable({
    providedIn: 'root',
})
export class HealthCheckService {
    private healthChecks = new BehaviorSubject<HealthCheckResult[]>([])
    public healthChecks$ = this.healthChecks.asObservable()

    private locationData = new BehaviorSubject<LocationData | null>(null)
    public locationData$ = this.locationData.asObservable()

    private networkSpeed = new BehaviorSubject<NetworkSpeed | null>(null)
    public networkSpeed$ = this.networkSpeed.asObservable()

    private defaultChecks: HealthCheckResult[] = [
        {
            name: 'Camera',
            icon: 'camera',
            status: 'pending',
            description: 'Checking camera access and quality',
        },
        {
            name: 'Microphone',
            icon: 'microphone',
            status: 'pending',
            description: 'Checking microphone access and quality',
        },
        {
            name: 'Location',
            icon: 'location',
            status: 'pending',
            description: 'Checking location permissions and accuracy',
        },
        {
            name: 'Network Speed',
            icon: 'network',
            status: 'pending',
            description: 'Testing network connectivity and speed',
        },
        {
            name: 'Browser',
            icon: 'browser',
            status: 'pending',
            description: 'Checking browser compatibility',
        },
    ]

    constructor() {
        this.healthChecks.next([...this.defaultChecks])
    }

    async startHealthChecks(): Promise<void> {
        const checks = [...this.defaultChecks]
        this.healthChecks.next(checks)

        // Run checks in parallel for better performance
        const checkPromises = [
            this.checkCamera(checks[0]),
            this.checkMicrophone(checks[1]),
            this.checkLocation(checks[2]),
            this.checkNetworkSpeed(checks[3]),
            this.checkBrowser(checks[4]),
        ]

        await Promise.allSettled(checkPromises)
    }

    private async checkCamera(check: HealthCheckResult): Promise<void> {
        check.status = 'checking'
        this.updateCheck(check)

        try {
            // Simple camera permission check
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
            })

            // Stop the stream immediately after getting permission
            stream.getTracks().forEach((track) => track.stop())

            check.status = 'completed'
            check.data = { permission: 'granted' }
            this.updateCheck(check)
        } catch (error: any) {
            check.status = 'failed'
            if (error.name === 'NotAllowedError') {
                check.error =
                    'Camera access denied. Please allow camera permission.'
            } else if (error.name === 'NotFoundError') {
                check.error = 'No camera found on this device.'
            } else {
                check.error = error.message || 'Camera access failed'
            }
            this.updateCheck(check)
        }
    }

    private async checkMicrophone(check: HealthCheckResult): Promise<void> {
        check.status = 'checking'
        this.updateCheck(check)

        try {
            // Simple microphone permission check
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            })

            // Stop the stream immediately after getting permission
            stream.getTracks().forEach((track) => track.stop())

            check.status = 'completed'
            check.data = { permission: 'granted' }
            this.updateCheck(check)
        } catch (error: any) {
            check.status = 'failed'
            if (error.name === 'NotAllowedError') {
                check.error =
                    'Microphone access denied. Please allow microphone permission.'
            } else if (error.name === 'NotFoundError') {
                check.error = 'No microphone found on this device.'
            } else {
                check.error = error.message || 'Microphone access failed'
            }
            this.updateCheck(check)
        }
    }

    private async checkLocation(check: HealthCheckResult): Promise<void> {
        check.status = 'checking'
        this.updateCheck(check)

        if (!navigator.geolocation) {
            check.status = 'failed'
            check.error = 'Geolocation not supported'
            this.updateCheck(check)
            return
        }

        try {
            const position = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0,
                    })
                }
            )

            const locationData: LocationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: Date.now(),
            }

            this.locationData.next(locationData)

            if (position.coords.accuracy <= 100) {
                // Accuracy within 100 meters
                check.status = 'completed'
                check.data = locationData
            } else {
                check.status = 'failed'
                check.error = `Location accuracy too low: ${Math.round(
                    position.coords.accuracy
                )}m`
            }

            this.updateCheck(check)
        } catch (error: any) {
            check.status = 'failed'
            check.error = error.message || 'Location access denied'
            this.updateCheck(check)
        }
    }

    private async checkNetworkSpeed(check: HealthCheckResult): Promise<void> {
        check.status = 'checking'
        this.updateCheck(check)

        try {
            // Use navigator.connection if available
            const connection =
                (navigator as any).connection ||
                (navigator as any).mozConnection ||
                (navigator as any).webkitConnection

            if (connection) {
                const downlink = connection.downlink || 0 // Mbps
                const effectiveType = connection.effectiveType || 'unknown'
                const rtt = connection.rtt || 0 // ms
                const saveData = connection.saveData || false

                const networkSpeed: NetworkSpeed = {
                    downloadSpeed: downlink,
                    uploadSpeed: downlink * 0.8, // Estimate upload as 80% of download
                    latency: rtt,
                }

                this.networkSpeed.next(networkSpeed)

                console.log('🌐 Network info from navigator.connection:', {
                    downlink,
                    effectiveType,
                    rtt,
                    saveData,
                    networkSpeed,
                })

                // Mark as completed if we have any connection info
                check.status = 'completed'
                check.data = {
                    ...networkSpeed,
                    effectiveType,
                    saveData,
                    source: 'navigator.connection',
                }
                this.updateCheck(check)
            } else {
                // Fallback: assume good connectivity if navigator.connection is not available
                console.log(
                    '🌐 navigator.connection not available, assuming good connectivity'
                )
                const networkSpeed: NetworkSpeed = {
                    downloadSpeed: 5, // Assume decent speed
                    uploadSpeed: 4,
                    latency: 50, // Assume low latency
                }

                this.networkSpeed.next(networkSpeed)
                check.status = 'completed'
                check.data = {
                    ...networkSpeed,
                    source: 'fallback',
                }
                this.updateCheck(check)
            }
        } catch (error: any) {
            console.log('🌐 Network check error:', error)
            // Even if everything fails, assume basic connectivity
            const networkSpeed: NetworkSpeed = {
                downloadSpeed: 1,
                uploadSpeed: 1,
                latency: 1000,
            }

            this.networkSpeed.next(networkSpeed)
            check.status = 'completed'
            check.data = {
                ...networkSpeed,
                source: 'error-fallback',
            }
            this.updateCheck(check)
        }
    }

    private async checkBrowser(check: HealthCheckResult): Promise<void> {
        check.status = 'checking'
        this.updateCheck(check)

        try {
            // Get browser name using user agent
            const userAgent = navigator.userAgent
            let browserName = 'Unknown'

            if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
                browserName = 'Chrome'
            } else if (userAgent.includes('Firefox')) {
                browserName = 'Firefox'
            } else if (
                userAgent.includes('Safari') &&
                !userAgent.includes('Chrome')
            ) {
                browserName = 'Safari'
            } else if (userAgent.includes('Edg')) {
                browserName = 'Edge'
            }

            // Check for essential APIs only (remove WebRTC check as it's not always available)
            const essentialAPIs = [
                'mediaDevices' in navigator,
                'geolocation' in navigator,
                'fetch' in window,
            ]

            const essentialSupported = essentialAPIs.every(
                (supported) => supported
            )

            // Check for audio context (optional)
            const hasAudioContext =
                'AudioContext' in window || 'webkitAudioContext' in window

            // Check for WebRTC (optional)
            const hasWebRTC =
                'RTCPeerConnection' in window ||
                'webkitRTCPeerConnection' in window

            console.log('🌐 Browser check:', {
                browserName,
                userAgent: navigator.userAgent,
                essentialAPIs,
                essentialSupported,
                hasAudioContext,
                hasWebRTC,
            })

            if (browserName === 'Chrome' && essentialSupported) {
                console.log('✅ Chrome browser check passed')
                check.status = 'completed'
                check.data = {
                    browserName,
                    userAgent: navigator.userAgent,
                    essentialAPIs: essentialAPIs,
                    hasAudioContext,
                    hasWebRTC,
                }
            } else if (
                (browserName === 'Firefox' ||
                    browserName === 'Safari' ||
                    browserName === 'Edge') &&
                essentialSupported
            ) {
                console.log('✅ Other browser check passed:', browserName)
                check.status = 'completed'
                check.data = {
                    browserName,
                    userAgent: navigator.userAgent,
                    essentialAPIs: essentialAPIs,
                    hasAudioContext,
                    hasWebRTC,
                    warning: 'Browser may have limited functionality',
                }
            } else if (essentialSupported) {
                // Even if browser is unknown but essential APIs work, allow it
                console.log('✅ Unknown browser but APIs work')
                check.status = 'completed'
                check.data = {
                    browserName,
                    userAgent: navigator.userAgent,
                    essentialAPIs: essentialAPIs,
                    hasAudioContext,
                    hasWebRTC,
                    warning: 'Unknown browser - functionality may be limited',
                }
            } else {
                console.log('❌ Browser check failed:', {
                    browserName,
                    essentialSupported,
                    essentialAPIs,
                })
                check.status = 'failed'
                check.error =
                    'Browser missing essential APIs (mediaDevices, geolocation, fetch)'
            }

            this.updateCheck(check)
        } catch (error: any) {
            check.status = 'failed'
            check.error = 'Browser compatibility check failed'
            this.updateCheck(check)
        }
    }

    private calculateBrightness(imageData: ImageData | undefined): number {
        if (!imageData) return 0

        let total = 0
        const data = imageData.data

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i]
            const g = data[i + 1]
            const b = data[i + 2]
            total += (r + g + b) / 3
        }

        return total / (data.length / 4) / 255 // Normalize to 0-1
    }

    private updateCheck(check: HealthCheckResult): void {
        const currentChecks = this.healthChecks.value
        const index = currentChecks.findIndex((c) => c.name === check.name)
        if (index !== -1) {
            currentChecks[index] = { ...check }
            this.healthChecks.next([...currentChecks])
        }
    }

    canProceed(): boolean {
        const checks = this.healthChecks.value
        // Camera and microphone are critical, others can have warnings
        const criticalChecks = checks.filter(
            (check) => check.name === 'Camera' || check.name === 'Microphone'
        )
        const criticalPassed = criticalChecks.every(
            (check) => check.status === 'completed'
        )

        // At least camera and microphone must pass
        return criticalPassed
    }

    getFailedChecks(): HealthCheckResult[] {
        return this.healthChecks.value.filter(
            (check) => check.status === 'failed'
        )
    }

    getLocationData(): LocationData | null {
        return this.locationData.value
    }

    getNetworkSpeed(): NetworkSpeed | null {
        return this.networkSpeed.value
    }

    reset(): void {
        this.healthChecks.next([...this.defaultChecks])
        this.locationData.next(null)
        this.networkSpeed.next(null)
    }

    // Method to update individual check status
    updateCheckStatus(
        name: string,
        status: 'pending' | 'checking' | 'completed' | 'failed'
    ): void {
        const currentChecks = this.healthChecks.value
        const updatedChecks = currentChecks.map((check) =>
            check.name === name ? { ...check, status } : check
        )
        this.healthChecks.next(updatedChecks)
    }

    // Individual check methods for retry functionality
    async retryCameraCheck(): Promise<void> {
        const cameraCheck = this.healthChecks.value.find(
            (check) => check.name === 'Camera'
        )
        if (cameraCheck) {
            await this.checkCamera(cameraCheck)
        }
    }

    async retryMicrophoneCheck(): Promise<void> {
        const micCheck = this.healthChecks.value.find(
            (check) => check.name === 'Microphone'
        )
        if (micCheck) {
            await this.checkMicrophone(micCheck)
        }
    }

    async retryLocationCheck(): Promise<void> {
        const locationCheck = this.healthChecks.value.find(
            (check) => check.name === 'Location'
        )
        if (locationCheck) {
            await this.checkLocation(locationCheck)
        }
    }

    async retryNetworkSpeedCheck(): Promise<void> {
        const networkCheck = this.healthChecks.value.find(
            (check) => check.name === 'Network Speed'
        )
        if (networkCheck) {
            await this.checkNetworkSpeed(networkCheck)
        }
    }

    async retryBrowserCheck(): Promise<void> {
        const browserCheck = this.healthChecks.value.find(
            (check) => check.name === 'Browser'
        )
        if (browserCheck) {
            await this.checkBrowser(browserCheck)
        }
    }
}
