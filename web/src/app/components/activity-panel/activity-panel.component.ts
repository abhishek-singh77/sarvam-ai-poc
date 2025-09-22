import { Component, Input } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-activity-panel',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './activity-panel.component.html',
    styleUrls: ['./activity-panel.component.css'],
})
export class ActivityPanelComponent {
    @Input() callDetails: any = null
    @Input() logs: string[] = []
    @Input() participants: any[] = []

    getLogTimestamp(log: string): string {
        return log.split(' ')[0] + ' ' + log.split(' ')[1]
    }

    getLogMessage(log: string): string {
        return log.split(' ').slice(2).join(' ')
    }

    getParticipantStatus(participant: any): string {
        if (participant.isLocal) return 'You'
        if (participant.isAgent) return 'AI Agent'
        return 'Customer'
    }

    getParticipantStatusColor(participant: any): string {
        if (participant.isLocal) return 'bg-blue-100 text-blue-800'
        if (participant.isAgent) return 'bg-green-100 text-green-800'
        return 'bg-gray-100 text-gray-800'
    }
}
