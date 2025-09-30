import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SessionHeaderComponent } from '../session-header/session-header.component'
import { UserInstructionComponent } from '../pre-call-flow/user-instruction.component'
import { UserConsentComponent } from '../pre-call-flow/user-consent.component'
import { HealthCheckComponent } from '../pre-call-flow/health-check.component'
import { DetectionOverlaysComponent } from '../detection-overlays/detection-overlays.component'
import { QuestionnaireFormComponent } from '../questionnaire-form/questionnaire-form.component'

export interface VkycLayoutState {
    phase: 'pre' | 'in_call' | 'post'
    currentStep?: any
    showPreCallFlow: boolean
    preCallStep?: 'instructions' | 'consent' | 'health-check' | 'complete'
    canStartCall?: boolean
    detectionResult?: any
    documentDetectionResult?: any
    captureType?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE' | null
    questions?: any[]
    answers?: { [key: string]: any }
}

@Component({
    selector: 'app-vkyc-session-layout',
    standalone: true,
    imports: [
        CommonModule,
        SessionHeaderComponent,
        UserInstructionComponent,
        UserConsentComponent,
        HealthCheckComponent,
        DetectionOverlaysComponent,
        QuestionnaireFormComponent,
    ],
    templateUrl: './vkyc-session-layout.component.html',
    styleUrls: ['./vkyc-session-layout.component.css'],
})
export class VkycSessionLayoutComponent {
    @Input() state: VkycLayoutState | null = null
    @Input() preCallFlowService: any = null

    @Output() endSession = new EventEmitter<void>()
    @Output() instructionsProceed = new EventEmitter<void>()
    @Output() instructionsReschedule = new EventEmitter<void>()
    @Output() instructionsCancel = new EventEmitter<void>()
    @Output() consentProceed = new EventEmitter<void>()
    @Output() consentCancel = new EventEmitter<void>()
    @Output() healthCheckProceed = new EventEmitter<void>()
    @Output() healthCheckCancel = new EventEmitter<void>()
    @Output() voiceRecognition = new EventEmitter<any>()
    @Output() questionnaireRetry = new EventEmitter<void>()
    @Output() questionnaireSubmit = new EventEmitter<void>()
    @Output() startCall = new EventEmitter<void>()
}
