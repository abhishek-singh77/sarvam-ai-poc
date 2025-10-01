import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SessionHeaderComponent } from '../session-header/session-header.component'
import { UserInstructionComponent } from '../pre-call-flow/user-instruction.component'
import { UserConsentComponent } from '../pre-call-flow/user-consent.component'
import { HealthCheckComponent } from '../pre-call-flow/health-check.component'
import { DetectionOverlaysComponent } from '../detection-overlays/detection-overlays.component'
import { QuestionnaireFormComponent } from '../questionnaire-form/questionnaire-form.component'
import { AgentJoinPopupComponent } from '../agent-join-popup/agent-join-popup.component'
import { MeetingPanelComponent } from '../meeting-panel/meeting-panel.component'

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
    showAgentJoinPopup?: boolean
    agentStreamReady?: boolean
    agentLoadingStep?: number
    roomId?: string
    workflowSteps?: WorkflowStep[]
}

export interface WorkflowStep {
    id: string
    title: string
    type: string
    status: 'pending' | 'active' | 'completed' | 'skipped' | 'error'
    subActionStep?: 'pre' | 'in_call' | 'post'
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
        AgentJoinPopupComponent,
        MeetingPanelComponent,
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
    @Output() healthCheckProceed = new EventEmitter<{
        locationData: any
        networkSpeed: any
        isVpnDetected: boolean
    }>()
    @Output() chatToggle = new EventEmitter<void>()
    @Output() cameraToggle = new EventEmitter<void>()
    @Output() micToggle = new EventEmitter<void>()
    @Output() capturePhoto = new EventEmitter<void>()

    // Mic mute state
    isMicMuted = false
    @Output() healthCheckCancel = new EventEmitter<void>()
    @Output() voiceRecognition = new EventEmitter<any>()
    @Output() questionnaireRetry = new EventEmitter<void>()
    @Output() questionnaireSubmit = new EventEmitter<void>()
    @Output() startCall = new EventEmitter<void>()

    // Meeting panel event handlers
    onStreamsActive(active: boolean): void {
        console.log('🎯 LAYOUT: Streams active:', active)
        // Note: Face detection is now handled directly in the vkyc-session component
        // No need to emit startCall here as it would cause infinite loops
    }

    onEndCall(): void {
        console.log('🎯 LAYOUT: End call requested')
        this.endSession.emit()
    }

    onChatToggle(): void {
        console.log('🎯 LAYOUT: Chat toggle requested')
        this.chatToggle.emit()
    }

    onCameraToggle(): void {
        console.log('🎯 LAYOUT: Camera toggle requested')
        this.cameraToggle.emit()
    }

    onMicToggle(): void {
        console.log('🎯 LAYOUT: Mic toggle requested')
        this.isMicMuted = !this.isMicMuted
        this.micToggle.emit()
    }

    onCapturePhoto(): void {
        console.log('🎯 LAYOUT: Capture photo requested')
        this.capturePhoto.emit()
    }

    // Workflow step helper methods
    getStepStatusColor(step: WorkflowStep): string {
        switch (step.status) {
            case 'completed':
                return 'bg-green-500'
            case 'active':
                return 'bg-yellow-500'
            case 'pending':
            case 'skipped':
            case 'error':
            default:
                return 'bg-gray-400'
        }
    }

    getStepTextColor(step: WorkflowStep): string {
        switch (step.status) {
            case 'completed':
                return 'text-green-800 bg-green-100'
            case 'active':
                return 'text-yellow-800 bg-yellow-100'
            case 'pending':
            case 'skipped':
            case 'error':
            default:
                return 'text-gray-600 bg-gray-100'
        }
    }

    getStepIcon(step: WorkflowStep): string {
        switch (step.type) {
            case 'FRAME_CAPTURE':
                return 'M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z'
            case 'QUESTIONNAIRE':
                return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
            case 'GEO_TAGGING':
                return 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z'
            case 'USER_INSTRUCTION':
                return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
            default:
                return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        }
    }

    getInCallSteps(): WorkflowStep[] {
        if (!this.state?.workflowSteps) return []
        return this.state.workflowSteps.filter(
            (step) => step.subActionStep === 'in_call'
        )
    }

    getCompletedStepsCount(): number {
        if (!this.state?.workflowSteps) return 0
        return this.state.workflowSteps.filter(
            (step) => step.status === 'completed'
        ).length
    }

    getTotalStepsCount(): number {
        if (!this.state?.workflowSteps) return 0
        return this.state.workflowSteps.length
    }

    getProgressPercentage(): number {
        const completed = this.getCompletedStepsCount()
        const total = this.getTotalStepsCount()
        return total > 0 ? Math.round((completed / total) * 100) : 0
    }

    hasWorkflowSteps(): boolean {
        return !!(
            this.state?.workflowSteps && this.state.workflowSteps.length > 0
        )
    }
}
