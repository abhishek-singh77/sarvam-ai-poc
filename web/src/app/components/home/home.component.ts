import {
    Component,
    OnInit,
    OnDestroy,
    AfterViewInit,
    ViewChild,
    ElementRef,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import { Router, RouterModule } from '@angular/router'
import { Subscription } from 'rxjs'
import { MediaService } from '../../services/media.service'
import { EnterpriseRoomService } from '../../services/enterprise-room.service'
import { NotificationComponent } from '../notification/notification.component'
import {
    ErrorModalComponent,
    ErrorModalData,
} from '../error-modal/error-modal.component'

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        NotificationComponent,
        ErrorModalComponent,
    ],
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('homeVideoRef') homeVideoRef!: ElementRef<HTMLVideoElement>

    // Component state
    status: string = 'Ready'
    hasMedia: boolean = false
    mediaError: string | null = null
    isLoading: boolean = false
    mediaLoading: boolean = false
    apiBase: string = 'http://localhost:8000'

    // Error modal state
    showErrorModal: boolean = false
    errorModalData: ErrorModalData | null = null

    private subscriptions: Subscription[] = []

    constructor(
        private mediaService: MediaService,
        private roomService: EnterpriseRoomService,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.initializeSubscriptions()
    }

    private initializeSubscriptions(): void {
        // Subscribe to media state changes
        this.subscriptions.push(
            this.mediaService.mediaState$.subscribe((state) => {
                this.hasMedia = state.hasMedia
                this.mediaError = state.error

                // If media is available, wait for video element and set up the stream
                if (state.hasMedia) {
                    this.setupVideoPreviewAfterRender()
                }
            })
        )
    }

    ngAfterViewInit(): void {
        // Video element is now available, set up preview if media is already enabled
        if (this.hasMedia) {
            this.setupVideoPreview()
        }
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

    async enableMedia(): Promise<void> {
        console.log('🎯 HOME: Starting enableMedia()')
        this.mediaLoading = true
        this.status = 'Requesting media access...'

        try {
            console.log('🎯 HOME: Calling mediaService.requestMediaAccess()')
            const success = await this.mediaService.requestMediaAccess()

            if (success) {
                console.log('🎯 HOME: Media access successful')
                this.status = 'Media access enabled'
                console.log('🎯 HOME: Media setup complete')
            } else {
                console.log('🎯 HOME: Media access denied')
                this.status = 'Media access denied'
                this.showMediaError(
                    'Camera and microphone access denied. Please allow permissions and try again.'
                )
            }
        } catch (error: any) {
            console.error('🎯 HOME: Media access error:', error)
            this.status = 'Media access failed'
            this.showMediaError(
                'Failed to access camera and microphone. Please check your device permissions.'
            )
        } finally {
            this.mediaLoading = false
            console.log('🎯 HOME: enableMedia() completed')
        }
    }

    private setupVideoPreviewAfterRender(): void {
        console.log('🎯 HOME: Setting up video preview after render...')

        // Use setTimeout to wait for the next change detection cycle
        setTimeout(async () => {
            try {
                await this.setupVideoStream()
            } catch (error) {
                console.error('🎯 HOME: Error setting up video preview:', error)
            }
        }, 100)
    }

    private async setupVideoStream(): Promise<void> {
        console.log('🎯 HOME: Setting up video stream...')

        const stream = await this.mediaService.getMediaStream()
        if (!stream) {
            throw new Error('No media stream available')
        }

        if (!this.homeVideoRef) {
            throw new Error('Video element not available')
        }

        console.log(
            '🎯 HOME: Stream and video element available, configuring...'
        )
        console.log('🎯 HOME: Stream details:', {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
        })

        // Clear any existing stream
        this.homeVideoRef.nativeElement.srcObject = null

        // Set the new stream
        this.homeVideoRef.nativeElement.srcObject = stream
        console.log('🎯 HOME: Stream assigned to video element')

        this.configureVideoElement()
        this.setupVideoEventHandlers()

        // Force play if metadata is already loaded
        if (this.homeVideoRef.nativeElement.readyState >= 1) {
            console.log('🎯 HOME: Video ready, starting playback...')
            await this.homeVideoRef.nativeElement.play()
        } else {
            console.log('🎯 HOME: Video not ready yet, waiting for metadata...')
        }

        // Additional debugging - check video element state after a short delay
        setTimeout(() => {
            this.debugVideoElement()
            this.forceVideoPlay()
        }, 1000)
    }

    private configureVideoElement(): void {
        if (!this.homeVideoRef) return

        console.log('🎯 HOME: Configuring video element...')

        const videoElement = this.homeVideoRef.nativeElement
        videoElement.muted = true
        videoElement.playsInline = true
        videoElement.autoplay = true

        console.log('🎯 HOME: Video element configured:', {
            muted: videoElement.muted,
            playsInline: videoElement.playsInline,
            autoplay: videoElement.autoplay,
            readyState: videoElement.readyState,
            srcObject: !!videoElement.srcObject,
        })
    }

    private setupVideoEventHandlers(): void {
        if (!this.homeVideoRef) return

        console.log('🎯 HOME: Setting up video event handlers...')

        this.homeVideoRef.nativeElement.onloadedmetadata = () => {
            console.log('🎯 HOME: Video metadata loaded, starting playback...')
            this.homeVideoRef.nativeElement.play().catch((error: any) => {
                console.error('🎯 HOME: Error playing video:', error)
            })
        }

        this.homeVideoRef.nativeElement.oncanplay = () => {
            console.log('🎯 HOME: Video can play')
        }

        this.homeVideoRef.nativeElement.onplay = () => {
            console.log('🎯 HOME: Video started playing')
        }

        this.homeVideoRef.nativeElement.onloadstart = () => {
            console.log('🎯 HOME: Video load started')
        }

        this.homeVideoRef.nativeElement.onerror = (error: any) => {
            console.error('🎯 HOME: Video error:', error)
        }

        this.homeVideoRef.nativeElement.onstalled = () => {
            console.log('🎯 HOME: Video stalled')
        }

        this.homeVideoRef.nativeElement.onsuspend = () => {
            console.log('🎯 HOME: Video suspended')
        }
    }

    private debugVideoElement(): void {
        if (!this.homeVideoRef) {
            console.log('🎯 HOME: Video element not available for debugging')
            return
        }

        const videoElement = this.homeVideoRef.nativeElement
        console.log('🎯 HOME: Video element debug info:', {
            readyState: videoElement.readyState,
            networkState: videoElement.networkState,
            paused: videoElement.paused,
            ended: videoElement.ended,
            muted: videoElement.muted,
            volume: videoElement.volume,
            currentTime: videoElement.currentTime,
            duration: videoElement.duration,
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            srcObject: !!videoElement.srcObject,
            src: videoElement.src,
            autoplay: videoElement.autoplay,
            playsInline: videoElement.playsInline,
            style: {
                display: videoElement.style.display,
                visibility: videoElement.style.visibility,
                opacity: videoElement.style.opacity,
                width: videoElement.style.width,
                height: videoElement.style.height,
            },
        })

        // Check if video is actually visible
        const rect = videoElement.getBoundingClientRect()
        console.log('🎯 HOME: Video element position:', {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0,
        })
    }

    private forceVideoPlay(): void {
        if (!this.homeVideoRef) return

        const videoElement = this.homeVideoRef.nativeElement
        console.log('🎯 HOME: Attempting to force video play...')

        if (videoElement.paused) {
            videoElement
                .play()
                .then(() => {
                    console.log('🎯 HOME: Video play successful')
                })
                .catch((error: any) => {
                    console.error('🎯 HOME: Video play failed:', error)
                })
        } else {
            console.log('🎯 HOME: Video is already playing')
        }
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

    // Show media-specific error messages
    private showMediaError(error: string): void {
        console.error('Media access error:', error)
        // For now, just log the error. In the future, you could show a toast notification
        // or a simple alert instead of the KYC session error modal
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
            retryAction: () => this.proceedToKYC(),
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
        // Retry the KYC initialization
        this.proceedToKYC()
    }

    // Helper method to set status
    private setStatus(status: string): void {
        this.status = status
    }

    private async setupVideoPreview(): Promise<void> {
        console.log('🎯 HOME: setupVideoPreview called')
        this.setupVideoPreviewAfterRender()
    }
}
