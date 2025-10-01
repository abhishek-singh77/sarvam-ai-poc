import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable, Subject } from 'rxjs'
import { filter, map } from 'rxjs/operators'

export interface WebSocketMessage {
    type: string
    data: any
    timestamp: number
}

export interface StepUpdateMessage {
    stepId: string
    status: 'started' | 'completed' | 'failed' | 'retry'
    data?: any
    error?: string
}

export interface AgentMessage {
    type: 'prompt' | 'instruction' | 'question' | 'completion'
    content: string
    stepId?: string
    metadata?: any
}

@Injectable({ providedIn: 'root' })
export class WebSocketBridgeService {
    private ws: WebSocket | null = null
    private isConnected = false
    private reconnectAttempts = 0
    private maxReconnectAttempts = 5
    private reconnectInterval = 3000

    // Message streams
    private messageSubject = new Subject<WebSocketMessage>()
    private stepUpdateSubject = new Subject<StepUpdateMessage>()
    private agentMessageSubject = new Subject<AgentMessage>()
    private connectionStatusSubject = new BehaviorSubject<boolean>(false)

    // Public observables
    public messages$ = this.messageSubject.asObservable()
    public stepUpdates$ = this.stepUpdateSubject.asObservable()
    public agentMessages$ = this.agentMessageSubject.asObservable()
    public connectionStatus$ = this.connectionStatusSubject.asObservable()

    constructor() {
        // Auto-connect on service initialization
        this.connect()
    }

    connect(url?: string): void {
        const wsUrl = url || this.getWebSocketUrl()
        console.log('🔌 WEBSOCKET: Connecting to:', wsUrl)

        try {
            this.ws = new WebSocket(wsUrl)
            this.setupEventHandlers()
        } catch (error) {
            console.error('🔌 WEBSOCKET: Connection failed:', error)
            this.scheduleReconnect()
        }
    }

    disconnect(): void {
        console.log('🔌 WEBSOCKET: Disconnecting')
        this.isConnected = false
        this.connectionStatusSubject.next(false)

        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
    }

    sendMessage(type: string, data: any): void {
        if (!this.isConnected || !this.ws) {
            console.warn('🔌 WEBSOCKET: Cannot send message - not connected')
            return
        }

        const message: WebSocketMessage = {
            type,
            data,
            timestamp: Date.now(),
        }

        try {
            this.ws.send(JSON.stringify(message))
            console.log('🔌 WEBSOCKET: Sent message:', type, data)
        } catch (error) {
            console.error('🔌 WEBSOCKET: Failed to send message:', error)
        }
    }

    // Convenience methods for specific message types
    sendStepCompletion(stepId: string, data: any): void {
        this.sendMessage('step_completion', { stepId, data })
    }

    sendStepError(stepId: string, error: string): void {
        this.sendMessage('step_error', { stepId, error })
    }

    sendArtifactSubmission(type: 'selfie' | 'document', data: any): void {
        this.sendMessage('artifact_submission', { type, data })
    }

    sendQuestionnaireAnswers(answers: any): void {
        this.sendMessage('questionnaire_answers', { answers })
    }

    // Subscribe to specific message types
    onStepUpdates(): Observable<StepUpdateMessage> {
        return this.stepUpdates$
    }

    onAgentMessages(): Observable<AgentMessage> {
        return this.agentMessages$
    }

    onMessageType(type: string): Observable<any> {
        return this.messages$.pipe(
            filter((msg) => msg.type === type),
            map((msg) => msg.data)
        )
    }

    private setupEventHandlers(): void {
        if (!this.ws) return

        this.ws.onopen = () => {
            console.log('🔌 WEBSOCKET: Connected successfully')
            this.isConnected = true
            this.connectionStatusSubject.next(true)
            this.reconnectAttempts = 0
        }

        this.ws.onmessage = (event) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data)
                this.handleMessage(message)
            } catch (error) {
                console.error('🔌 WEBSOCKET: Failed to parse message:', error)
            }
        }

        this.ws.onclose = () => {
            console.log('🔌 WEBSOCKET: Connection closed')
            this.isConnected = false
            this.connectionStatusSubject.next(false)
            this.scheduleReconnect()
        }

        this.ws.onerror = (error) => {
            console.error('🔌 WEBSOCKET: Connection error:', error)
            this.isConnected = false
            this.connectionStatusSubject.next(false)
        }
    }

    private handleMessage(message: WebSocketMessage): void {
        console.log(
            '🔌 WEBSOCKET: Received message:',
            message.type,
            message.data
        )

        // Emit to general message stream
        this.messageSubject.next(message)

        // Handle specific message types
        switch (message.type) {
            case 'step_update':
                this.stepUpdateSubject.next(message.data as StepUpdateMessage)
                break
            case 'agent_message':
                this.agentMessageSubject.next(message.data as AgentMessage)
                break
                // Handle workflow progress updates
                console.log('🔌 WEBSOCKET: Workflow progress:', message.data)
                break
            case 'validation_result':
                // Handle validation results
                console.log('🔌 WEBSOCKET: Validation result:', message.data)
                break
            default:
                console.log('🔌 WEBSOCKET: Unknown message type:', message.type)
        }
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('🔌 WEBSOCKET: Max reconnection attempts reached')
            return
        }

        this.reconnectAttempts++
        console.log(
            `🔌 WEBSOCKET: Scheduling reconnect attempt ${this.reconnectAttempts}`
        )

        setTimeout(() => {
            this.connect()
        }, this.reconnectInterval)
    }

    private getWebSocketUrl(): string {
        // In production, this would be configured based on environment
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.host
        return `${protocol}//${host}/ws`
    }
}
