/**
 * Base Journey Service - Generic and reusable journey tracking
 */

import { Injectable, OnDestroy } from '@angular/core'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map, takeUntil } from 'rxjs/operators'
import {
    JourneyData,
    JourneyStep,
    JourneyStepStatus,
    JourneyStepType,
    JourneyConfig,
    JourneyProgress,
    JourneyEvent,
    JourneyValidationResult,
    JourneyOverallStatus,
} from '../models/journey.models'

@Injectable({
    providedIn: 'root',
})
export abstract class BaseJourneyService implements OnDestroy {
    protected journeyDataSubject = new BehaviorSubject<JourneyData | null>(null)
    protected eventsSubject = new Subject<JourneyEvent>()
    protected destroy$ = new Subject<void>()

    public readonly journeyData$ = this.journeyDataSubject.asObservable()
    public readonly events$ = this.eventsSubject.asObservable()

    protected readonly storageKey: string
    protected readonly autoSave: boolean

    constructor(config: JourneyConfig) {
        this.storageKey = config.storageKey || 'journey_data'
        this.autoSave = config.autoSave !== false

        this.initializeJourney(config)
    }

    ngOnDestroy(): void {
        this.destroy$.next()
        this.destroy$.complete()
    }

    /**
     * Initialize journey with configuration
     */
    protected initializeJourney(config: JourneyConfig): void {
        const journeyData = this.createJourneyData(config)
        this.journeyDataSubject.next(journeyData)

        if (this.autoSave) {
            this.saveToStorage()
        }

        this.emitEvent({
            type: 'step_started',
            timestamp: new Date().toISOString(),
            data: { sessionId: config.sessionId },
        })
    }

    /**
     * Create journey data from configuration
     */
    protected createJourneyData(config: JourneyConfig): JourneyData {
        const steps = config.steps || []

        return {
            preCallSteps: steps.filter(
                (step: JourneyStep) => step.type === 'pre_call'
            ),
            inCallSteps: steps.filter(
                (step: JourneyStep) => step.type === 'in_call'
            ),
            postCallSteps: steps.filter(
                (step: JourneyStep) => step.type === 'post_call'
            ),
            overallStatus: 'pending',
            sessionId: config.sessionId,
            startedAt: new Date().toISOString(),
            metadata: {},
        }
    }

    /**
     * Update step status
     */
    updateStepStatus(
        stepId: string,
        status: JourneyStepStatus,
        data?: Record<string, any>
    ): void {
        const currentData = this.journeyDataSubject.value
        if (!currentData) {
            console.warn('🎯 JOURNEY: No journey data available')
            return
        }

        const updatedData = { ...currentData }
        const step = this.findStep(updatedData, stepId)

        if (!step) {
            console.warn(`🎯 JOURNEY: Step ${stepId} not found`)
            return
        }

        const previousStatus = step.status
        step.status = status
        step.timestamp = new Date().toISOString()

        if (data) {
            step.data = { ...step.data, ...data }
        }

        // Update overall status
        updatedData.overallStatus = this.calculateOverallStatus(updatedData)

        this.journeyDataSubject.next(updatedData)

        if (this.autoSave) {
            this.saveToStorage()
        }

        // Emit event
        this.emitEvent({
            type: this.getEventTypeFromStatus(status),
            stepId,
            timestamp: step.timestamp,
            data: { previousStatus, ...data },
        })
    }

    /**
     * Get journey progress
     */
    getProgress(): JourneyProgress {
        const data = this.journeyDataSubject.value
        if (!data) {
            return {
                totalSteps: 0,
                completedSteps: 0,
                inProgressSteps: 0,
                failedSteps: 0,
                pendingSteps: 0,
                percentage: 0,
            }
        }

        const allSteps = this.getAllSteps(data)
        const totalSteps = allSteps.length
        const completedSteps = allSteps.filter(
            (s) => s.status === 'completed'
        ).length
        const inProgressSteps = allSteps.filter(
            (s) => s.status === 'in_progress'
        ).length
        const failedSteps = allSteps.filter((s) => s.status === 'failed').length
        const pendingSteps = allSteps.filter(
            (s) => s.status === 'pending'
        ).length
        const percentage =
            totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

        return {
            totalSteps,
            completedSteps,
            inProgressSteps,
            failedSteps,
            pendingSteps,
            percentage,
        }
    }

    /**
     * Get current step
     */
    getCurrentStep(): JourneyStep | null {
        const data = this.journeyDataSubject.value
        if (!data) return null

        return (
            this.getAllSteps(data).find(
                (step) => step.status === 'in_progress'
            ) || null
        )
    }

