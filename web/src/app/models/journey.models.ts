/**
 * Journey Models - Generic and reusable journey tracking system
 */

export type JourneyStepType = 'pre_call' | 'in_call' | 'post_call'
export type JourneyStepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped'
export type JourneyOverallStatus = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface JourneyStep {
    id: string
    title: string
    type: JourneyStepType
    status: JourneyStepStatus
    data?: Record<string, any>
    timestamp?: string
    description?: string
    order?: number
    dependencies?: string[]
    metadata?: Record<string, any>
}

export interface JourneyData {
    preCallSteps: JourneyStep[]
    inCallSteps: JourneyStep[]
    postCallSteps: JourneyStep[]
    overallStatus: JourneyOverallStatus
    sessionId?: string
    startedAt?: string
    completedAt?: string
    metadata?: Record<string, any>
}

export interface JourneyConfig {
    sessionId?: string
    steps: JourneyStep[]
    autoSave?: boolean
    storageKey?: string
}

export interface JourneyProgress {
    totalSteps: number
    completedSteps: number
    inProgressSteps: number
    failedSteps: number
    pendingSteps: number
    percentage: number
}

export interface JourneyEvent {
    type: 'step_started' | 'step_completed' | 'step_failed' | 'step_skipped' | 'journey_completed' | 'journey_failed'
    stepId?: string
    timestamp: string
    data?: Record<string, any>
}

export interface JourneyValidationResult {
    isValid: boolean
    errors: string[]
    warnings: string[]
}
