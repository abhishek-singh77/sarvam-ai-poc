import { Injectable } from '@angular/core'
import { BehaviorSubject } from 'rxjs'

@Injectable({ providedIn: 'root' })
export class VkycQuestionnaireFacadeService {
    answers$ = new BehaviorSubject<{ [key: string]: any }>({})
    isVoiceActive$ = new BehaviorSubject<boolean>(false)
    currentQuestion$ = new BehaviorSubject<any>(null)

    constructor() {}

    updateAnswer(questionTitle: string, answer: string): void {
        const current = this.answers$.value
        this.answers$.next({ ...current, [questionTitle]: answer })
    }

    startVoiceRecognition(question: any): void {
        this.currentQuestion$.next(question)
        this.isVoiceActive$.next(true)
        // In real implementation, integrate with speech-to-text service
        console.log('🎯 QUESTIONNAIRE-FACADE: Starting voice recognition for:', question.title)
    }

    stopVoiceRecognition(): void {
        this.isVoiceActive$.next(false)
        this.currentQuestion$.next(null)
    }

    submitAnswers(): { [key: string]: any } {
        const answers = this.answers$.value
        console.log('🎯 QUESTIONNAIRE-FACADE: Submitting answers:', answers)
        return answers
    }

    clearAnswers(): void {
        this.answers$.next({})
    }
}
