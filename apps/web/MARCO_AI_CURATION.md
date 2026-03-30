# Marco AI Curation System

## Overview
Marco Memorio now uses **real AI vision** (Claude Sonnet 4) to curate wedding photos like an expert photographer with 20 years of experience.

## How It Works

### 1. Photo Scoring
Each photo is analyzed by Claude Vision on **four dimensions** (0-100 score each):

- **Composition (20% weight)**: Rule of thirds, framing, balance, visual flow
- **Emotion (35% weight)**: Genuine moments vs. posed, capturing real feeling
- **Technical Quality (20% weight)**: Focus, lighting, exposure, print-worthiness
- **Storytelling (25% weight)**: Narrative value, uniqueness for this specific wedding

**Total Score** = weighted sum of all four dimensions

### 2. Selection Process
- Photos are sorted by total score (highest to lowest)
- **Top 40%** are automatically selected for the album
- Remaining 60% are marked as rejected (but not deleted)
- Selection is stored in `photo_assets.status` field (`selected` or `rejected`)

### 3. Marco's Comments
After selection, Claude generates **personalized captions** for each selected photo in Marco's signature voice:
- Short, observational (6-12 words)
- Sometimes poetic fragments ("The light here. Unreal.")
- Never generic or cliché
- Based on what Claude actually saw in the image

**Fallback**: If AI comment generation fails, random comments from a curated pool are used.

### 4. Metadata Storage
All AI analysis is preserved in the `photo_assets.metadata` field (JSONB):
```json
{
  "composition": 85,
  "emotion": 92,
  "technical": 78,
  "storytelling": 88,
  "totalScore": 86,
  "reasoning": "Candid moment of bride's genuine laughter. Perfect composition with natural lighting."
}
```

## API Endpoints

### POST `/api/jobs/[jobId]/curate`
Triggers AI curation for all pending photos in a job.

**Authentication**: Required (session)

**Response**:
```json
{
  "success": true,
  "total": 150,
  "selected": 60,
  "rejected": 90
}
```

**Job Status Flow**:
1. `pending` → Photos uploaded, ready to curate
2. `curating` → AI is analyzing photos
3. `reviewing` → Curation complete, awaiting payment
4. `approved` → User paid, ready for PDF generation
5. `generating` → Creating PDFs
6. `completed` → PDFs generated and ready

## Automatic Curation

Curation is automatically triggered when:
- Photos are uploaded via `/api/jobs/[jobId]/photos/upload`
- The upload endpoint fires a background request to `/curate` (non-blocking)

User gets instant upload confirmation, while Marco works in the background.

## Manual Curation

Users can manually trigger curation from the homepage:
1. Enter Job ID
2. Click "Start AI Curation"
3. See progress indicator while Marco analyzes
4. Get results summary showing total/selected/rejected counts

## Performance

**Typical timing** for 100 photos:
- ~2-3 seconds per photo for Claude Vision analysis
- ~5 seconds for batch comment generation
- **Total: ~4-6 minutes** for 100 photos

**Optimization**: Photos are processed sequentially to avoid rate limits. Future enhancement: parallel processing with rate limiting.

## Error Handling

If Claude Vision API fails for a specific photo:
- Photo receives a **median score (50)** as fallback
- Curation continues with remaining photos
- Job is not aborted due to single photo failures

If comment generation fails:
- Fallback to random Marco-style comments from curated pool
- Album still gets published with quality captions

## Cost Optimization

**Current setup**: Claude Sonnet 4 (high quality, higher cost per photo)

**Alternative for scale**:
- Switch to GPT-4 Vision (`/integrations/gpt-vision/`) for faster, cheaper scoring
- Or use Claude Haiku for lower-cost batch processing
- Comments can be generated separately with cheaper model

## What's Different from Before

| Before | Now |
|--------|-----|
| Hash-based simulation | Real Claude Vision AI |
| Random selection | Intelligent scoring on 4 dimensions |
| Generic comments | AI-generated, personalized captions |
| Deterministic results | Consistent quality-based curation |

## Next Phase Ideas

1. **User preferences**: Let couples specify what matters most (emotion vs. technical quality)
2. **Face detection**: Prioritize photos with bride/groom clearly visible
3. **Diversity scoring**: Ensure album variety (close-ups, wide shots, details)
4. **Batch optimization**: Parallel processing with rate limit handling
5. **Real-time preview**: Show AI scores in UI before final selection
6. **User overrides**: Allow couples to force-include/exclude specific photos

## Testing the System

1. Create a new job: `/new`
2. Upload 20-50 photos (Google Photos or manual)
3. Trigger curation from homepage or wait for auto-trigger
4. Check database for `metadata` field to see scores
5. Generate PDFs to see final album with Marco's comments

**Database query to inspect AI scores**:
```sql
SELECT 
  filename, 
  status, 
  marco_comment,
  metadata->>'totalScore' as score,
  metadata->>'reasoning' as reasoning
FROM photo_assets
WHERE job_id = 'YOUR_JOB_ID'
ORDER BY (metadata->>'totalScore')::int DESC;
```

---

**Built with Claude Sonnet 4 Vision**  
Marco is now a real AI curator. 📸
