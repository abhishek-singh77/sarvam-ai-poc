import { Injectable } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { Observable } from 'rxjs'
import { environment } from '../../environments/environment'

export interface JoinAgentRequest {
    room_id: string
    agent_participant_id: string
    agent_token: string
    workflow: string
}

export interface JoinAgentResponse {
    status: string
    room_id: string
    agent_token: string
    agent_participant_id: string
    message?: string
}

@Injectable({
    providedIn: 'root',
})
export class JoinAgentService {
    private readonly apiUrl = environment.apiUrl

    constructor(private http: HttpClient) {}

    joinAgent(request: JoinAgentRequest): Observable<JoinAgentResponse> {
        const url = `${this.apiUrl}/sessions/join-agent`

        console.log('🎯 JOIN-AGENT: Sending request to:', url, request)

        return this.http.post<JoinAgentResponse>(url, request)
    }

    // Helper method to create join agent request
    createJoinAgentRequest(
        roomId: string,
        agentParticipantId: string,
        agentToken: string,
        workflow: string = ''
    ): JoinAgentRequest {
        return {
            room_id: roomId,
            agent_participant_id: agentParticipantId,
            agent_token: agentToken,
            workflow: workflow,
        }
    }
}
