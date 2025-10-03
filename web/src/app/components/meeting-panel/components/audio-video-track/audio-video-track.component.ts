import {
    Component,
    ElementRef,
    Input,
    ViewChild,
    OnChanges,
    SimpleChanges,
    AfterViewInit,
} from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-audio-video-track',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './audio-video-track.component.html',
    styleUrls: ['./audio-video-track.component.css'],
})
export class AudioVideoTrackComponent implements OnChanges, AfterViewInit {
    @Input() muted = false
    @Input() mirrorVideoStream: boolean = false
    @Input() stream: MediaStream | null = null

    @ViewChild('videoTrack') _videoTrack!: ElementRef<HTMLVideoElement>
    @ViewChild('audioTrack') _audioTrack!: ElementRef<HTMLAudioElement>

    private currentVideoStream: MediaStream | null = null
    private currentAudioStream: MediaStream | null = null

    constructor() {}

    ngAfterViewInit(): void {
        // Set initial stream if available
        if (this.stream) {
            // Wait for video element to be ready
            setTimeout(() => {
                this.setStream(this.stream!)
            }, 100)
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['stream'] && this.stream) {
            // Wait for video element to be ready
            setTimeout(() => {
                this.setStream(this.stream!)
            }, 100)
        }

        if (changes['muted']) {
            // Update muted state for both video and audio elements
            this.updateMutedState()
        }
    }

    setStream(stream: MediaStream): void {
        console.log('🎯 AUDIO-VIDEO-TRACK: Setting stream:', {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
        })

        // Check if this is the same stream to avoid AbortError
        if (
            this.currentVideoStream &&
            this.currentVideoStream.id === stream.id
        ) {
            console.log(
                '🎯 AUDIO-VIDEO-TRACK: Same stream already set, skipping'
            )
            return
        }

        // Set video stream
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0 && this._videoTrack) {
            console.log('🎯 AUDIO-VIDEO-TRACK: Setting video track')

            // Store the current stream
            this.currentVideoStream = stream

            // Ensure video element is ready
            const videoElement = this._videoTrack.nativeElement
            if (!videoElement) {
                console.error('🎯 AUDIO-VIDEO-TRACK: Video element not found')
                return
            }

            // Clear any existing stream first to prevent AbortError
            if (videoElement.srcObject) {
                videoElement.srcObject = null
            }

            videoElement.srcObject = stream

            // Ensure video element is visible and has proper dimensions
            videoElement.style.width = '100%'
            videoElement.style.height = '100%'
            videoElement.style.objectFit = 'contain'
            videoElement.style.display = 'block'
            videoElement.style.visibility = 'visible'
            videoElement.style.backgroundColor = '#000000'
            videoElement.style.aspectRatio = '16/9'

            // Force video to be visible
            videoElement.style.opacity = '1'
            videoElement.style.zIndex = '1'

            // Add event listeners for debugging
            videoElement.addEventListener('loadedmetadata', () => {
                console.log('🎯 AUDIO-VIDEO-TRACK: Video metadata loaded:', {
                    videoWidth: videoElement.videoWidth,
                    videoHeight: videoElement.videoHeight,
                    duration: videoElement.duration,
                    srcObject: !!videoElement.srcObject,
                    readyState: videoElement.readyState,
                })

                // Ensure video has proper dimensions
                if (
                    videoElement.videoWidth > 0 &&
                    videoElement.videoHeight > 0
                ) {
                    videoElement.style.width = '100%'
                    videoElement.style.height = '100%'
                    console.log('🎯 AUDIO-VIDEO-TRACK: Video dimensions set')
                }
            })

            videoElement.addEventListener('canplay', () => {
                console.log('🎯 AUDIO-VIDEO-TRACK: Video can play')
            })

            videoElement.addEventListener('playing', () => {
                console.log('🎯 AUDIO-VIDEO-TRACK: Video is playing')
            })

            videoElement.addEventListener('error', (e) => {
                console.error('🎯 AUDIO-VIDEO-TRACK: Video error:', e)
            })

            // Play the video
            this._videoTrack.nativeElement
                .play()
                .then(() => {
                    console.log(
                        '🎯 AUDIO-VIDEO-TRACK: Video playing successfully'
                    )
                })
                .catch((error) => {
                    console.error(
                        '🎯 AUDIO-VIDEO-TRACK: Video play failed:',
                        error
                    )
                })
        } else {
            console.log(
                '🎯 AUDIO-VIDEO-TRACK: No video track or video element available',
                {
                    hasVideoTracks: videoTracks.length > 0,
                    hasVideoElement: !!this._videoTrack,
                }
            )
        }

