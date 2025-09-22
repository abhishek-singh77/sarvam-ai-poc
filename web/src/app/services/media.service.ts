import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'
import { MediaState } from '../interfaces/room.interface'

@Injectable({
    providedIn: 'root',
})
export class MediaService {
    private mediaStateSubject = new BehaviorSubject<MediaState>({
        hasMedia: false,
        error: null,
    })

    public mediaState$ = this.mediaStateSubject.asObservable()
    private currentStream: MediaStream | null = null

    async requestMediaAccess(): Promise<boolean> {
        try {
            console.log('🎯 MEDIA-SERVICE: Requesting media access...')
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            })

            console.log('🎯 MEDIA-SERVICE: Media stream obtained:', {
                id: stream.id,
                active: stream.active,
                tracks: stream.getTracks().length,
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length,
            })

            // Log track details
            stream.getTracks().forEach((track, index) => {
                console.log(`🎯 MEDIA-SERVICE: Track ${index + 1}:`, {
                    kind: track.kind,
                    enabled: track.enabled,
                    muted: track.muted,
                    readyState: track.readyState,
                    label: track.label,
                })
            })

            // Don't stop the stream immediately - let the component handle it
            // Store the stream for later use
            this.currentStream = stream

            this.mediaStateSubject.next({
                hasMedia: true,
                error: null,
            })

            console.log('🎯 MEDIA-SERVICE: Media access granted successfully')
            return true
        } catch (error) {
            console.error('🎯 MEDIA-SERVICE: Media access error:', error)
            this.mediaStateSubject.next({
                hasMedia: false,
                error: 'Failed to access camera and microphone. Please check permissions.',
            })
            return false
        }
    }

    async getMediaStream(): Promise<MediaStream | null> {
        try {
            console.log('🎯 MEDIA-SERVICE: Getting media stream...')

            // Return the current stream if available, otherwise get a new one
            if (this.currentStream) {
                console.log('🎯 MEDIA-SERVICE: Returning existing stream:', {
                    id: this.currentStream.id,
                    active: this.currentStream.active,
                    tracks: this.currentStream.getTracks().length,
                })
                return this.currentStream
            }

            console.log(
                '🎯 MEDIA-SERVICE: No existing stream, requesting new one...'
            )
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            })

            this.currentStream = stream
            console.log('🎯 MEDIA-SERVICE: New stream obtained and stored')
            return stream
        } catch (error) {
            console.error(
                '🎯 MEDIA-SERVICE: Failed to get media stream:',
                error
            )
            return null
        }
    }

    stopCurrentStream(): void {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach((track) => track.stop())
            this.currentStream = null
        }
    }

    getCurrentMediaState(): MediaState {
        return this.mediaStateSubject.value
    }

    async toggleMicrophone(): Promise<boolean> {
        try {
            if (!this.currentStream) {
                console.log(
                    '🎯 MEDIA-SERVICE: No current stream to toggle microphone'
                )
                return false
            }

            const audioTrack = this.currentStream.getAudioTracks()[0]
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled
                console.log(
                    '🎯 MEDIA-SERVICE: Microphone toggled:',
                    audioTrack.enabled
                )
                return audioTrack.enabled
            }
            return false
        } catch (error) {
            console.error('🎯 MEDIA-SERVICE: Error toggling microphone:', error)
            return false
        }
    }

    async toggleCamera(): Promise<boolean> {
        try {
            if (!this.currentStream) {
                console.log(
                    '🎯 MEDIA-SERVICE: No current stream to toggle camera'
                )
                return false
            }

            const videoTrack = this.currentStream.getVideoTracks()[0]
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled
                console.log(
                    '🎯 MEDIA-SERVICE: Camera toggled:',
                    videoTrack.enabled
                )
                return videoTrack.enabled
            }
            return false
        } catch (error) {
            console.error('🎯 MEDIA-SERVICE: Error toggling camera:', error)
            return false
        }
    }

    isMicrophoneEnabled(): boolean {
        if (!this.currentStream) return false
        const audioTrack = this.currentStream.getAudioTracks()[0]
        return audioTrack ? audioTrack.enabled : false
    }

    isCameraEnabled(): boolean {
        if (!this.currentStream) return false
        const videoTrack = this.currentStream.getVideoTracks()[0]
        return videoTrack ? videoTrack.enabled : false
    }
}
