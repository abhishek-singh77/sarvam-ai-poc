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

@Injectable({
    providedIn: 'root',
})
export class SessionStorageService {
    private readonly SESSION_KEY = 'kyc_session_data'
    private readonly STEPS_KEY = 'kyc_completed_steps'

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

    // Clear all data (for end session)
    clearAll(): void {
        this.clearSessionData()
        this.clearCompletedSteps()
        console.log('🎯 SESSION-STORAGE: Cleared all session data')
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
}
