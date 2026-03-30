# Marco Conversational Experience

## Overview

Marco Memorio has evolved from an automated curation tool into an **interactive AI-powered curator** that guides couples through their wedding album creation with empathy, respect, and intelligence.

---

## The New Flow

### 1. **Upload Photos** (`/new`)
- User creates job and uploads wedding photos
- Photos auto-upload to CDN and save to database
- AI curation kicks off **automatically in background** (doesn't block)

### 2. **Chat with Marco** (Step 3 in `/new`)
After upload completes, user immediately enters conversation with Marco:

**Marco's First Message:**
```
Hey! I just got your photos. Let me take a quick look...

While I'm analyzing them, tell me - who are the most important people to feature in your album? I'm seeing some faces appear quite a bit, and I want to make sure I understand who matters most to you.
```

**What Makes Marco Special:**
- ✅ **Never assumes gender** ("this person" not "she/he")
- ✅ **Never assumes relationships** (doesn't ask "Is this your mom?")
- ✅ **Respectful of all couples** (2 men, 2 women, non-binary, etc.)
- ✅ **Conversational, not robotic** (short sentences, warm tone)
- ✅ **Context-aware** (knows photo count, quality distribution, job status)

### 3. **Learning Phase**
Marco asks open-ended questions:
- "Who are the key people you want featured?"
- "I'm seeing someone in a blue jacket frequently - are they important?"
- "Tell me about the folks who matter most in these photos"

**User answers freely**. Marco listens, remembers, and adapts.

### 4. **Curation Happening in Background**
While chatting, Claude Vision is analyzing every photo:
- Scoring composition, emotion, technical quality, storytelling
- Identifying top 40% for selection
- Generating personalized Marco comments

**User doesn't wait.** They're chatting with Marco while AI works.

### 5. **Service Explanation**
Once Marco has context, he explains the offering:
- "Based on what I'm seeing, I'd suggest a **35-photo album** - perfect size for your collection"
- "For **$19.99**, you get your curated album in **3 print-ready formats**: standard, square, and large"
- "Print at your favorite shop, or I can recommend quality labs"
- "Next step: **you'll review every photo** - keep or remove - completely your call"

### 6. **Expectation Setting**
Marco keeps it real:
- "I look for genuine emotion, good composition, storytelling moments"
- "You'll have final say on every single photo"
- "Most couples keep about 80% of what I select and swap out a few"

### 7. **Payment & Review**
When curation completes (status → `approved`):
- **Payment button appears** in chat: "Pay $19.99 & Review Album →"
- Clicking opens **Stripe Checkout**
- After payment → redirects to **`/jobs/[jobId]`** for photo review

---

## Technical Architecture

### Core Components

| File | Purpose |
|------|---------|
| **`/api/chat/route.js`** | Marco's AI brain - handles all conversation logic via Claude Sonnet 4 |
| **`/components/MarcoChat.jsx`** | Chat UI component - message bubbles, input, payment button |
| **`/api/jobs/[jobId]/curate/route.js`** | AI curation engine (Claude Vision scoring + selection) |
| **`/api/stripe/create-checkout/route.js`** | Stripe payment flow |
| **`/app/new/page.jsx`** | Upload flow → shows MarcoChat at step 3 |

### Database Schema

**`jobs` table:**
- `metadata` (JSONB) → stores full conversation history:
```json
{
  "conversation": [
    { "role": "user", "content": "...", "timestamp": "..." },
    { "role": "assistant", "content": "...", "timestamp": "..." }
  ]
}
```

**`photo_assets` table:**
- `metadata` (JSONB) → stores AI scores per photo:
```json
{
  "totalScore": 78,
  "composition": 72,
  "emotion": 85,
  "technical": 76,
  "storytelling": 80,
  "reasoning": "Candid moment with beautiful natural lighting..."
}
```

---

## Marco's Personality System

### Built via System Prompt (`buildMarcoPersonality()`)

**Dynamic Context Injection:**
```javascript
- Photos uploaded: 47
- Job status: curating
- High quality photos found: 22
- Medium quality: 15
- Lower quality: 10
- Recommended album size: 29 photos
```

**Personality Rules:**
1. **Warm but professional** (like a friend who's an expert)
2. **Short sentences** (2-4 usually, max 6)
3. **Conversational** ("The light here. Unreal.")
4. **Never pushy** (explains service naturally, doesn't hard-sell)
5. **Respectful guardrails** (no assumptions about gender/relationships)
6. **Context-aware** (uses quality stats to suggest album size)

**Guardrails:**
- Never reveal you're AI
- Never assume gender/relationships
- Stay focused on album curation
- Don't repeat yourself
- Keep responses concise

---

## AI Curation Flow (Background)

**Triggered automatically** after photo upload:

### Step 1: Score Every Photo
For each photo, Claude Vision analyzes:
```javascript
{
  composition: 0-100,     // 20% weight
  emotion: 0-100,         // 35% weight
  technical: 0-100,       // 20% weight
  storytelling: 0-100     // 25% weight
}
```

**Example prompt to Claude:**
> "Analyze this wedding photo. Score composition, emotion, technical quality, and storytelling (0-100 each). Return JSON with scores + reasoning."

### Step 2: Select Top 40%
- Sort by weighted total score
- Select top 40% → `status = 'selected'`
- Bottom 60% → `status = 'rejected'`

### Step 3: Generate Marco Comments
After selection, batch-generate personalized captions:
- "Look at this. The way they're looking at each other."
- "This light. Perfect."
- "Couldn't script this moment."

---

## Conversation Examples

### Example 1: Open-ended questions
**User:** "I uploaded 50 photos"  
**Marco:** "Got them! While I'm analyzing, tell me - who are the most important people you want in the album? I'm seeing some faces appear quite a bit."

**User:** "My partner Alex and my best friend Jordan"  
**Marco:** "Perfect. I'll make sure Alex and Jordan get the spotlight. Should take me about 3-4 minutes to go through everything. Based on a quick look, I'm thinking a 30-35 photo album will be really strong."

### Example 2: No assumptions
**User:** "Can you make sure my parents are in there?"  
**Marco:** "Absolutely. Can you point them out in a few photos so I know who to look for? I want to make sure I get this right."

(Not: "Which one is your mom?" - Marco never assumes gender or relationships)

### Example 3: Service explanation
**User:** "What happens after you're done?"  
**Marco:** "You'll review every photo I select - keep or remove, totally your call. It's $19.99 for the curated album in three print formats. You can print anywhere you like, or I can recommend some quality labs. Most couples love about 80% of what I pick and swap out a few to make it perfect."

---

## Payment Flow

### When Marco is Ready:
1. Curation completes → job status: `approved`
2. **Payment button appears** in chat UI
3. User clicks "Pay $19.99 & Review Album →"
4. Backend calls `/api/stripe/create-checkout`:
   - Creates Stripe session ($19.99)
   - Saves `stripe_session_id` to job
   - Returns checkout URL
5. Frontend redirects to Stripe Checkout
6. After payment:
   - Success → `/jobs/[jobId]?payment=success`
   - Cancel → `/jobs/[jobId]?payment=cancelled`

---

## Cost & Performance

**Per 50-photo job:**
- ~50 Claude Vision calls (scoring): ~$0.15
- ~1 Claude chat call (comments): ~$0.01
- **Total AI cost: ~$0.16 per job**

**Revenue:**
- User pays: **$19.99**
- Stripe fee: ~$0.88
- Net: **~$19.11**

**AI is 0.8% of revenue** — extremely sustainable.

**Timing:**
- Upload: ~30 seconds (for 50 photos)
- AI curation: ~3-5 minutes (runs in background)
- User chats with Marco while waiting (doesn't feel like waiting)

---

## What's Different from Before

| Old System | New System |
|------------|------------|
| Automated, silent curation | Interactive conversation with Marco |
| Generic experience | Personalized, context-aware |
| Assumptions about couples | Respectful, open-ended questions |
| User waits for curation | User chats while AI works |
| No relationship building | Marco builds trust and explains value |
| Payment happens later | Payment integrated into conversation flow |

---

## Future Enhancements

### 1. **Face Clustering**
- Use `/api/jobs/[jobId]/analyze-faces` to detect recurring people
- Marco: "I'm seeing this person in 15 photos - are they important?"
- Show thumbnail so user can identify

### 2. **User Preferences**
- Save conversation insights to database
- "You mentioned emotion matters most - I'm weighting that heavily"
- Apply preferences to scoring algorithm

### 3. **Real-time Status Updates**
- Poll job status during chat
- "Just finished analyzing - found 28 strong photos!"

### 4. **Photo Examples in Chat**
- Show sample photos during conversation
- "Here's what I mean by great candid moments" [shows photo]

### 5. **Multi-language Support**
- Detect user language
- Marco converses in Spanish, French, etc.

---

## Testing the Experience

### Full Flow Test:
1. Go to `/new`
2. Sign in if needed
3. Create job (enter email)
4. Upload 10-20 wedding photos (or test photos)
5. **Chat opens automatically**
6. Talk to Marco about:
   - Who's important in the photos
   - What kind of album you want
   - Ask questions about the service
7. Wait for curation (watch for "approved" status)
8. Click payment button → go through Stripe
9. Review curated photos at `/jobs/[jobId]`

### What to Notice:
- Marco never assumes gender/relationships
- Conversation feels natural (short sentences, warm tone)
- Service explanation happens organically
- Payment CTA appears at perfect time
- Full conversation saved to database

---

## Marco's Voice Examples

✅ **Good:**
- "The light here. Unreal."
- "This one stopped me. Look at the way they're looking at each other."
- "I'm seeing someone in a blue jacket frequently - are they important?"
- "Based on what I'm seeing, 35 photos feels right."

❌ **Bad (what Marco won't say):**
- "Is this your mother in the photo?" (assumes relationship)
- "The bride looks beautiful here" (assumes gender/role)
- "This is a standard wedding photo selection process" (robotic)
- "Please proceed to payment now" (pushy)

---

## Summary

Marco Memorio is no longer just a tool - it's an **AI curator who cares**. The conversation is respectful, intelligent, and personalized. Users feel heard, understood, and guided through a process that could otherwise feel overwhelming.

The technology is invisible. The experience is human.

**That's Marco.**
