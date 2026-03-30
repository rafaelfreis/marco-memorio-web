# New Features Added ✨

## 1. Photo Swap/Replace 🔄
**Location:** Review page (`/jobs/[jobId]/review`)

Users can now swap out any photo they don't like with another from their collection:
- Click "⇄ Swap Photo" button during review
- Browse all available photos in a modal
- See quality scores on each thumbnail
- One-click replacement

**How it works:**
- Marks current photo as rejected
- Marks new photo as selected
- Seamlessly replaces in the review flow

---

## 2. Marco's Reasoning 🎯
**Location:** Review page (`/jobs/[jobId]/review`)

Every photo now shows WHY Marco selected it:
- **Quality Score** badge (0-100) in top-right corner
- **Detailed breakdown** showing:
  - Composition score (/10)
  - Emotion score (/10)
  - Lighting score (/10)
  - Focus score (/10)
- **AI-generated notes** explaining what makes the photo special

**Data source:**
- Stored in `photo_assets.metadata.reasoning`
- Generated during AI curation process
- Helps users understand Marco's expert eye

---

## 3. Album Size Adjustment 📊
**Location:** Job detail page (`/jobs/[jobId]`)

Users can fine-tune their album size after curation:
- Set target number of photos (10-100)
- **Add photos:** Pulls highest-scoring rejected photos
- **Remove photos:** Removes lowest-scoring selected photos
- Live feedback showing how many will be added/removed

**API Endpoint:** `/api/jobs/[jobId]/adjust-album`

**Smart selection:**
- Always uses quality scores to decide which photos to add/remove
- Maintains album quality while hitting target size

---

## 4. Real-Time Progress Updates ⚡
**Location:** Marco chat component

Users now see live updates during curation:
- **Progress bar** showing completion percentage
- **Stage indicators:**
  - "Analyzing photos..." (with count)
  - "Scoring quality..."
  - "Selecting best moments..."
  - "Finalizing album..."
- **Live photo count** (e.g., "Analyzing photo 23 of 150...")

**How it works:**
- Backend updates `jobs.metadata.curationProgress` at each step
- Frontend polls every 2 seconds when status is "curating"
- Automatically stops polling when curation completes
- Shows animated progress bar and status messages

**Progress data structure:**
```json
{
  "stage": "analyzing",
  "current": 23,
  "total": 150,
  "message": "Analyzing photo 23 of 150..."
}
```

---

## Technical Implementation

### Database Changes
- Added `metadata.curationProgress` to track real-time progress
- Added `metadata.reasoning` to store AI analysis per photo
- Quality scores stored in `metadata.totalScore`

### New API Endpoints
- `POST /api/jobs/[jobId]/adjust-album` - Adjust album size

### Enhanced Endpoints
- `POST /api/jobs/[jobId]/curate` - Now reports progress in real-time
- `GET /api/jobs/[jobId]/photos` - Returns all photos (for swapping)

### UI Components
- Swap modal with photo grid
- Progress indicator in chat
- Album size adjustment controls
- Quality score badges and reasoning display

---

## User Experience Flow

1. **Upload photos** → See real-time analysis progress
2. **Marco curates** → Watch live updates as AI scores each photo
3. **Review album** → See why each photo was selected + swap if needed
4. **Adjust size** → Fine-tune album to hit target count
5. **Finalize** → Generate PDFs in three sizes

---

## Next Steps (Optional Enhancements)

- Add photo comparison view (side-by-side before swapping)
- Allow users to set custom quality thresholds
- Add "undo" for swaps during review
- Show rejected photos gallery for manual selection
- Add album preview before payment