        // Set audio stream
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0 && this._audioTrack) {
            console.log('🎯 AUDIO-VIDEO-TRACK: Setting audio track')
            this._audioTrack.nativeElement.srcObject = stream

            // Play the audio
            this._audioTrack.nativeElement
                .play()
                .then(() => {
                    console.log(
                        '🎯 AUDIO-VIDEO-TRACK: Audio playing successfully'
                    )
                })
                .catch((error) => {
                    console.error(
                        '🎯 AUDIO-VIDEO-TRACK: Audio play failed:',
                        error
                    )
                })
        } else {
            console.log(
                '🎯 AUDIO-VIDEO-TRACK: No audio track or audio element available'
            )
        }

        // Apply muted state after setting stream
        this.updateMutedState()
    }

    getVideoElement(): HTMLVideoElement | null {
        return this._videoTrack?.nativeElement || null
    }

    private updateMutedState(): void {
        console.log('🎯 AUDIO-VIDEO-TRACK: Updating muted state:', this.muted)

        // Update video element muted state
        if (this._videoTrack?.nativeElement) {
            this._videoTrack.nativeElement.muted = this.muted
            console.log('🎯 AUDIO-VIDEO-TRACK: Video muted set to:', this.muted)
        }

        // Update audio element muted state
        if (this._audioTrack?.nativeElement) {
            this._audioTrack.nativeElement.muted = this.muted
            console.log('🎯 AUDIO-VIDEO-TRACK: Audio muted set to:', this.muted)
        }
    }

    onVideoLoadedMetadata(event: Event): void {
        const video = event.target as HTMLVideoElement
        console.log('🎯 AUDIO-VIDEO-TRACK: Video metadata loaded via event:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            duration: video.duration,
        })
    }

    onVideoCanPlay(event: Event): void {
        console.log('🎯 AUDIO-VIDEO-TRACK: Video can play via event')
    }

    onVideoPlaying(event: Event): void {
        console.log('🎯 AUDIO-VIDEO-TRACK: Video is playing via event')
    }

    // Debug method to check video element state
    checkVideoState(): void {
        if (this._videoTrack) {
            const video = this._videoTrack.nativeElement
            const rect = video.getBoundingClientRect()
            console.log('🎯 AUDIO-VIDEO-TRACK: Video element state:', {
                srcObject: !!video.srcObject,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                readyState: video.readyState,
                paused: video.paused,
                currentTime: video.currentTime,
                duration: video.duration,
                boundingRect: {
                    width: rect.width,
                    height: rect.height,
                    top: rect.top,
                    left: rect.left,
                    visible: rect.width > 0 && rect.height > 0,
                },
                style: {
                    width: video.style.width,
                    height: video.style.height,
                    display: video.style.display,
                    visibility: video.style.visibility,
                    opacity: video.style.opacity,
                },
                computedStyle: {
                    width: getComputedStyle(video).width,
                    height: getComputedStyle(video).height,
                    display: getComputedStyle(video).display,
                    visibility: getComputedStyle(video).visibility,
                    opacity: getComputedStyle(video).opacity,
                },
            })
        }
    }
}
