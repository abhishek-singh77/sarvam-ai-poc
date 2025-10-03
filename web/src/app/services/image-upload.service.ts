import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'

export interface ImageUploadRequest {
    image_data: string
    step_id: string
    capture_type: 'FACE_CAPTURE' | 'DOCUMENT_CAPTURE'
    timestamp: string
}

export interface ImageUploadResponse {
    status: string
    message: string
    step_id: string
    capture_type: string
    error?: string
    analysis_result: {
        face_detected?: boolean
        quality_score?: number
        face_angle?: string
        lighting_quality?: string
        blur_detected?: boolean
        recommendations?: string[]
        is_valid?: boolean
        extracted_fields?: any
        error?: string
    }
}

// Removed ImageAnalysisRequest - analysis is now handled directly in upload-selfie endpoint

export interface StepCompletionRequest {
    step_id: string
    result: string
    timestamp: string
}

@Injectable({
    providedIn: 'root',
})
export class ImageUploadService {
    private readonly baseUrl = `${environment.apiUrl}/sessions`

    constructor(private http: HttpClient) {}

    /**
     * Upload a selfie or document image
     */
    uploadImage(
        roomId: string,
        uploadData: ImageUploadRequest
    ): Observable<ImageUploadResponse> {
        console.log(
            '🎯 IMAGE-UPLOAD-SERVICE: Uploading image for room:',
            roomId
        )

        return this.http.post<ImageUploadResponse>(
            `${this.baseUrl}/${roomId}/upload-selfie`,
            uploadData
        )
    }

    // Removed analyzeImage method - analysis is now handled directly in upload-selfie endpoint

    /**
     * Complete a workflow step
     */
    completeStep(
        roomId: string,
        completionData: StepCompletionRequest
    ): Observable<any> {
        console.log(
            '🎯 IMAGE-UPLOAD-SERVICE: Completing step for room:',
            roomId
        )

        return this.http.post(
            `${this.baseUrl}/${roomId}/complete-step`,
            completionData
        )
    }
}
