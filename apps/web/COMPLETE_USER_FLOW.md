# Marco Memorio — Complete User Flow

## 🎯 The Experience

**Upload → Chat → Pay → Review → Download**

---

## Step-by-Step Journey

### 1. **Landing Page** (`/`)
- User sees hero: "Your memories deserve better"
- Clicks **"Start Your Album"** → `/new`

### 2. **Upload Photos** (`/new`)
- **Step 1**: Create job (email optional)
- **Step 2**: Upload 10-200 wedding photos
- **Step 3**: Marco's chat interface appears immediately

### 3. **Chat with Marco** (Conversational AI)
Marco starts the conversation:
> "Hey! I just got your photos. While I'm analyzing them, tell me - who are the most important people to feature?"

**What happens in background:**
- AI analyzes all photos (composition, faces, emotion)
- Face detection runs
- Quality scoring happens

**Marco's conversation goals:**
1. Learn who's important ("I'm seeing this person a lot - are they important?")
2. Explain the service ($19.99, 3 formats, print-ready)
3. Set expectations ("You'll have final say on every photo")
4. Suggest album size based on quality findings

**No assumptions:**
- Never assumes gender
- Never assumes relationships ("Is this your mom?")
- Uses "they/them" or "this person"
- Asks open questions

**Status Updates in Chat:**
- "Analyzing 87 photos now..."
- "Found 42 strong candidates"
- "Your album is ready to review!"

### 4. **Payment** (When curation completes)
**Trigger:** Job status changes to `approved`

**In chat:** Payment button appears
> "Pay $19.99 & Review Album →"

**Flow:**
1. User clicks → Stripe Checkout opens
2. User pays $19.99
3. Webhook updates: `stripe_payment_status = 'paid'`, `status = 'reviewing'`
4. Chat shows: **"Review Photos Now →"** button

### 5. **Review Photos** (`/jobs/[jobId]/review`)
**Swipe-style interface:**
- One photo at a time, full screen
- Marco's comment shows if he left one
- Progress bar: "23 of 45"
- Counter: "Keeping 38 of 45 photos"

**Controls:**
- ✓ **Keep** (green button or Enter)
- ✕ **Remove** (red button or Backspace)
- ← **Previous** (go back to change decision)
- Keyboard shortcuts work throughout

**Last Photo:**
- Shows all 3 buttons + **"Finalize Album →"**
- User confirms final selections
- Status → `approved`

### 6. **Download PDFs** (`/jobs/[jobId]`)
After finalizing:
- User sees their selected photos grid
- Clicks **"Generate PDFs"**
- AI creates 3 print-ready albums:
  - 8.5" × 11" (standard)
  - 8" × 8" (square)
  - 12" × 12" (large)

**Download buttons appear:**
- Standard Format
- Square Format  
- Large Format

**Users can:**
- Print at their favorite shop
- Use our recommended print labs
- Download and keep digital copies

---

## 🔄 Status Flow

```
pending → curating → approved → [PAYMENT] → reviewing → approved → generating → completed
```

### Status Definitions:
- **pending**: Job created, waiting for photos
- **curating**: AI is analyzing photos (background)
- **approved**: Curation complete, ready for payment
- **reviewing**: User paid, now reviewing photo-by-photo
- **approved** (after review): User finalized selections
- **generating**: PDFs being created
- **completed**: Everything done, PDFs ready

---

## 💳 Payment States

```sql
stripe_payment_status:
- null → pending → paid
```

**Webhook Events:**
- `checkout.session.completed` → status = 'paid', job status = 'reviewing'
- `checkout.session.expired` → status = 'expired'

---

## 🗨️ Marco's Personality

**Built with Claude Sonnet 4**

**Core Traits:**
- Warm, professional, empathetic
- Short sentences ("The light here. Unreal.")
- Never robotic or scripted
- Respectful of all couples/families
- Context-aware (knows photo count, quality stats)

**Conversation Guardrails:**
- ✅ Ask open questions
- ✅ Use inclusive language
- ✅ Respect user's time
- ❌ Never assume gender
- ❌ Never assume relationships
- ❌ Never pushy about sales

**Sample Conversation:**
> **Marco:** "I'm seeing someone in a blue suit appear in 18 photos. Are they important to feature?"
>
> **User:** "Yes, that's my partner Alex"
>
> **Marco:** "Perfect. I'll make sure Alex gets plenty of moments. Based on what I'm finding, a 35-photo album will be really strong."

---

## 📊 Database Schema

### Jobs Table
```sql
- id (uuid)
- user_id (int) → auth_users
- status (text): pending | curating | reviewing | approved | generating | completed | failed
- email (text)
- photo_count (int)
- selected_count (int)
- stripe_session_id (text)
- stripe_payment_status (text): pending | paid | expired
- pdf_url (text)
- pdf_url_square (text)
- pdf_url_large (text)
- metadata (jsonb) → stores conversation history
```

### Photo Assets Table
```sql
- id (uuid)
- job_id (uuid) → jobs
- user_id (int) → auth_users
- filename (text)
- download_url (text)
- preview_url (text)
- thumbnail_url (text)
- marco_comment (text) ← Marco's notes on this photo
- status (text): pending | selected | rejected | deleted
- sort_order (int)
- metadata (jsonb) → AI scores, face data, etc.
```

---

## 🎨 Design Principles

**Colors:**
- Dark backgrounds: `#1a1a1a`, `#2d2d2d`
- Light surfaces: `#fafaf8`, `#f0f0e8`
- Text: `#2a2a2a`, `#6a6a6a`
- Accent: `#f5f5f0` (warm white)

**Typography:**
- Headers: `font-crimson-text` (serif, elegant)
- Body: System fonts (clean, readable)
- Emphasis: Italic for Marco's voice

**Spacing:**
- Generous padding (album design feels premium)
- Clean white space
- Rounded corners (modern but timeless)

---

## 🚀 Future Enhancements

**Potential Features:**
1. **Show photo thumbnails in chat** - "Is this person important?" with image
2. **Real-time status updates** - WebSocket for live progress
3. **Mobile app** - React Native version with swipe gestures
4. **Print lab integration** - Direct ordering from recommended labs
5. **Album previews** - Before payment, show mockup of final album
6. **Multiple albums** - Let users create variations (family-only, ceremony-only)
7. **Collaborative review** - Share with partner, both approve photos
8. **Face tagging** - "Tag Alex so I prioritize their photos"

---

## 📱 Mobile Considerations

**Current (Web-First):**
- Responsive design
- Touch-friendly buttons
- Mobile chat works great

**Future Native App:**
- Swipe gestures for Keep/Remove
- Native photo picker
- Push notifications when curation completes
- Offline review (sync decisions later)

---

## 🔐 Security & Privacy

**Authentication:**
- Google sign-in enabled
- Email/password enabled
- Sessions via NextAuth

**Privacy:**
- Photos stored securely (Uploadcare CDN)
- User controls all final selections
- PDFs downloadable, then deletable
- No photos used for training (clear policy)

**Payment:**
- Stripe for secure checkout
- No storing credit cards
- Webhook verification for payment confirmation

---

**Built with care by Marco Memorio** 🎉
