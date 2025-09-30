import { Injectable } from '@angular/core'
import { BehaviorSubject, Observable } from 'rxjs'
import { UserInstruction } from '../components/pre-call-flow/user-instruction.component'
import { ConsentItem } from '../components/pre-call-flow/user-consent.component'
import { HealthCheckItem } from '../components/pre-call-flow/health-check.component'

export interface PreCallFlowState {
    currentStep: 'instructions' | 'consent' | 'health-check' | 'complete'
    canProceed: boolean
    isComplete: boolean
}

@Injectable({
    providedIn: 'root',
})
export class PreCallFlowService {
    private flowState = new BehaviorSubject<PreCallFlowState>({
        currentStep: 'instructions',
        canProceed: false,
        isComplete: false,
    })

    public flowState$ = this.flowState.asObservable()

    // Default instructions for KYC
    private defaultInstructions: UserInstruction[] = [
        {
            title: 'Face Visibility',
            description:
                'Ensure your face is clearly visible with proper lighting',
            icon: 'face',
            status: 'completed',
        },
        {
            title: 'Network & Environment',
            description:
                'Before proceeding, ensure a stable network and a quiet environment',
            icon: 'network',
            status: 'completed',
        },
        {
            title: 'Dress Code',
            description:
                'Please ensure to dress modestly during the video KYC process.',
            icon: 'dress',
            status: 'completed',
        },
        {
            title: 'No Face Coverings',
            description:
                'Ensure your face is not covered by a mask or sunglasses',
            icon: 'no-mask',
            status: 'completed',
        },
    ]

    // Default consent items
    private defaultConsentItems: ConsentItem[] = [
        {
            icon: 'video',
            title: 'Video Recording',
            description:
                'Your Video interaction session with the VKYC Virtual Agent will be in the recording mode',
        },
        {
            icon: 'camera',
            title: 'Live Photograph',
            description:
                'A live Photograph will be captured during the Video Interaction Session with the VKYC Virtual Agent',
        },
        {
            icon: 'aadhaar',
            title: 'Aadhaar Details',
            description:
                'Your Aadhaar details will be used for Aadhaar Verification in the V-CIP Process',
        },
        {
            icon: 'pan',
            title: 'PAN Card Photograph',
            description:
                'A photograph of your PAN Card will be Collected to Perform PAN Verification in the V-CIP Process',
        },
        {
            icon: 'location',
            title: 'Live Location',
            description:
                'Your live location will be Captured in the V-CIP Process',
        },
        {
            icon: 'calendar',
            title: 'Document Age',
            description:
                'The Aadhaar XML packet or Aadhaar secure QR code should not be older than 3 days',
        },
    ]

    // Default health checks
    private defaultHealthChecks: HealthCheckItem[] = [
        {
            name: 'Camera',
            icon: 'camera',
            status: 'pending',
            description: 'Checking camera access and quality',
        },
        {
            name: 'Microphone',
            icon: 'microphone',
            status: 'pending',
            description: 'Checking microphone access and quality',
        },
        {
            name: 'Location',
            icon: 'location',
            status: 'pending',
            description: 'Checking location permissions',
        },
        {
            name: 'Network Strength',
            icon: 'network',
            status: 'pending',
            description: 'Checking network connectivity',
        },
        {
            name: 'Browser',
            icon: 'browser',
            status: 'pending',
            description: 'Checking browser compatibility',
        },
        {
            name: 'VPN',
            icon: 'vpn',
            status: 'pending',
            description: 'Checking VPN status',
        },
    ]

    getInstructions(): UserInstruction[] {
        return [...this.defaultInstructions]
    }

    getConsentItems(): ConsentItem[] {
        return [...this.defaultConsentItems]
    }

    getHealthChecks(): HealthCheckItem[] {
        return [...this.defaultHealthChecks]
    }

    proceedToConsent(): void {
        this.flowState.next({
            currentStep: 'consent',
            canProceed: false,
            isComplete: false,
        })
    }

    proceedToHealthCheck(): void {
        this.flowState.next({
            currentStep: 'health-check',
            canProceed: false,
            isComplete: false,
        })
    }

    completeFlow(): void {
        this.flowState.next({
            currentStep: 'complete',
            canProceed: true,
            isComplete: true,
        })
    }

    resetFlow(): void {
        this.flowState.next({
            currentStep: 'instructions',
            canProceed: false,
            isComplete: false,
        })
    }

    getCurrentState(): PreCallFlowState {
        return this.flowState.value
    }
}
