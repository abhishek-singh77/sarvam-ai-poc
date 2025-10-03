/**
 * VKYC Journey Service - Specific implementation for VKYC workflow
 */

import { Injectable } from '@angular/core'
import { BaseJourneyService } from './base-journey.service'
import { JourneyConfig, JourneyStep } from '../models/journey.models'

@Injectable({
    providedIn: 'root',
})
export class VkycJourneyService extends BaseJourneyService {
    private readonly VKYC_STORAGE_KEY = 'vkyc_journey_data'

    constructor() {
        const vkycSteps = [
            // Pre-call steps
            {
                id: 'health_check',
                title: 'Health Check',
                type: 'pre_call' as const,
                status: 'pending' as const,
                description: 'Network speed and device compatibility check',
                order: 1,
            },
            {
                id: 'consent',
                title: 'Consent & Permissions',
                type: 'pre_call' as const,
                status: 'pending' as const,
                description: 'Camera, microphone, and data processing consent',
                order: 2,
            },
            {
                id: 'instructions',
                title: 'Instructions',
                type: 'pre_call' as const,
                status: 'pending' as const,
                description: 'KYC process overview and guidelines',
                order: 3,
            },
            // In-call steps - Questionnaire moved to first position
            {
                id: 'questionnaire-1',
                title: 'Verification Questions',
                type: 'in_call' as const,
                status: 'pending' as const,
                description: 'Answer questions to verify your identity',
                order: 4,
            },
            {
                id: 'frame_capture-1',
                title: 'Selfie Capture',
                type: 'in_call' as const,
                status: 'pending' as const,
                description: 'Capture your selfie for identity verification',
                order: 5,
            },
            {
                id: 'frame_capture-2',
                title: 'Document Capture',
                type: 'in_call' as const,
                status: 'pending' as const,
                description: 'Capture your identity document (PAN/Aadhaar)',
                order: 6,
            },
            // Post-call steps
            {
                id: 'verification',
                title: 'Final Verification',
                type: 'post_call' as const,
                status: 'pending' as const,
                description: 'AI-powered identity verification',
                order: 7,
            },
            {
                id: 'completion',
                title: 'KYC Completion',
                type: 'post_call' as const,
                status: 'pending' as const,
                description: 'Process completion and result notification',
                order: 8,
            },
        ]

        super({
            storageKey: 'vkyc_journey_data',
            autoSave: true,
            steps: vkycSteps,
        })
    }

    /**
     * VKYC specific step update methods
     */
    updateHealthCheckData(data: Record<string, any>): void {
        this.updateStepStatus('health_check', 'completed', data)
    }

    updateConsentStatus(consented: boolean): void {
        this.updateStepStatus('consent', consented ? 'completed' : 'pending')
    }

    updateInstructionsStatus(completed: boolean): void {
        this.updateStepStatus(
            'instructions',
            completed ? 'completed' : 'pending'
        )
    }

    updateFrameCaptureStatus(
        stepId: string,
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
        captureData?: Record<string, any>
    ): void {
        this.updateStepStatus(stepId, status, captureData)
    }

    updateQuestionnaireStatus(
        stepId: string,
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
        questionnaireData?: Record<string, any>
    ): void {
        this.updateStepStatus(stepId, status, questionnaireData)
    }

    updateVerificationStatus(
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
        verificationData?: Record<string, any>
    ): void {
        this.updateStepStatus('verification', status, verificationData)
    }

    updateCompletionStatus(
        status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped',
        completionData?: Record<string, any>
    ): void {
        this.updateStepStatus('completion', status, completionData)
    }

    /**
     * Get steps by type
     */
    getStepsByType(type: 'pre_call' | 'in_call' | 'post_call'): JourneyStep[] {
        const data = this.journeyDataSubject.value
        if (!data) return []

        switch (type) {
            case 'pre_call':
                return data.preCallSteps
            case 'in_call':
                return data.inCallSteps
            case 'post_call':
                return data.postCallSteps
            default:
                return []
        }
    }

    /**
     * Get step by ID
     */
    getStepById(stepId: string): JourneyStep | null {
        const data = this.journeyDataSubject.value
        if (!data) return null

        const allSteps = [
            ...data.preCallSteps,
            ...data.inCallSteps,
            ...data.postCallSteps,
        ]

        return allSteps.find((step) => step.id === stepId) || null
    }

    /**
     * Check if step is completed
     */
    isStepCompleted(stepId: string): boolean {
        const step = this.getStepById(stepId)
        return step?.status === 'completed'
    }

    /**
     * Check if all pre-call steps are completed
     */
    arePreCallStepsCompleted(): boolean {
        const preCallSteps = this.getStepsByType('pre_call')
        return (
            preCallSteps.length > 0 &&
            preCallSteps.every((step) => step.status === 'completed')
        )
    }

    /**
     * Check if all in-call steps are completed
     */
    areInCallStepsCompleted(): boolean {
        const inCallSteps = this.getStepsByType('in_call')
        return (
            inCallSteps.length > 0 &&
            inCallSteps.every((step) => step.status === 'completed')
        )
    }

    /**
     * Check if all post-call steps are completed
     */
    arePostCallStepsCompleted(): boolean {
        const postCallSteps = this.getStepsByType('post_call')
        return (
            postCallSteps.length > 0 &&
            postCallSteps.every((step) => step.status === 'completed')
        )
    }

    /**
     * Get completion percentage for a specific step type
     */
    getCompletionPercentageByType(
        type: 'pre_call' | 'in_call' | 'post_call'
    ): number {
        const steps = this.getStepsByType(type)
        if (steps.length === 0) return 0

        const completedSteps = steps.filter(
            (step) => step.status === 'completed'
        ).length
        return Math.round((completedSteps / steps.length) * 100)
    }

    /**
     * Manually mark a step as completed (for backend API completions)
     */
    markStepCompleted(stepId: string, data?: Record<string, any>): void {
        console.log(`🎯 JOURNEY: Manually marking step ${stepId} as completed`)
        this.updateStepStatus(stepId, 'completed', data)
    }
}
