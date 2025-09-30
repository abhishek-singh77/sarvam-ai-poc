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
            this.setStream(this.stream)
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['stream'] && this.stream) {
            this.setStream(this.stream)
        }
    }

    setStream(stream: MediaStream): void {
        console.log('🎯 AUDIO-VIDEO-TRACK: Setting stream:', {
            id: stream.id,
            active: stream.active,
            videoTracks: stream.getVideoTracks().length,
            audioTracks: stream.getAudioTracks().length,
        })

        // Set video stream
        const videoTracks = stream.getVideoTracks()
        if (videoTracks.length > 0 && this._videoTrack) {
            console.log('🎯 AUDIO-VIDEO-TRACK: Setting video track')
            this._videoTrack.nativeElement.srcObject = stream

            // Ensure video element is visible and has proper dimensions
            this._videoTrack.nativeElement.style.width = '100%'
            this._videoTrack.nativeElement.style.height = '100%'
            this._videoTrack.nativeElement.style.objectFit = 'cover'

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
                '🎯 AUDIO-VIDEO-TRACK: No video track or video element available'
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
    }
}
