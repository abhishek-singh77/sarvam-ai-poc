import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-custom-spinner',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './custom-spinner.component.html',
    styleUrl: './custom-spinner.component.css',
})
export class CustomSpinnerComponent {
    @Input() size: number = 20
    @Input() color: string = '#1976d2'
    @Input() text: string = ''
}
