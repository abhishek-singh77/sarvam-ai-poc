/**
 * Journey Utils Service - Common journey operations and utilities
 */

import { Injectable } from '@angular/core'
import {
    JourneyStep,
    JourneyStepStatus,
    JourneyStepType,
} from '../models/journey.models'

@Injectable({
    providedIn: 'root',
})
export class JourneyUtilsService {
    /**
     * Get step icon based on status
     */
    getStepIcon(status: JourneyStepStatus): string {
        switch (status) {
            case 'completed':
                return '✅'
            case 'in_progress':
                return '🔄'
            case 'failed':
                return '❌'
            case 'skipped':
                return '⏭️'
            default:
                return '⏳'
        }
    }

    /**
     * Get step status text
     */
    getStepStatusText(status: JourneyStepStatus): string {
        switch (status) {
            case 'completed':
                return 'Completed'
            case 'in_progress':
                return 'In Progress'
            case 'failed':
                return 'Failed'
            case 'skipped':
                return 'Skipped'
            default:
                return 'Pending'
        }
    }

    /**
     * Get step status CSS classes
     */
    getStepStatusClass(status: JourneyStepStatus): string {
        switch (status) {
            case 'completed':
                return 'text-green-600 bg-green-50 border-green-200'
            case 'in_progress':
                return 'text-blue-600 bg-blue-50 border-blue-200'
            case 'failed':
                return 'text-red-600 bg-red-50 border-red-200'
            case 'skipped':
                return 'text-gray-500 bg-gray-50 border-gray-200'
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200'
        }
    }

    /**
     * Get step type color
     */
    getStepTypeColor(type: JourneyStepType): string {
        switch (type) {
            case 'pre_call':
                return 'bg-blue-500'
            case 'in_call':
                return 'bg-green-500'
            case 'post_call':
                return 'bg-purple-500'
            default:
                return 'bg-gray-500'
        }
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp?: string): string {
        if (!timestamp) return ''

        try {
            const date = new Date(timestamp)
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
            })
        } catch {
            return timestamp
        }
    }

    /**
     * Get step data summary
     */
    getStepDataSummary(step: JourneyStep): string {
        if (!step.data) return ''

        switch (step.type) {
            case 'pre_call':
                if (step.id === 'health_check') {
                    return `Network: ${
                        step.data['networkSpeed'] || 'N/A'
                    }, Location: ${step.data['locationData']?.city || 'N/A'}`
                }
                return 'Pre-call data collected'
            case 'in_call':
                if (step.id.includes('frame_capture')) {
                    return `Type: ${
                        step.data['captureType'] || 'Unknown'
                    }, Quality: ${step.data['qualityScore'] || 'N/A'}`
                }
                if (step.id.includes('questionnaire')) {
                    return `Questions: ${step.data['questionsAnswered'] || 0}/${
                        step.data['totalQuestions'] || 0
                    }`
                }
                return 'In-call data collected'
            default:
                return 'Data collected'
        }
    }

    /**
     * Validate step data
     */
    validateStepData(step: JourneyStep): {
        isValid: boolean
        errors: string[]
    } {
        const errors: string[] = []

        if (!step.id) {
            errors.push('Step ID is required')
        }

        if (!step.title) {
            errors.push('Step title is required')
        }

        if (!step.type) {
            errors.push('Step type is required')
        }

        if (!step.status) {
            errors.push('Step status is required')
        }

        // Validate step type
        if (
            step.type &&
            !['pre_call', 'in_call', 'post_call'].includes(step.type)
        ) {
            errors.push('Invalid step type')
        }

        // Validate step status
        if (
            step.status &&
            ![
                'pending',
                'in_progress',
                'completed',
                'failed',
                'skipped',
            ].includes(step.status)
        ) {
            errors.push('Invalid step status')
        }

        return {
            isValid: errors.length === 0,
            errors,
        }
    }

    /**
     * Sort steps by order
     */
    sortStepsByOrder(steps: JourneyStep[]): JourneyStep[] {
        return [...steps].sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    /**
     * Get step progress percentage
     */
    getStepProgressPercentage(step: JourneyStep): number {
        switch (step.status) {
            case 'completed':
                return 100
            case 'in_progress':
                return 50
            case 'failed':
                return 0
            case 'skipped':
                return 100
            default:
                return 0
        }
    }

    /**
     * Check if step is actionable
     */
    isStepActionable(step: JourneyStep): boolean {
        return step.status === 'pending' || step.status === 'in_progress'
    }

    /**
     * Get step priority (for ordering)
     */
    getStepPriority(step: JourneyStep): number {
        const typePriority: Record<JourneyStepType, number> = {
            pre_call: 1,
            in_call: 2,
            post_call: 3,
        }

        return (typePriority[step.type] || 0) * 1000 + (step.order || 0)
    }

    /**
     * Generate step ID from title
     */
    generateStepId(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .trim()
    }

    /**
     * Check if step has dependencies
     */
    hasDependencies(step: JourneyStep): boolean {
        return !!(step.dependencies && step.dependencies.length > 0)
    }

    /**
     * Get step duration (if timestamps available)
     */
    getStepDuration(step: JourneyStep): number | null {
        if (!step.timestamp) return null

        try {
            const startTime = new Date(step.timestamp).getTime()
            const endTime = new Date().getTime()
            return Math.round((endTime - startTime) / 1000) // Duration in seconds
        } catch {
            return null
        }
    }

    /**
     * Format duration for display
     */
    formatDuration(seconds: number): string {
        if (seconds < 60) {
            return `${seconds}s`
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return `${minutes}m ${remainingSeconds}s`
        } else {
            const hours = Math.floor(seconds / 3600)
            const minutes = Math.floor((seconds % 3600) / 60)
            return `${hours}h ${minutes}m`
        }
    }
}
