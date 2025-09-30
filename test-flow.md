# VKYC Flow Test

## Expected Flow:

1. **Initial Load**:

    - User sees "Welcome to Video KYC Process" instructions
    - No agent loading should occur
    - `isAgentLoading` should be `false`

2. **Instructions Step**:

    - User sees instruction checklist
    - User clicks "Proceed to Consent"
    - Flow moves to consent step

3. **Consent Step**:

    - User sees consent items
    - User agrees and clicks "Proceed"
    - Flow moves to health check step

4. **Health Check Step**:

    - User sees health check items
    - System runs health checks automatically
    - User clicks "Proceed" when checks complete
    - Flow completes pre-call phase

5. **Start Call Screen**:

    - User sees "Ready to Start" screen with green checkmark
    - "Start Video Call" button is visible
    - `canStartCall` should be `true`
    - Still no agent loading

6. **Start Call**:
    - User clicks "Start Video Call" button
    - Agent loading begins (`isAgentLoading` becomes `true`)
    - API call to `/api/v1/sessions/join-agent` is made
    - Video call interface appears

## Key Changes Made:

1. ✅ Removed immediate agent loading from `ngOnInit()`
2. ✅ Added `canStartCall` state management
3. ✅ Added "Start Call" button in layout component
4. ✅ Updated flow to only initialize agent when user clicks "Start Call"
5. ✅ Fixed TypeScript interface to include 'complete' state
6. ✅ Updated event handlers to not auto-join call

## Test Commands:

```bash
# Build the project
cd web && npm run build

# Start development server
cd web && npm start

# Navigate to http://localhost:4200/kyc
```

## Expected Behavior:

-   No "Loading Agent" spinner on initial load
-   Pre-call flow works step by step
-   "Start Call" button appears after health check
-   Agent only loads when user explicitly starts the call
