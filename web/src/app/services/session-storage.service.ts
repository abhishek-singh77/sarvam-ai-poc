import { Injectable } from '@angular/core'

export interface SessionData {
    roomId: string
    sessionId: string
    agentToken: string
    agentParticipantId: string
    clientToken: string
    participantId: string
    timestamp: number
}

export interface CompletedSteps {
    instructions: boolean
    consent: boolean
    healthCheck: boolean
    timestamp: number
}

export interface WorkflowConfig {
    request_params: string[]
    actionables: any[]
    additional_validations: any[]
    show_steps: boolean
    show_skipped_steps: boolean
    request_status_invocations: any
}

export interface StepData {
    stepId: string
    stepType: string
    data: any
    timestamp: number
    success: boolean
}

@Injectable({
    providedIn: 'root',
})
export class SessionStorageService {
    private readonly SESSION_KEY = 'kyc_session_data'
    private readonly STEPS_KEY = 'kyc_completed_steps'
    private readonly WORKFLOW_KEY = 'kyc_workflow_config'
    private readonly STEP_DATA_KEY = 'kyc_step_data'

    // Session Data Management
    saveSessionData(data: SessionData): void {
        try {
            sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(data))
            console.log('🎯 SESSION-STORAGE: Saved session data', data)
        } catch (error) {
            console.error('Failed to save session data:', error)
        }
    }

    getSessionData(): SessionData | null {
        try {
            const data = sessionStorage.getItem(this.SESSION_KEY)
            if (data) {
                const parsed = JSON.parse(data) as SessionData
                // Check if session is not too old (24 hours)
                const isExpired =
                    Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000
                if (isExpired) {
                    this.clearSessionData()
                    return null
                }
                console.log(
                    '🎯 SESSION-STORAGE: Retrieved session data',
                    parsed
                )
                return parsed
            }
        } catch (error) {
            console.error('Failed to get session data:', error)
        }
        return null
    }

    clearSessionData(): void {
        try {
            sessionStorage.removeItem(this.SESSION_KEY)
            console.log('🎯 SESSION-STORAGE: Cleared session data')
        } catch (error) {
            console.error('Failed to clear session data:', error)
        }
    }

    // Completed Steps Management
    saveCompletedSteps(steps: CompletedSteps): void {
        try {
            sessionStorage.setItem(this.STEPS_KEY, JSON.stringify(steps))
            console.log('🎯 SESSION-STORAGE: Saved completed steps', steps)
        } catch (error) {
            console.error('Failed to save completed steps:', error)
        }
    }

    getCompletedSteps(): CompletedSteps | null {
        try {
            const data = sessionStorage.getItem(this.STEPS_KEY)
            if (data) {
                const parsed = JSON.parse(data) as CompletedSteps
                // Check if steps are not too old (2 hours)
                const isExpired =
                    Date.now() - parsed.timestamp > 2 * 60 * 60 * 1000
                if (isExpired) {
                    this.clearCompletedSteps()
                    return null
                }
                console.log(
                    '🎯 SESSION-STORAGE: Retrieved completed steps',
                    parsed
                )
                return parsed
            }
        } catch (error) {
            console.error('Failed to get completed steps:', error)
        }
        return null
    }

    clearCompletedSteps(): void {
        try {
            sessionStorage.removeItem(this.STEPS_KEY)
            console.log('🎯 SESSION-STORAGE: Cleared completed steps')
        } catch (error) {
            console.error('Failed to clear completed steps:', error)
        }
    }

    // Update specific step
    markStepCompleted(step: keyof Omit<CompletedSteps, 'timestamp'>): void {
        const current = this.getCompletedSteps() || {
            instructions: false,
            consent: false,
            healthCheck: false,
            timestamp: Date.now(),
        }

        current[step] = true
        current.timestamp = Date.now()
        this.saveCompletedSteps(current)
    }

    // Check if step is completed
    isStepCompleted(step: keyof Omit<CompletedSteps, 'timestamp'>): boolean {
        const steps = this.getCompletedSteps()
        return steps ? steps[step] : false
    }

    // Workflow Config Management
    saveWorkflowConfig(config: WorkflowConfig): void {
        try {
            sessionStorage.setItem(this.WORKFLOW_KEY, JSON.stringify(config))
            console.log('🎯 SESSION-STORAGE: Saved workflow config', config)
        } catch (error) {
            console.error('Failed to save workflow config:', error)
        }
    }

    getWorkflowConfig(): WorkflowConfig | null {
        try {
            const data = sessionStorage.getItem(this.WORKFLOW_KEY)
            if (data) {
                const parsed = JSON.parse(data) as WorkflowConfig
                console.log(
                    '🎯 SESSION-STORAGE: Retrieved workflow config',
                    parsed
                )
                return parsed
            }
        } catch (error) {
            console.error('Failed to get workflow config:', error)
        }
        return null
    }

    clearWorkflowConfig(): void {
        try {
            sessionStorage.removeItem(this.WORKFLOW_KEY)
            console.log('🎯 SESSION-STORAGE: Cleared workflow config')
        } catch (error) {
            console.error('Failed to clear workflow config:', error)
        }
    }

    hasWorkflowConfig(): boolean {
        return this.getWorkflowConfig() !== null
    }

    // Clear all data (for end session)
    clearAll(): void {
        this.clearSessionData()
        this.clearCompletedSteps()
        this.clearWorkflowConfig()
        this.clearStepData()
        this.clearJourneyData()
        console.log(
            '🎯 SESSION-STORAGE: Cleared all session data including step data and journey data'
        )
    }

    clearJourneyData(): void {
        try {
            sessionStorage.removeItem('vkyc_journey_data')
            console.log('🎯 SESSION-STORAGE: Cleared VKYC journey data')
        } catch (error) {
            console.warn(
                '🎯 SESSION-STORAGE: Failed to clear journey data:',
                error
            )
        }
    }

    // Check if we have valid session data
    hasValidSession(): boolean {
        return this.getSessionData() !== null
    }

    // Get current step based on completed steps
    getCurrentStep(): 'instructions' | 'consent' | 'health-check' | 'complete' {
        const steps = this.getCompletedSteps()
        if (!steps) return 'instructions'

        if (!steps.instructions) return 'instructions'
        if (!steps.consent) return 'consent'
        if (!steps.healthCheck) return 'health-check'
        return 'complete'
    }

    // Step Data Management
    saveStepData(stepData: StepData): void {
        try {
            const existingData = this.getAllStepData()
            existingData[stepData.stepId] = stepData
            sessionStorage.setItem(
                this.STEP_DATA_KEY,
                JSON.stringify(existingData)
            )
            console.log(
                '🎯 SESSION-STORAGE: Saved step data for',
                stepData.stepId,
                stepData
            )
        } catch (error) {
            console.error('Failed to save step data:', error)
        }
    }

    getStepData(stepId: string): StepData | null {
        try {
            const allData = this.getAllStepData()
            return allData[stepId] || null
        } catch (error) {
            console.error('Failed to get step data:', error)
            return null
        }
    }

    getAllStepData(): { [stepId: string]: StepData } {
        try {
            const data = sessionStorage.getItem(this.STEP_DATA_KEY)
            if (data) {
                return JSON.parse(data)
            }
        } catch (error) {
            console.error('Failed to get all step data:', error)
        }
        return {}
    }

    clearStepData(): void {
        try {
            sessionStorage.removeItem(this.STEP_DATA_KEY)
            console.log('🎯 SESSION-STORAGE: Cleared step data')
        } catch (error) {
            console.error('Failed to clear step data:', error)
        }
    }
}
