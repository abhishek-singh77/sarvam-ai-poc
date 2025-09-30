import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'

export interface HealthCheckDataRequest {
    session_id: string
    location_data: {
        latitude: number
        longitude: number
        accuracy: number
        timestamp: number
    } | null
    network_speed: {
        downloadSpeed: number
        uploadSpeed: number
        latency: number
    } | null
    is_vpn_detected: boolean
    user_agent: string
    timestamp: number
}

export interface HealthCheckDataResponse {
    status: string
    message: string
    session_id: string
    timestamp: number
}

@Injectable({
    providedIn: 'root',
})
export class HealthCheckDataService {
    private readonly apiUrl = environment.apiUrl

    constructor(private http: HttpClient) {}

    storeHealthCheckData(
        request: HealthCheckDataRequest
    ): Observable<HealthCheckDataResponse> {
        const url = `${this.apiUrl}/sessions/health-check-data`

        console.log('🎯 HEALTH-CHECK-DATA: Sending request to:', url)
        console.log(
            '🎯 HEALTH-CHECK-DATA: Request payload:',
            JSON.stringify(request, null, 2)
        )
        console.log(
            '🎯 HEALTH-CHECK-DATA: API URL from environment:',
            this.apiUrl
        )

        return this.http.post<HealthCheckDataResponse>(url, request)
    }

    // Helper method to create health check data request
    createHealthCheckDataRequest(
        sessionId: string,
        locationData: any,
        networkSpeed: any,
        isVpnDetected: boolean
    ): HealthCheckDataRequest {
        return {
            session_id: sessionId,
            location_data: locationData,
            network_speed: networkSpeed,
            is_vpn_detected: isVpnDetected,
            user_agent: navigator.userAgent,
            timestamp: Date.now(),
        }
    }
}
