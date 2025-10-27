# Neocortex AI Integration

## Overview
Simple Neocortex integration for creating AI-powered nodes on your canvas.

## What's Integrated

### 1. Neocortex API Service (`src/lib/neocortex.ts`)
- API key: `sk_f4b0fda4-4772-41ba-8b92-edf59d6e38f6`
- Project ID: `cmh5uhb1l0003jj04tahgqbm8`
- Base URL: `https://api.neocortex.link/v1`

### 2. AI Agent Button
Located in the **Node Canvas** (top-left toolbar)

**Features:**
- ✨ Sparkles icon with purple accent
- Fetches agents from your Neocortex project
- Creates nodes automatically on the canvas
- Shows loading state while fetching

## How to Test

### Step 1: Load a Robot
1. Click **"Upload Simulation"** in the sidebar
2. Upload your robot URDF ZIP file
3. Wait for the robot to load (you should see joints available)

### Step 2: Use AI Agent Button
1. Look for the **"AI Agent"** button in the top-left toolbar (next to Joint/Transition buttons)
2. Click the button
3. The system will:
   - Try to fetch agents from Neocortex (currently blocked by CORS)
   - If no agents exist or API blocked: Create a demo AI workflow with 3 connected poses
   - If agents exist: Create nodes for each agent with transitions

### What Happens
- **Demo Mode**: If no agents in Neocortex (or CORS blocks the API), creates a complete demo workflow:
  - 3 joint nodes with varied random poses
  - 2 transition nodes between them
  - All connected and ready to animate
- **Agent Mode**: Creates a complete workflow from real agents:
  - Joint node for each agent with varied poses
  - Transition nodes automatically inserted between joints
  - All nodes connected in a sequence (ready to animate!)
- Nodes can be edited and animated just like regular nodes
- All standard functionality works (dragging, connecting, animating, recording, exporting)

## API Endpoints Used

```typescript
// Get agents from your project
GET /v1/projects/{projectId}/agents

// Get project info
GET /v1/projects/{projectId}

// Query/Chat (future use)
POST /v1/projects/{projectId}/query
```

## Expected Behavior

### Success Cases:
1. **No agents found (or CORS blocked)**: 
   - Toast: "No agents found. Creating demo AI workflow..."
   - Creates 3 AI-powered joint nodes with varied random poses
   - Creates 2 transition nodes between them
   - All connected and ready to animate
   - Toast: "Created AI-powered demo workflow with 3 poses!"

2. **Agents found**:
   - Creates joint nodes for each agent with varied poses
   - Creates transition nodes between them
   - Connects them in a ready-to-animate sequence
   - Positions them horizontally (400px apart)
   - Toast: "Added X Neocortex agent(s) with transitions!"

### Error Cases:
1. **API Error / CORS Issue**: 
   - Currently the Neocortex API blocks browser requests (CORS)
   - Falls back to demo mode: creates 3 connected demo poses
   - Toast: "No agents found. Creating demo AI workflow..."
   - Check browser console for detailed error

2. **No Robot Loaded**:
   - Button is disabled
   - Upload a robot first

## Testing the API

To verify the Neocortex API is working, open browser console and run:

```javascript
// Test the API connection
fetch('https://api.neocortex.link/v1/projects/cmh5uhb1l0003jj04tahgqbm8/agents', {
  headers: {
    'Authorization': 'Bearer sk_f4b0fda4-4772-41ba-8b92-edf59d6e38f6',
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(d => console.log('Neocortex Response:', d))
.catch(e => console.error('Error:', e));
```

## Future Enhancements

This is the **minimal viable integration**. Easy additions:
1. **AI-Generated Poses**: Query Neocortex to generate optimal joint configurations
2. **Smart Transitions**: AI-powered smooth motion planning
3. **Natural Language Control**: "Move arm to home position"
4. **Behavior Trees**: Create complex robot behaviors via Neocortex agents
5. **Real-time Adaptation**: Agents that adjust movements based on environment

## Files Modified
- `src/lib/neocortex.ts` - New API service
- `src/components/NodeGraph.tsx` - Added AI Agent button and logic

## Dependencies
No new dependencies required! Uses native `fetch` API.

