import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface UserInstruction {
    title: string
    description: string
    icon: string
    status: 'pending' | 'completed'
}

@Component({
    selector: 'app-user-instruction',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './user-instruction.component.html',
    styleUrls: ['./user-instruction.component.css'],
})
export class UserInstructionComponent {
    @Input() instructions: UserInstruction[] = []
    @Input() title: string = 'Welcome to Video KYC Process'
    @Input() subtitle: string = 'Video KYC Guidelines'
    @Input() showReschedule: boolean = true
    @Input() proceedButtonText: string = 'Proceed to Consent'
    @Input() canProceed: boolean = true

    @Output() proceed = new EventEmitter<void>()
    @Output() reschedule = new EventEmitter<void>()
    @Output() cancel = new EventEmitter<void>()

    onProceed(): void {
        this.proceed.emit()
    }

    onReschedule(): void {
        this.reschedule.emit()
    }

    onCancel(): void {
        this.cancel.emit()
    }
}
