# Journey System Documentation

## Overview

The Journey System is a comprehensive, generic, and reusable framework for tracking user progress through multi-step workflows. It's designed with mobile-first responsive design and provides real-time progress tracking with session persistence.

## Architecture

### Core Components

1. **Models** (`journey.models.ts`)

    - Type definitions for journey data structures
    - Status enums and interfaces
    - Configuration and validation types

2. **Base Service** (`base-journey.service.ts`)

    - Abstract base class for journey services
    - Generic journey management functionality
    - Event system and state management

3. **VKYC Service** (`vkyc-journey.service.ts`)

    - VKYC-specific implementation
    - Extends base service with VKYC workflow steps
    - Domain-specific methods

4. **State Service** (`journey-state.service.ts`)

    - Integrates journey with workflow system
    - Provides combined state management
    - Workflow phase detection

5. **Utils Service** (`journey-utils.service.ts`)

    - Common utility functions
    - UI helpers and formatters
    - Validation and data processing

6. **Progress Component** (`journey-progress.component.ts`)
    - Reusable UI component
    - Mobile-first responsive design
    - Real-time progress display

## Features

### ✅ Implemented Features

-   **Generic Architecture**: Base service can be extended for any workflow
-   **Session Persistence**: Automatic save/load from sessionStorage
-   **Real-time Updates**: Reactive state management with RxJS
-   **Mobile-First Design**: Fully responsive with iPad optimizations
-   **Event System**: Comprehensive event tracking and notifications
-   **Type Safety**: Full TypeScript support with strict typing
-   **Validation**: Built-in data validation and error handling
-   **Progress Tracking**: Real-time progress calculation and display
-   **Step Dependencies**: Support for step dependencies and ordering
-   **Status Management**: Multiple status types (pending, in_progress, completed, failed, skipped)

### 🎯 VKYC-Specific Features

-   **Pre-call Steps**: Health check, consent, instructions
-   **In-call Steps**: Frame capture, questionnaire
-   **Post-call Steps**: Verification, completion
-   **Integration**: Seamless integration with VKYC workflow
-   **Data Tracking**: Capture type, quality scores, questionnaire data

## Usage

### Basic Usage

```typescript
// Inject the service
constructor(private journeyService: VkycJourneyService) {}

// Update step status
this.journeyService.updateStepStatus('health_check', 'completed', { networkSpeed: 'fast' })

// Get progress
const progress = this.journeyService.getProgress()

// Subscribe to changes
this.journeyService.journeyData$.subscribe(data => {
    // Handle journey data changes
})
```

### Component Usage

```html
<app-journey-progress
    [showDetails]="true"
    [showProgressBar]="true"
    [showTimestamps]="true"
    [compactMode]="false">
</app-journey-progress>
```

### State Management

```typescript
// Inject state service
constructor(private journeyState: JourneyStateService) {}

// Get combined state
const state = this.journeyState.getCurrentState()

// Check workflow phase
const phase = this.journeyState.getCurrentPhase()

// Check if workflow can start
const canStart = this.journeyState.canStartWorkflow()
```

## Data Structure

### JourneyStep

```typescript
interface JourneyStep {
    id: string // Unique identifier
    title: string // Display title
    type: JourneyStepType // pre_call | in_call | post_call
    status: JourneyStepStatus // pending | in_progress | completed | failed | skipped
    data?: Record<string, any> // Step-specific data
    timestamp?: string // Completion timestamp
    description?: string // Step description
    order?: number // Display order
    dependencies?: string[] // Step dependencies
    metadata?: Record<string, any> // Additional metadata
}
```

### JourneyData

```typescript
interface JourneyData {
    preCallSteps: JourneyStep[] // Pre-call workflow steps
    inCallSteps: JourneyStep[] // In-call workflow steps
    postCallSteps: JourneyStep[] // Post-call workflow steps
    overallStatus: JourneyOverallStatus // Overall journey status
    sessionId?: string // Session identifier
    startedAt?: string // Journey start time
    completedAt?: string // Journey completion time
    metadata?: Record<string, any> // Additional metadata
}
```

## Responsive Design

### Mobile-First Approach

-   **Base styles**: 320px+ (mobile)
-   **Small devices**: 576px+ (landscape phones)
-   **Medium devices**: 768px+ (tablets)
-   **Large devices**: 992px+ (desktops)
-   **Extra large**: 1200px+ (large desktops)

### iPad Optimizations

-   **Specific breakpoints**: 768px-1024px
-   **Touch-friendly**: 44px minimum touch targets
-   **Optimized spacing**: Reduced padding for tablet screens
-   **Landscape/portrait**: Proper orientation support

