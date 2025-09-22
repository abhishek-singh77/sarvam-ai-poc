import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RoomCreateResponse } from '../../interfaces/room.interface'

@Component({
    selector: 'app-info-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './info-panel.component.html',
    styleUrls: ['./info-panel.component.css'],
})
export class InfoPanelComponent {
    @Input() roomData: RoomCreateResponse | null = null
    @Input() status: string = 'Ready'
    @Input() logs: string[] = []
    @Input() streamsActive: boolean = false

    getLogTimestamp(log: string): string {
        return log.split(' ')[0] + ' ' + log.split(' ')[1]
    }

    getLogMessage(log: string): string {
        return log.split(' ').slice(2).join(' ')
    }

    getStatusClass(): string {
        switch (this.status.toLowerCase()) {
            case 'ready':
                return 'bg-blue-100 text-blue-800'
            case 'room ready':
            case 'agent joined':
            case 'kyc running':
                return 'bg-green-100 text-green-800'
            case 'creating room':
            case 'joining agent':
            case 'starting kyc':
                return 'bg-yellow-100 text-yellow-800'
            default:
                if (this.status.toLowerCase().includes('error')) {
                    return 'bg-red-100 text-red-800'
                }
                return 'bg-gray-100 text-gray-800'
        }
    }
}
