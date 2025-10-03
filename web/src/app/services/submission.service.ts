import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, BehaviorSubject } from 'rxjs'
import { map, catchError } from 'rxjs/operators'
import { environment } from '../../environments/environment'

export interface SubmissionConfig {
    baseUrl: string
    endpoints: {
        selfie: string
        document: string
        faceMatch: string
        centralDb: string
        questionnaire: string
        stepComplete: string
    }
    headers?: HttpHeaders
}

export interface ArtifactPayload {
    stepRef: string
    artifactType: 'selfie' | 'document'
    base64Data: string
    metadata?: {
        captureType?: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE' | 'QUESTIONNAIRE'
        documentType?: 'pan' | 'aadhaar'
        imageUploadMode?: 'NA' | 'FRONT_BACK'
        quality?: number
        confidence?: number
    }
}

export interface ValidationPayload {
    stepRef: string
    validationType: 'face_match' | 'central_db'
    sourceArtifactId: string
    targetArtifactId?: string
    metadata?: any
}

export interface QuestionnairePayload {
    stepRef: string
    answers: { [questionId: string]: string }
    metadata?: {
        timestamp: number
        source: 'voice' | 'text' | 'manual'
    }
}

export interface SubmissionResult {
    success: boolean
    data?: any
    error?: string
    artifactId?: string
    validationResult?: {
        passed: boolean
        score?: number
        details?: any
    }
}

@Injectable({
    providedIn: 'root',
})
export class SubmissionService {
    private config: SubmissionConfig = {
        baseUrl: environment.apiUrl,
        endpoints: {
            selfie: '/kyc/workflow-submissions/selfie',
            document: '/kyc/workflow-submissions/document',
            faceMatch: '/kyc/workflow-submissions/face-match',
            centralDb: '/kyc/workflow-submissions/central-db',
            questionnaire: '/kyc/workflow-submissions/questionnaire',
            stepComplete:
                '/kyc/workflow-submissions/steps/{sessionId}/{stepId}/complete',
        },
    }

    private submissionState = new BehaviorSubject<{
        [stepRef: string]: SubmissionResult
    }>({})
    public submissionState$ = this.submissionState.asObservable()

    constructor(private http: HttpClient) {}

    /**
     * Submit a selfie or document artifact
     */
    async submitArtifact(payload: ArtifactPayload): Promise<SubmissionResult> {
        try {
            console.log(
                '🎯 SUBMISSION-SERVICE: Submitting artifact:',
                payload.stepRef,
                payload.artifactType
            )

            const endpoint =
                payload.artifactType === 'selfie'
                    ? this.config.endpoints.selfie
                    : this.config.endpoints.document

            const response = await this.http
                .post<any>(`${this.config.baseUrl}${endpoint}`, {
                    stepRef: payload.stepRef,
                    imageData: payload.base64Data,
                    metadata: payload.metadata,
                })
                .toPromise()

            const result: SubmissionResult = {
                success: true,
                data: response,
                artifactId: response.artifactId || response.id,
            }

            this.updateSubmissionState(payload.stepRef, result)
            console.log(
                '🎯 SUBMISSION-SERVICE: Artifact submitted successfully:',
                result.artifactId
            )
            return result
        } catch (error) {
            console.error(
                '🎯 SUBMISSION-SERVICE: Artifact submission failed:',
                error
            )
            const result: SubmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
            this.updateSubmissionState(payload.stepRef, result)
            return result
        }
    }

