import { Component, Input, Output, EventEmitter } from '@angular/core'
import { CommonModule } from '@angular/common'

export interface AnalysisData {
    captureType: string
    analysisResult: any
    parsedAnalysis?: any
    recommendations?: string[]
}

@Component({
    selector: 'app-analysis-display',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './analysis-display.component.html',
    styleUrls: ['./analysis-display.component.css'],
})
export class AnalysisDisplayComponent {
    @Input() analysisData: AnalysisData | null = null
    @Input() showActions: boolean = true
    @Output() retakeRequested = new EventEmitter<void>()
    @Output() continueRequested = new EventEmitter<void>()

    getAnalysisSummary(): string {
        if (!this.analysisData?.analysisResult) {
            return 'Analysis completed successfully'
        }

        const analysis = this.getParsedAnalysis()
        const captureType = this.analysisData.captureType

        if (captureType === 'FACE_CAPTURE') {
            return `Face detected: ${
                analysis.face_detected ? 'Yes' : 'No'
            } | Quality: ${analysis.image_quality || 'Unknown'} | Confidence: ${
                (analysis.confidence_score * 100)?.toFixed(1) || 'Unknown'
            }%`
        } else if (captureType === 'DOCUMENT_CAPTURE') {
            return `Document detected: ${
                analysis.document_detected ? 'Yes' : 'No'
            } | Quality: ${analysis.image_quality || 'Unknown'} | Confidence: ${
                (analysis.confidence_score * 100)?.toFixed(1) || 'Unknown'
            }%`
        }

        return 'Analysis completed successfully'
    }

    getRecommendations(): string[] {
        if (!this.analysisData?.analysisResult) {
            return []
        }

        const analysis = this.getParsedAnalysis()
        return analysis.recommendations || []
    }

    getParsedAnalysis(): any {
        if (!this.analysisData?.analysisResult) {
            return {}
        }

        // Use cached parsed analysis if available
        if (this.analysisData.parsedAnalysis) {
            return this.analysisData.parsedAnalysis
        }

        // Parse the analysis JSON if it's a string
        try {
            if (
                this.analysisData.analysisResult?.analysis &&
                typeof this.analysisData.analysisResult.analysis === 'string'
            ) {
                return JSON.parse(this.analysisData.analysisResult.analysis)
            }
            return this.analysisData.analysisResult
        } catch (error) {
            console.error('Failed to parse analysis result:', error)
            return this.analysisData.analysisResult
        }
    }

    onRetake(): void {
        this.retakeRequested.emit()
    }

    onContinue(): void {
        this.continueRequested.emit()
    }

    isFaceCapture(): boolean {
        return this.analysisData?.captureType === 'FACE_CAPTURE'
    }

    isDocumentCapture(): boolean {
        return this.analysisData?.captureType === 'DOCUMENT_CAPTURE'
    }
}
