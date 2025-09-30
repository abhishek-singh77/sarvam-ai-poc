export function safeTitle(text?: string | null): string {
    return (text || '').trim()
}

export function percentage(completed: number, total: number): number {
    if (!total) return 0
    return Math.round((completed / total) * 100)
}