    /**
     * Get next pending step
     */
    getNextStep(): JourneyStep | null {
        const data = this.journeyDataSubject.value
        if (!data) return null

        return (
            this.getAllSteps(data).find((step) => step.status === 'pending') ||
            null
        )
    }

    /**
     * Validate journey data
     */
    validateJourney(): JourneyValidationResult {
        const data = this.journeyDataSubject.value
        const errors: string[] = []
        const warnings: string[] = []

        if (!data) {
            errors.push('No journey data available')
            return { isValid: false, errors, warnings }
        }

        const allSteps = this.getAllSteps(data)

        // Check for duplicate step IDs
        const stepIds = allSteps.map((s) => s.id)
        const duplicateIds = stepIds.filter(
            (id, index) => stepIds.indexOf(id) !== index
        )
        if (duplicateIds.length > 0) {
            errors.push(`Duplicate step IDs found: ${duplicateIds.join(', ')}`)
        }

        // Check for missing required fields
        allSteps.forEach((step) => {
            if (!step.id) errors.push(`Step missing ID`)
            if (!step.title) errors.push(`Step ${step.id} missing title`)
            if (!step.type) errors.push(`Step ${step.id} missing type`)
            if (!step.status) errors.push(`Step ${step.id} missing status`)
        })

        // Check for dependency cycles
        const dependencyErrors = this.validateDependencies(allSteps)
        errors.push(...dependencyErrors)

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        }
    }

    /**
     * Reset journey
     */
    reset(): void {
        this.journeyDataSubject.next(null)
        if (this.autoSave) {
            this.clearStorage()
        }
    }

    /**
     * Clear storage
     */
    clearStorage(): void {
        try {
            sessionStorage.removeItem(this.storageKey)
            console.log('🎯 JOURNEY: Storage cleared')
        } catch (error) {
            console.error('🎯 JOURNEY: Failed to clear storage:', error)
        }
    }

    // Protected helper methods
    protected findStep(data: JourneyData, stepId: string): JourneyStep | null {
        const allSteps = this.getAllSteps(data)
        return allSteps.find((step) => step.id === stepId) || null
    }

    protected getAllSteps(data: JourneyData): JourneyStep[] {
        return [
            ...data.preCallSteps,
            ...data.inCallSteps,
            ...data.postCallSteps,
        ]
    }

    protected calculateOverallStatus(data: JourneyData): JourneyOverallStatus {
        const allSteps = this.getAllSteps(data)

        if (allSteps.length === 0) return 'pending'

        const hasInProgress = allSteps.some(
            (step) => step.status === 'in_progress'
        )
        const hasFailed = allSteps.some((step) => step.status === 'failed')
        const allCompleted = allSteps.every(
            (step) => step.status === 'completed'
        )

        if (hasFailed) return 'failed'
        if (allCompleted) return 'completed'
        if (hasInProgress) return 'in_progress'
        return 'pending'
    }

    protected getEventTypeFromStatus(
        status: JourneyStepStatus
    ): JourneyEvent['type'] {
        switch (status) {
            case 'in_progress':
                return 'step_started'
            case 'completed':
                return 'step_completed'
            case 'failed':
                return 'step_failed'
            case 'skipped':
                return 'step_skipped'
            default:
                return 'step_started'
        }
    }

    protected validateDependencies(steps: JourneyStep[]): string[] {
        const errors: string[] = []
        const stepIds = new Set(steps.map((s) => s.id))

        steps.forEach((step) => {
            if (step.dependencies) {
                step.dependencies.forEach((depId: string) => {
                    if (!stepIds.has(depId)) {
                        errors.push(
                            `Step ${step.id} has invalid dependency: ${depId}`
                        )
                    }
                })
            }
        })

        return errors
    }

    protected emitEvent(event: JourneyEvent): void {
        this.eventsSubject.next(event)
    }

    protected loadFromStorage(): void {
        try {
            const stored = sessionStorage.getItem(this.storageKey)
            if (stored) {
                const journeyData = JSON.parse(stored) as JourneyData
                this.journeyDataSubject.next(journeyData)
                console.log('🎯 JOURNEY: Loaded journey data from storage')
            }
        } catch (error) {
            console.error('🎯 JOURNEY: Failed to load from storage:', error)
        }
    }

    protected saveToStorage(): void {
        try {
            const currentData = this.journeyDataSubject.value
            if (currentData) {
                sessionStorage.setItem(
                    this.storageKey,
                    JSON.stringify(currentData)
                )
                console.log('🎯 JOURNEY: Saved journey data to storage')
            }
        } catch (error) {
            console.error('🎯 JOURNEY: Failed to save to storage:', error)
        }
    }
}
