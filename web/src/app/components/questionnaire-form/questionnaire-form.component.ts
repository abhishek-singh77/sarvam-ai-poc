import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'
import { FormsModule } from '@angular/forms'

@Component({
    selector: 'app-questionnaire-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './questionnaire-form.component.html',
    styleUrls: ['./questionnaire-form.component.css'],
})
export class QuestionnaireFormComponent {
    @Input() questions: any[] = []
    @Input() answers: { [key: string]: any } = {}
    @Output() retry = new EventEmitter<void>()
    @Output() submit = new EventEmitter<{ [key: string]: any }>()
    @Output() voice = new EventEmitter<any>()
}
