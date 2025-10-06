import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnDestroy,
    OnChanges,
    SimpleChanges,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import {
    DetectionResult,
    DocumentDetectionResult,
    MultipleFaceDetectionResult,
} from '../../services/enhanced-detection.service'

@Component({
    selector: 'app-detection-overlays',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './detection-overlays.component.html',
    styleUrls: ['./detection-overlays.component.css'],
})
export class DetectionOverlaysComponent
    implements OnInit, OnDestroy, OnChanges
{
    @Input() detectionResult: DetectionResult | null = null
    @Input() multipleFaceDetectionResult: MultipleFaceDetectionResult | null =
        null
    @Input() documentDetectionResult: DocumentDetectionResult | null = null
    @Input() captureType:
        | 'FACE_CAPTURE'
        | 'DOCUMENT_CAPTURE'
        | 'QUESTIONNAIRE'
        | null = null
    @Input() showMultipleFaces: boolean = true
    @Input() isCapturing: boolean = false
    @Output() autoCaptureTriggered = new EventEmitter<void>()

    // Countdown state
    countdown: number | null = null
    private countdownInterval: number | null = null
    private monitoringInterval: number | null = null
    private readonly COUNTDOWN_DURATION = 3 // 3 second countdown
    private readonly CAPTURE_THRESHOLD = 0.6 // Confidence threshold for auto-capture

    ngOnInit() {
        // Only start monitoring for confidence threshold if capture type is appropriate
        if (
            this.captureType === 'FACE_CAPTURE' ||
            this.captureType === 'DOCUMENT_CAPTURE'
        ) {
            this.startConfidenceMonitoring()
        }

        // Debug: Log detection state changes
        console.log('🎯 DETECTION-OVERLAYS: Component initialized', {
            captureType: this.captureType,
            hasDetectionResult: !!this.detectionResult,
            hasMultipleFaceResult: !!this.multipleFaceDetectionResult,
            hasDocumentResult: !!this.documentDetectionResult,
            captureThreshold: this.CAPTURE_THRESHOLD,
        })
    }

    ngOnChanges(changes: SimpleChanges): void {
        // Handle capture type changes
        if (changes['captureType']) {
            console.log(
                '🎯 DETECTION-OVERLAYS: Capture type changed to:',
                this.captureType
            )

            // Clear any existing monitoring and countdown
            this.clearCountdown()
            this.clearMonitoring()

            // Start monitoring only for appropriate capture types
            if (
                this.captureType === 'FACE_CAPTURE' ||
                this.captureType === 'DOCUMENT_CAPTURE'
            ) {
                this.startConfidenceMonitoring()
            }
        }
    }

    ngOnDestroy() {
        this.clearCountdown()
        this.clearMonitoring()
    }

    private startConfidenceMonitoring() {
        this.monitoringInterval = window.setInterval(() => {
            // Don't start auto-capture if already capturing or image manipulator is open
            if (this.isCapturing) {
                if (this.countdown !== null) {
                    console.log(
                        '🎯 DETECTION: Already capturing, clearing countdown'
                    )
                }
                this.clearCountdown()
                return
            }

            const meetsThreshold = this.meetsCaptureThreshold()

            if (meetsThreshold) {
                // Confidence meets threshold, start countdown if not already started
                if (this.countdown === null) {
                    console.log(
                        '🎯 DETECTION: Confidence threshold met, starting auto-capture countdown'
                    )
                    this.startCountdown()
                }
            } else {
                // Confidence below threshold, clear countdown
                if (this.countdown !== null) {
                    console.log(
                        '🎯 DETECTION: Confidence below threshold, clearing countdown'
                    )
                }
                this.clearCountdown()
            }
        }, 100) // Check every 100ms
    }

    private meetsCaptureThreshold(): boolean {
        const currentTime = Date.now()

        if (this.captureType === 'FACE_CAPTURE') {
            const faceResult =
                this.multipleFaceDetectionResult?.primaryFace ||
                this.detectionResult
            const confidence = faceResult?.confidence || 0

            // Debug: Log detection state every 5 seconds
            if (
                Math.floor(currentTime / 5000) !==
                Math.floor((currentTime - 100) / 5000)
            ) {
                console.log('🎯 DETECTION: Face detection state', {
                    captureType: this.captureType,
                    hasFaceResult: !!faceResult,
                    confidence: confidence.toFixed(2),
                    threshold: this.CAPTURE_THRESHOLD,
                    meetsThreshold: confidence >= this.CAPTURE_THRESHOLD,
                })
            }

            // Simple threshold check - no steady logic needed
            return confidence >= this.CAPTURE_THRESHOLD
        } else if (this.captureType === 'DOCUMENT_CAPTURE') {
            const confidence = this.documentDetectionResult?.confidence || 0

            // Debug: Log detection state every 5 seconds
            if (
                Math.floor(currentTime / 5000) !==
                Math.floor((currentTime - 100) / 5000)
            ) {
                console.log('🎯 DETECTION: Document detection state', {
                    captureType: this.captureType,
                    hasDocumentResult: !!this.documentDetectionResult,
                    confidence: confidence.toFixed(2),
                    threshold: this.CAPTURE_THRESHOLD,
                    meetsThreshold: confidence >= this.CAPTURE_THRESHOLD,
                })
            }

            // Simple threshold check - no steady logic needed
            return confidence >= this.CAPTURE_THRESHOLD
        }

        return false
    }

    private startCountdown() {
        this.countdown = this.COUNTDOWN_DURATION

        this.countdownInterval = window.setInterval(() => {
            if (this.countdown && this.countdown > 1) {
                this.countdown--
            } else {
                // Countdown finished, trigger auto-capture
                this.clearCountdown()
                this.autoCaptureTriggered.emit()
            }
        }, 1000)
    }

    private clearCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval)
            this.countdownInterval = null
        }
        this.countdown = null
    }

    private clearMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval)
            this.monitoringInterval = null
        }
    }
}
