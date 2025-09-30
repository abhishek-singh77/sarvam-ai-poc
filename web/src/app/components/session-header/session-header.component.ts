import { Component, EventEmitter, Input, Output } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-session-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './session-header.component.html',
    styleUrls: ['./session-header.component.css'],
})
export class SessionHeaderComponent {
    @Input() showLogo = true
    @Input() title: string | null = null
    @Input() subtitle: string | null = null
    @Output() end = new EventEmitter<void>()
}
