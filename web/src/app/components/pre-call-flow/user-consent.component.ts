import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface ConsentItem {
    icon: string
    title: string
    description: string
}

@Component({
    selector: 'app-user-consent',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './user-consent.component.html',
    styleUrls: ['./user-consent.component.css'],
})
export class UserConsentComponent {
    @Input() consentItems: ConsentItem[] = []
    @Input() userName: string = 'User'
    @Input() vcipId: string = '123456'
    @Input() isAgreed: boolean = false

    @Output() agreementChange = new EventEmitter<boolean>()
    @Output() proceed = new EventEmitter<void>()
    @Output() cancel = new EventEmitter<void>()

    onAgreementChange(agreed: boolean): void {
        this.isAgreed = agreed
        this.agreementChange.emit(agreed)
    }

    onProceed(): void {
        if (this.isAgreed) {
            this.proceed.emit()
        }
    }

    onCancel(): void {
        this.cancel.emit()
    }
}
