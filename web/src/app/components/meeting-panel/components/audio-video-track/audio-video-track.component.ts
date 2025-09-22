import { Component, ElementRef, Input, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'

@Component({
    selector: 'app-audio-video-track',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './audio-video-track.component.html',
    styleUrls: ['./audio-video-track.component.css'],
})
export class AudioVideoTrackComponent {
    @Input() muted = false
    @Input() mirrorVideoStream: boolean = false

    @ViewChild('videoTrack') _videoTrack!: ElementRef<HTMLVideoElement>
    @ViewChild('audioTrack') _audioTrack!: ElementRef<HTMLAudioElement>

    constructor() {}
}