    /**
     * Submit validation request (face match, central DB check)
     */
    async submitValidation(
        payload: ValidationPayload
    ): Promise<SubmissionResult> {
        try {
            console.log(
                '🎯 SUBMISSION-SERVICE: Submitting validation:',
                payload.validationType,
                payload.stepRef
            )

            const endpoint =
                payload.validationType === 'face_match'
                    ? this.config.endpoints.faceMatch
                    : this.config.endpoints.centralDb

            const response = await this.http
                .post<any>(`${this.config.baseUrl}${endpoint}`, {
                    stepRef: payload.stepRef,
                    sourceArtifactId: payload.sourceArtifactId,
                    targetArtifactId: payload.targetArtifactId,
                    metadata: payload.metadata,
                })
                .toPromise()

            const result: SubmissionResult = {
                success: true,
                data: response,
                validationResult: {
                    passed: response.passed || response.success,
                    score: response.score || response.confidence,
                    details: response.details,
                },
            }

            this.updateSubmissionState(payload.stepRef, result)
            console.log(
                '🎯 SUBMISSION-SERVICE: Validation completed:',
                result.validationResult
            )
            return result
        } catch (error) {
            console.error('🎯 SUBMISSION-SERVICE: Validation failed:', error)
            const result: SubmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
            this.updateSubmissionState(payload.stepRef, result)
            return result
        }
    }

    /**
     * Submit questionnaire answers
     */
    async submitAnswers(
        payload: QuestionnairePayload
    ): Promise<SubmissionResult> {
        try {
            console.log(
                '🎯 SUBMISSION-SERVICE: Submitting questionnaire answers:',
                payload.stepRef
            )

            const response = await this.http
                .post<any>(
                    `${this.config.baseUrl}${this.config.endpoints.questionnaire}`,
                    {
                        stepRef: payload.stepRef,
                        answers: payload.answers,
                        metadata: payload.metadata,
                    }
                )
                .toPromise()

            const result: SubmissionResult = {
                success: true,
                data: response,
            }

            this.updateSubmissionState(payload.stepRef, result)
            console.log(
                '🎯 SUBMISSION-SERVICE: Questionnaire submitted successfully'
            )
            return result
        } catch (error) {
            console.error(
                '🎯 SUBMISSION-SERVICE: Questionnaire submission failed:',
                error
            )
            const result: SubmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
            this.updateSubmissionState(payload.stepRef, result)
            return result
        }
    }

    /**
     * Complete a workflow step
     */
    async completeStep(
        sessionId: string,
        stepId: string,
        data: any
    ): Promise<SubmissionResult> {
        try {
            console.log('🎯 SUBMISSION-SERVICE: Completing step:', stepId)

            const endpoint = this.config.endpoints.stepComplete
                .replace('{sessionId}', sessionId)
                .replace('{stepId}', stepId)

            const response = await this.http
                .post<any>(`${this.config.baseUrl}${endpoint}`, {
                    step_id: stepId,
                    data: data,
                })
                .toPromise()

            const result: SubmissionResult = {
                success: true,
                data: response,
            }

            console.log(
                '🎯 SUBMISSION-SERVICE: Step completed successfully:',
                stepId
            )
            return result
        } catch (error) {
            console.error(
                '🎯 SUBMISSION-SERVICE: Step completion failed:',
                error
            )
            const result: SubmissionResult = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
            return result
        }
    }

    /**
     * Get submission state for a specific step
     */
    getSubmissionState(stepRef: string): SubmissionResult | null {
        const state = this.submissionState.value
        return state[stepRef] || null
    }

    /**
     * Check if step has been successfully submitted
     */
    isStepSubmitted(stepRef: string): boolean {
        const state = this.getSubmissionState(stepRef)
        return state?.success || false
    }

    /**
     * Clear submission state for a step (useful for retries)
     */
    clearSubmissionState(stepRef: string): void {
        const state = this.submissionState.value
        delete state[stepRef]
        this.submissionState.next({ ...state })
    }

    /**
     * Update configuration
     */
    updateConfig(config: Partial<SubmissionConfig>): void {
        this.config = { ...this.config, ...config }
    }

    private updateSubmissionState(
        stepRef: string,
        result: SubmissionResult
    ): void {
        const state = this.submissionState.value
        state[stepRef] = result
        this.submissionState.next({ ...state })
    }
}