### CSS Classes

```css
/* Mobile-first base styles */
.journey-step {
    flex-direction: column;
    padding: 0.5rem;
}

/* Responsive breakpoints */
@media (min-width: 576px) {
    .journey-step {
        flex-direction: row;
    }
}

/* iPad specific */
@media (min-width: 768px) and (max-width: 1024px) {
    .journey-step {
        padding: 0.75rem 1rem;
    }
}
```

## Event System

### Event Types

-   `step_started`: Step begins
-   `step_completed`: Step finishes successfully
-   `step_failed`: Step fails
-   `step_skipped`: Step is skipped
-   `journey_completed`: All steps completed
-   `journey_failed`: Journey fails

### Event Subscription

```typescript
this.journeyService.events$.subscribe((event) => {
    switch (event.type) {
        case 'step_completed':
            // Handle step completion
            break
        case 'journey_completed':
            // Handle journey completion
            break
    }
})
```

## Storage

### Session Storage

-   **Key**: `vkyc_journey_data`
-   **Format**: JSON string
-   **Auto-save**: On every step update
-   **Auto-load**: On service initialization
-   **Cleanup**: On session end

### Data Persistence

```typescript
// Automatic save
this.journeyService.updateStepStatus('step_id', 'completed')

// Manual save (if auto-save disabled)
this.journeyService.saveToStorage()

// Clear storage
this.journeyService.clearStorage()
```

## Integration

### Workflow Integration

The journey system integrates seamlessly with the VKYC workflow:

```typescript
// Pre-call steps
onInstructionsProceed() {
    this.journeyService.updateInstructionsStatus(true)
}

onConsentProceed() {
    this.journeyService.updateConsentStatus(true)
}

onHealthCheckProceed(data) {
    this.journeyService.updateHealthCheckData(data)
}

// In-call steps
onImageUploadSuccess(result) {
    this.journeyService.updateFrameCaptureStatus(stepId, 'completed', data)
}

onQuestionnaireCompletion(stepId, answers) {
    this.journeyService.updateQuestionnaireStatus(stepId, 'completed', data)
}
```

### State Synchronization

The `JourneyStateService` provides real-time synchronization between journey and workflow states:

```typescript
// Combined state
const state = this.journeyState.getCurrentState()

// Workflow phase detection
const phase = this.journeyState.getCurrentPhase()

// Progress tracking
const progress = this.journeyState.getWorkflowCompletionPercentage()
```

## Best Practices

### 1. Service Injection

Always inject the appropriate service:

```typescript
// For VKYC-specific operations
constructor(private journeyService: VkycJourneyService) {}

// For state management
constructor(private journeyState: JourneyStateService) {}

// For utilities
constructor(private utils: JourneyUtilsService) {}
```

### 2. Error Handling

Always handle errors gracefully:

```typescript
try {
    this.journeyService.updateStepStatus(stepId, 'completed', data)
} catch (error) {
    console.error('Failed to update step:', error)
    // Handle error appropriately
}
```

### 3. Memory Management

Unsubscribe from observables:

```typescript
ngOnDestroy(): void {
    this.subscriptions.unsubscribe()
}
```

### 4. Data Validation

Validate step data before updates:

```typescript
const validation = this.utils.validateStepData(step)
if (!validation.isValid) {
    console.error('Invalid step data:', validation.errors)
    return
}
```

## Future Enhancements

### Planned Features

-   **Analytics**: Journey analytics and reporting
-   **Customization**: Theme and styling customization
-   **Accessibility**: Enhanced accessibility features
-   **Testing**: Comprehensive test coverage
-   **Documentation**: API documentation generation

### Extension Points

-   **Custom Services**: Extend BaseJourneyService for other workflows
-   **Custom Components**: Create specialized progress components
-   **Custom Utils**: Add domain-specific utility functions
-   **Custom Events**: Define custom event types

## Troubleshooting

### Common Issues

1. **Step not updating**: Check if step ID exists and is correct
2. **Storage not persisting**: Verify sessionStorage is available
3. **UI not responsive**: Check CSS breakpoints and mobile-first approach
4. **Events not firing**: Ensure proper subscription and error handling

### Debug Mode

Enable debug logging:

```typescript
// Check console for journey-related logs
// Look for 🎯 JOURNEY: prefixed messages
```

## Conclusion

The Journey System provides a robust, scalable, and maintainable solution for tracking user progress through complex workflows. Its generic architecture makes it suitable for various use cases beyond VKYC, while its mobile-first design ensures excellent user experience across all devices.
