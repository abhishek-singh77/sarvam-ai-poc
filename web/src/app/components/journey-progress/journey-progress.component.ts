import { Component, Input, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { Subscription } from 'rxjs'
import {
    JourneyData,
    JourneyStep,
    JourneyProgress,
} from '../../models/journey.models'
import { VkycJourneyService } from '../../services/vkyc-journey.service'
import { JourneyUtilsService } from '../../services/journey-utils.service'
import {
    AccordionComponent,
    AccordionItem,
} from '../accordion/accordion.component'

@Component({
    selector: 'app-journey-progress',
    standalone: true,
    imports: [CommonModule, AccordionComponent],
    templateUrl: './journey-progress.component.html',
    styleUrls: ['./journey-progress.component.css'],
})
export class JourneyProgressComponent implements OnInit, OnDestroy {
    @Input() showDetails: boolean = true
    @Input() showProgressBar: boolean = true
    @Input() showTimestamps: boolean = true
    @Input() compactMode: boolean = false

    journeyData: JourneyData | null = null
    progress: JourneyProgress | null = null
    private subscriptions = new Subscription()

    // Accordion state management
    expandedSteps: { [key: string]: boolean } = {}

    constructor(
        private journeyService: VkycJourneyService,
        private utils: JourneyUtilsService
    ) {}

    ngOnInit(): void {
        this.subscriptions.add(
            this.journeyService.journeyData$.subscribe((data) => {
                this.journeyData = data
            })
        )

        this.subscriptions.add(
            this.journeyService.events$.subscribe((event) => {
                this.progress = this.journeyService.getProgress()
            })
        )

        // Initialize progress
        this.progress = this.journeyService.getProgress()
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe()
    }

    getStepIcon(step: JourneyStep): string {
        return this.utils.getStepIcon(step.status)
    }

    getStepStatusText(step: JourneyStep): string {
        return this.utils.getStepStatusText(step.status)
    }

    getStepStatusClass(step: JourneyStep): string {
        return this.utils.getStepStatusClass(step.status)
    }

    getOverallProgress(): number {
        return this.progress?.percentage || 0
    }

    getCompletedStepsCount(): number {
        return this.progress?.completedSteps || 0
    }

    getTotalStepsCount(): number {
        return this.progress?.totalSteps || 0
    }

    formatTimestamp(timestamp?: string): string {
        return this.utils.formatTimestamp(timestamp)
    }

    getStepDataSummary(step: JourneyStep): string {
        return this.utils.getStepDataSummary(step)
    }

    getCompletedPreCallStepsCount(): number {
        if (!this.journeyData) return 0
        return this.journeyData.preCallSteps.filter(
            (step) => step.status === 'completed'
        ).length
    }

    getCompletedInCallStepsCount(): number {
        if (!this.journeyData) return 0
        return this.journeyData.inCallSteps.filter(
            (step) => step.status === 'completed'
        ).length
    }

    // Accordion functionality
    toggleStepDetails(section: string, index: number): void {
        const key = `${section}-${index}`
        this.expandedSteps[key] = !this.expandedSteps[key]
    }

    isStepExpanded(section: string, index: number): boolean {
        const key = `${section}-${index}`
        return this.expandedSteps[key] || false
    }

    // Convert journey steps to accordion items
    getPreCallAccordionItems(): AccordionItem[] {
        if (!this.journeyData) return []

        return this.journeyData.preCallSteps.map((step, index) => ({
            id: step.id || `preCall-${index}`,
            title: step.title,
            description: step.description,
            status: step.status,
            timestamp: step.timestamp,
            data: this.getStepDetails(step),
            expanded: this.isStepExpanded('preCall', index),
            disabled: false,
        }))
    }

    getInCallAccordionItems(): AccordionItem[] {
        if (!this.journeyData) return []

        return this.journeyData.inCallSteps.map((step, index) => ({
            id: step.id || `inCall-${index}`,
            title: step.title,
            description: step.description,
            status: step.status,
            timestamp: step.timestamp,
            data: this.getStepDetails(step),
            expanded: this.isStepExpanded('inCall', index),
            disabled: false,
        }))
    }

    getPostCallAccordionItems(): AccordionItem[] {
        if (!this.journeyData) return []

        return this.journeyData.postCallSteps.map((step, index) => ({
            id: step.id || `postCall-${index}`,
            title: step.title,
            description: step.description,
            status: step.status,
            timestamp: step.timestamp,
            data: this.getStepDetails(step),
            expanded: this.isStepExpanded('postCall', index),
            disabled: false,
        }))
    }

    private getStepDetails(step: JourneyStep): any {
        const details: any = {}

        if (step.data) {
            details.data = step.data

            // Extract specific data types from the generic data object
            if (step.data['healthCheckData']) {
                details.healthCheck = {
                    networkSpeed: step.data['healthCheckData'].networkSpeed,
                    location: step.data['healthCheckData'].location,
                    vpnDetected: step.data['healthCheckData'].vpnDetected,
                }
            }

            if (step.data['consentData']) {
                details.consent = step.data['consentData']
            }

            if (step.data['captureData']) {
                details.capture = {
                    imageCaptured: !!step.data['captureData'].imageData,
                    quality: step.data['captureData'].quality,
                    timestamp: step.data['captureData'].timestamp,
                }
            }

            if (step.data['questionnaireData']) {
                details.questionnaire = {
                    answersCount:
                        step.data['questionnaireData'].answers?.length || 0,
                    completedAt: step.data['questionnaireData'].completedAt,
                }
            }
        }

        return details
    }

    onAccordionItemToggled(event: {
        item: AccordionItem
        expanded: boolean
    }): void {
        const { item, expanded } = event

        // Update the expanded state in our local state
        if (item.id.startsWith('preCall-')) {
            const index = parseInt(item.id.split('-')[1])
            this.expandedSteps[`preCall-${index}`] = expanded
        } else if (item.id.startsWith('inCall-')) {
            const index = parseInt(item.id.split('-')[1])
            this.expandedSteps[`inCall-${index}`] = expanded
        } else if (item.id.startsWith('postCall-')) {
            const index = parseInt(item.id.split('-')[1])
            this.expandedSteps[`postCall-${index}`] = expanded
        }
    }
}
