import { Component, Input, OnInit, OnDestroy } from '@angular/core'
import { CommonModule } from '@angular/common'
import { HttpClient } from '@angular/common/http'
import { Subscription } from 'rxjs'

interface ConversationEntry {
    timestamp: string
    type:
        | 'user_speech'
        | 'stt_result'
        | 'llm_response'
        | 'tts_input'
        | 'agent_speech'
        | 'error'
    content: string
    metadata: any
    duration_ms?: number
}

interface ConversationStats {
    total_entries: number
    turns: number
    last_activity?: string
}

@Component({
    selector: 'app-conversation-flow',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="conversation-flow-container">
            <!-- Header -->
            <div class="flow-header">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">
                    Conversation Flow
                </h3>
                <div class="flex items-center gap-4">
                    <div class="stats">
                        <span class="text-sm text-gray-600">
                            {{ stats.turns }} turns,
                            {{ stats.total_entries }} entries
                        </span>
                    </div>
                    <div class="controls">
                        <button
                            class="refresh-btn"
                            (click)="refreshConversation()"
                            [disabled]="isLoading">
                            <svg
                                class="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Refresh
                        </button>
                        <button
                            class="clear-btn"
                            (click)="clearConversation()"
                            [disabled]="isLoading">
                            <svg
                                class="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24">
                                <path
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                    stroke-width="2"
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            <!-- Loading State -->
            <div *ngIf="isLoading" class="loading-state">
                <div
                    class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p class="text-sm text-gray-600 mt-2">
                    Loading conversation...
                </p>
            </div>

            <!-- Conversation Entries -->
            <div *ngIf="!isLoading" class="conversation-entries">
                <div
                    *ngIf="conversationHistory.length === 0"
                    class="empty-state">
                    <div class="text-center py-8">
                        <svg
                            class="w-12 h-12 text-gray-400 mx-auto mb-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        <p class="text-gray-500">No conversation history yet</p>
                        <p class="text-sm text-gray-400">
                            Start talking with the agent to see the conversation
                            flow
                        </p>
                    </div>
                </div>

                <div
                    *ngFor="let entry of conversationHistory; let i = index"
                    class="conversation-entry">
                    <!-- Entry Header -->
                    <div class="entry-header">
                        <div class="entry-type">
                            <span
                                class="type-icon"
                                [ngClass]="getEntryTypeClass(entry.type)">
                                {{ getEntryTypeIcon(entry.type) }}
                            </span>
                            <span class="type-label">{{
                                getEntryTypeLabel(entry.type)
                            }}</span>
                        </div>
                        <div class="entry-meta">
                            <span class="timestamp">{{
                                formatTimestamp(entry.timestamp)
                            }}</span>
                            <span *ngIf="entry.duration_ms" class="duration">
                                {{ entry.duration_ms }}ms
                            </span>
                        </div>
                    </div>

                    <!-- Entry Content -->
                    <div class="entry-content">
                        <div
                            class="content-text"
                            [ngClass]="getContentClass(entry.type)">
                            {{ entry.content }}
                        </div>

                        <!-- Entry Metadata -->
                        <div
                            *ngIf="
                                entry.metadata && hasMetadata(entry.metadata)
                            "
                            class="entry-metadata">
                            <div class="metadata-grid">
                                <div
                                    *ngIf="entry.metadata.confidence"
                                    class="metadata-item">
                                    <span class="metadata-label"
                                        >Confidence:</span
                                    >
                                    <span class="metadata-value"
                                        >{{
                                            (
                                                entry.metadata.confidence * 100
                                            ).toFixed(1)
                                        }}%</span
                                    >
                                </div>
                                <div
                                    *ngIf="entry.metadata.model"
                                    class="metadata-item">
                                    <span class="metadata-label">Model:</span>
                                    <span class="metadata-value">{{
                                        entry.metadata.model
                                    }}</span>
                                </div>
                                <div
                                    *ngIf="entry.metadata.voice"
                                    class="metadata-item">
                                    <span class="metadata-label">Voice:</span>
                                    <span class="metadata-value">{{
                                        entry.metadata.voice
                                    }}</span>
                                </div>
                                <div
                                    *ngIf="entry.metadata.language"
                                    class="metadata-item">
                                    <span class="metadata-label"
                                        >Language:</span
                                    >
                                    <span class="metadata-value">{{
                                        entry.metadata.language
                                    }}</span>
                                </div>
                                <div
                                    *ngIf="entry.metadata.processing_time_ms"
                                    class="metadata-item">
                                    <span class="metadata-label"
                                        >Processing:</span
                                    >
                                    <span class="metadata-value"
                                        >{{
                                            entry.metadata.processing_time_ms
                                        }}ms</span
                                    >
                                </div>
                                <div
                                    *ngIf="entry.metadata.tokens_used"
                                    class="metadata-item">
                                    <span class="metadata-label">Tokens:</span>
                                    <span class="metadata-value">{{
                                        entry.metadata.tokens_used
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .conversation-flow-container {
                @apply bg-white rounded-lg shadow-md p-6;
            }

            .flow-header {
                @apply flex items-center justify-between mb-6;
            }

            .stats {
                @apply text-sm text-gray-600;
            }

            .controls {
                @apply flex gap-2;
            }

            .refresh-btn,
            .clear-btn {
                @apply px-3 py-1 rounded-lg text-sm font-medium transition-colors flex items-center;
            }

            .refresh-btn {
                @apply bg-blue-100 text-blue-700 hover:bg-blue-200;
            }

            .clear-btn {
                @apply bg-red-100 text-red-700 hover:bg-red-200;
            }

            .loading-state {
                @apply text-center py-8;
            }

            .conversation-entries {
                @apply space-y-4;
            }

            .empty-state {
                @apply text-center py-8;
            }

            .conversation-entry {
                @apply border border-gray-200 rounded-lg p-4;
            }

            .entry-header {
                @apply flex items-center justify-between mb-3;
            }

            .entry-type {
                @apply flex items-center gap-2;
            }

            .type-icon {
                @apply w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold;
            }

            .type-icon.user-speech {
                @apply bg-blue-500;
            }

            .type-icon.stt-result {
                @apply bg-green-500;
            }

            .type-icon.llm-response {
                @apply bg-purple-500;
            }

            .type-icon.tts-input {
                @apply bg-orange-500;
            }

            .type-icon.agent-speech {
                @apply bg-indigo-500;
            }

            .type-icon.error {
                @apply bg-red-500;
            }

            .type-label {
                @apply text-sm font-medium text-gray-700;
            }

            .entry-meta {
                @apply flex items-center gap-2 text-xs text-gray-500;
            }

            .timestamp {
                @apply font-mono;
            }

            .duration {
                @apply bg-gray-100 px-2 py-1 rounded;
            }

            .entry-content {
                @apply space-y-2;
            }

            .content-text {
                @apply text-sm leading-relaxed;
            }

            .content-text.user-speech {
                @apply text-blue-800 bg-blue-50 p-3 rounded;
            }

            .content-text.stt-result {
                @apply text-green-800 bg-green-50 p-3 rounded;
            }

            .content-text.llm-response {
                @apply text-purple-800 bg-purple-50 p-3 rounded;
            }

            .content-text.tts-input {
                @apply text-orange-800 bg-orange-50 p-3 rounded;
            }

            .content-text.agent-speech {
                @apply text-indigo-800 bg-indigo-50 p-3 rounded;
            }

            .content-text.error {
                @apply text-red-800 bg-red-50 p-3 rounded;
            }

            .entry-metadata {
                @apply mt-3 p-3 bg-gray-50 rounded;
            }

            .metadata-grid {
                @apply grid grid-cols-2 gap-2;
            }

            .metadata-item {
                @apply flex justify-between text-xs;
            }

            .metadata-label {
                @apply text-gray-600 font-medium;
            }

            .metadata-value {
                @apply text-gray-800;
            }

            .animate-spin {
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from {
                    transform: rotate(0deg);
                }
                to {
                    transform: rotate(360deg);
                }
            }
        `,
    ],
})
export class ConversationFlowComponent implements OnInit, OnDestroy {
    @Input() roomId: string = ''

    conversationHistory: ConversationEntry[] = []
    stats: ConversationStats = {
        total_entries: 0,
        turns: 0,
    }
    isLoading: boolean = false

    private refreshInterval: any
    private subscriptions: Subscription = new Subscription()

    constructor(private http: HttpClient) {}

    ngOnInit(): void {
        if (this.roomId) {
            this.loadConversationHistory()
            // Refresh every 3 seconds
            this.refreshInterval = setInterval(() => {
                this.loadConversationHistory()
            }, 3000)
        }
    }

    ngOnDestroy(): void {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval)
        }
        this.subscriptions.unsubscribe()
    }

    private loadConversationHistory(): void {
        if (!this.roomId) return

        this.http
            .get(
                `http://localhost:8000/api/v1/sessions/conversation/history/${this.roomId}`
            )
            .subscribe({
                next: (response: any) => {
                    if (response.status === 'success') {
                        this.conversationHistory = response.history || []
                        this.stats = response.stats || this.stats
                    }
                },
                error: (error) => {
                    console.error('Failed to load conversation history:', error)
                },
            })
    }

    refreshConversation(): void {
        this.isLoading = true
        this.loadConversationHistory()
        setTimeout(() => {
            this.isLoading = false
        }, 1000)
    }

    clearConversation(): void {
        if (!this.roomId) return

        this.http
            .delete(
                `http://localhost:8000/api/v1/sessions/conversation/clear/${this.roomId}`
            )
            .subscribe({
                next: (response: any) => {
                    if (response.status === 'success') {
                        this.conversationHistory = []
                        this.stats = { total_entries: 0, turns: 0 }
                    }
                },
                error: (error) => {
                    console.error('Failed to clear conversation:', error)
                },
            })
    }

    getEntryTypeClass(type: string): string {
        return type.replace('_', '-')
    }

    getEntryTypeIcon(type: string): string {
        switch (type) {
            case 'user_speech':
                return '🎤'
            case 'stt_result':
                return '📝'
            case 'llm_response':
                return '🤖'
            case 'tts_input':
                return '🔊'
            case 'agent_speech':
                return '🎵'
            case 'error':
                return '❌'
            default:
                return '📄'
        }
    }

    getEntryTypeLabel(type: string): string {
        switch (type) {
            case 'user_speech':
                return 'User Speech'
            case 'stt_result':
                return 'STT Result'
            case 'llm_response':
                return 'LLM Response'
            case 'tts_input':
                return 'TTS Input'
            case 'agent_speech':
                return 'Agent Speech'
            case 'error':
                return 'Error'
            default:
                return 'Unknown'
        }
    }

    getContentClass(type: string): string {
        return type.replace('_', '-')
    }

    hasMetadata(metadata: any): boolean {
        return metadata && Object.keys(metadata).length > 0
    }

    formatTimestamp(timestamp: string): string {
        const date = new Date(timestamp)
        return date.toLocaleTimeString()
    }
}
