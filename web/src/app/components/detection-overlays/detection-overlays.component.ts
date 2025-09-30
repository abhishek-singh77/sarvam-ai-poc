import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import {
    DetectionResult,
    DocumentDetectionResult,
} from '../../services/detection.service'

@Component({
    selector: 'app-detection-overlays',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './detection-overlays.component.html',
    styleUrls: ['./detection-overlays.component.css'],
})
export class DetectionOverlaysComponent {
    @Input() detectionResult: DetectionResult | null = null
    @Input() documentDetectionResult: DocumentDetectionResult | null = null
    @Input() captureType: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE' | null = null
}
