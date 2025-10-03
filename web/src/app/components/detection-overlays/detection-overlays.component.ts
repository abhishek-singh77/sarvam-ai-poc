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
export class DetectionOverlaysComponent implements OnInit, OnDestroy {
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
    @Output() autoCaptureTriggered = new EventEmitter<void>()

    // Countdown state
    countdown: number | null = null
    private countdownInterval: number | null = null
    private lastSteadyTime: number = 0
    private readonly STEADY_DURATION_MS = 500 // 0.5 second of steady detection before countdown (reduced for better UX)
    private readonly COUNTDOWN_DURATION = 3 // 3 second countdown
    private readonly MIN_CONFIDENCE_THRESHOLD = 0.6 // Minimum confidence for auto-capture (increased for better quality)

    ngOnInit() {
        // Start monitoring for steady detection
        this.startSteadyDetectionMonitoring()
    }

    ngOnDestroy() {
        this.clearCountdown()
    }

    private startSteadyDetectionMonitoring() {
        setInterval(() => {
            const isSteady = this.isDetectionSteady()

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
                    if (this.countdown === null) {
                        console.log(
                            '🎯 DETECTION: Starting auto-capture countdown'
                        )
                        this.startCountdown()
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

            // For auto-capture, we only need good confidence, not necessarily steady
            // This makes auto-capture more responsive
            if (
                hasGoodConfidence &&
                confidence >= this.MIN_CONFIDENCE_THRESHOLD
            ) {
                if (this.lastSteadyTime === 0) {
                    this.lastSteadyTime = currentTime
                    console.log(
                        `🎯 DETECTION: Face detected with good confidence=${confidence.toFixed(
                            2
                        )}, starting steady timer`
                    )
                }
                return (
                    currentTime - this.lastSteadyTime >= this.STEADY_DURATION_MS
                )
            } else {
                if (this.lastSteadyTime !== 0) {
                    console.log(
                        `🎯 DETECTION: Face confidence too low=${confidence.toFixed(
                            2
                        )}, resetting timer`
                    )
                }
                this.lastSteadyTime = 0
            }
        } else if (this.captureType === 'DOCUMENT_CAPTURE') {
            const hasGoodConfidence = this.hasGoodConfidence()
            const confidence = this.documentDetectionResult?.confidence || 0

            // For auto-capture, we only need good confidence, not necessarily steady
            if (
                hasGoodConfidence &&
                confidence >= this.MIN_CONFIDENCE_THRESHOLD
            ) {
                if (this.lastSteadyTime === 0) {
                    this.lastSteadyTime = currentTime
                    console.log(
                        `🎯 DETECTION: Document detected with good confidence=${confidence.toFixed(
                            2
                        )}, starting steady timer`
                    )
                }
                return (
                    currentTime - this.lastSteadyTime >= this.STEADY_DURATION_MS
                )
            } else {
                if (this.lastSteadyTime !== 0) {
                    console.log(
                        `🎯 DETECTION: Document confidence too low=${confidence.toFixed(
                            2
                        )}, resetting timer`
                    )
                }
                this.lastSteadyTime = 0
            }
        }
        return false
    }

    private hasGoodConfidence(): boolean {
        // Check confidence levels for better auto-capture quality
        if (this.captureType === 'FACE_CAPTURE') {
            const faceResult =
                this.multipleFaceDetectionResult?.primaryFace ||
                this.detectionResult
            if (faceResult?.confidence) {
                return faceResult.confidence >= this.MIN_CONFIDENCE_THRESHOLD
            }
        } else if (this.captureType === 'DOCUMENT_CAPTURE') {
            if (this.documentDetectionResult?.confidence) {
                return (
                    this.documentDetectionResult.confidence >=
                    this.MIN_CONFIDENCE_THRESHOLD
                )
            }
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
