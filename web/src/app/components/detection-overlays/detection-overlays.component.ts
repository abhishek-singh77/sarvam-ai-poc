import {
    Component,
    Input,
    Output,
    EventEmitter,
    OnInit,
    OnDestroy,
} from '@angular/core'
import { CommonModule } from '@angular/common'
import {
    DetectionResult,
    MultipleFaceDetectionResult,
} from '../../services/enhanced-detection.service'

@Component({
    selector: 'app-detection-overlays',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './detection-overlays.component.html',
    styleUrls: ['./detection-overlays.component.css'],
})
export class DetectionOverlaysComponent implements OnInit, OnDestroy {
    @Input() detectionResult: DetectionResult | null = null
    @Input() multipleFaceDetectionResult: MultipleFaceDetectionResult | null =
        null
    // Document detection removed - only manual capture for documents
    @Input() captureType:
        | 'FACE_CAPTURE'
        | 'DOCUMENT_CAPTURE'
        | 'QUESTIONNAIRE'
        | null = null
    @Input() showMultipleFaces: boolean = true
    @Input() isImageManipulatorOpen: boolean = false
    @Output() autoCaptureTriggered = new EventEmitter<void>()

    // Countdown state
    countdown: number | null = null
    private countdownInterval: number | null = null
    private lastSteadyTime: number = 0
    private readonly STEADY_DURATION_MS = 500 // 0.5 second of steady detection before countdown (reduced for better UX)
    private readonly COUNTDOWN_DURATION = 3 // 3 second countdown
    private readonly MIN_CONFIDENCE_THRESHOLD = 0.6 // Minimum confidence for auto-capture (optimized for better UX)

    ngOnInit() {
        // Start monitoring for steady detection
        this.startSteadyDetectionMonitoring()

        // Component initialized
    }

    ngOnDestroy() {
        this.clearCountdown()
    }

    private startSteadyDetectionMonitoring() {
        setInterval(() => {
            const isSteady = this.isDetectionSteady()
            // Steady detection monitoring

            if (isSteady) {
                const now = Date.now()
                if (this.lastSteadyTime === 0) {
                    this.lastSteadyTime = now
                    console.log(
                        '🎯 DETECTION: Started steady detection monitoring'
                    )
                } else if (
                    now - this.lastSteadyTime >=
                    this.STEADY_DURATION_MS
                ) {
                    // Detection has been steady for required duration, start countdown
                    if (
                        this.countdown === null &&
                        !this.isImageManipulatorOpen
                    ) {
                        console.log(
                            '🎯 DETECTION: Starting auto-capture countdown'
                        )
                        this.startCountdown()
                    } else if (this.isImageManipulatorOpen) {
                        console.log(
                            '🎯 DETECTION: Auto-capture countdown blocked - image manipulator is open'
                        )
                    }
                }
            } else {
                // Detection not steady, reset
                if (this.lastSteadyTime !== 0) {
                    console.log('🎯 DETECTION: Detection not steady, resetting')
                }
                this.lastSteadyTime = 0
                this.clearCountdown()
            }
        }, 100) // Check every 100ms
    }

    private isDetectionSteady(): boolean {
        const currentTime = Date.now()

        if (this.captureType === 'FACE_CAPTURE') {
            const faceResult =
                this.multipleFaceDetectionResult?.primaryFace ||
                this.detectionResult
            const hasGoodConfidence = this.hasGoodConfidence()
            const confidence = faceResult?.confidence || 0

            // Face detection steady check

            // For auto-capture, we only need good confidence and single face
            // No steady condition needed - immediate capture when conditions are met
            if (
                hasGoodConfidence &&
                confidence >= this.MIN_CONFIDENCE_THRESHOLD &&
                this.multipleFaceDetectionResult?.totalFaces === 1
            ) {
                return true
            } else {
                return false
            }
        } else if (this.captureType === 'DOCUMENT_CAPTURE') {
            // Document capture is manual only - no auto-capture
            return false
        }
        return false
    }

    private hasGoodConfidence(): boolean {
        // Simplified confidence check for immediate auto-capture
        if (this.captureType === 'FACE_CAPTURE') {
            const faceResult =
                this.multipleFaceDetectionResult?.primaryFace ||
                this.detectionResult
            if (faceResult?.confidence) {
                const hasGoodConfidence =
                    faceResult.confidence >= this.MIN_CONFIDENCE_THRESHOLD
                // Confidence check
                return hasGoodConfidence
            }
        } else if (this.captureType === 'DOCUMENT_CAPTURE') {
            // Document capture is manual only - no auto-capture
            return false
        }

        // If no confidence data, assume good quality
        return true
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
}
