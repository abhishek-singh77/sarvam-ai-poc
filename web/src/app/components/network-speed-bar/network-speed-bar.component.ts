import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-network-speed-bar',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './network-speed-bar.component.html',
    styleUrls: ['./network-speed-bar.component.css'],
})
export class NetworkSpeedBarComponent {
    @Input() networkSpeedKbps?: number
    @Input() stats?: any
    @Output() info_click = new EventEmitter<void>()

    getNetworkStatus(): string {
        if (!this.networkSpeedKbps) return 'Unknown'

        if (this.networkSpeedKbps > 1000) return 'Excellent'
        if (this.networkSpeedKbps > 500) return 'Good'
        if (this.networkSpeedKbps > 100) return 'Fair'
        return 'Poor'
    }

    getNetworkColor(): string {
        const status = this.getNetworkStatus()
        switch (status) {
            case 'Excellent':
                return 'text-green-600'
            case 'Good':
                return 'text-blue-600'
            case 'Fair':
                return 'text-yellow-600'
            case 'Poor':
                return 'text-red-600'
            default:
                return 'text-gray-600'
        }
    }

    onInfoClick(): void {
        this.info_click.emit()
    }
}
