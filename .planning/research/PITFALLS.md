# Pitfalls Research

**Domain:** iPad-first field service form app (pool installation crews, photo capture, email submission)
**Researched:** 2026-03-25
**Confidence:** HIGH (critical pitfalls verified across multiple sources; iPad Safari behaviors confirmed via Apple Developer Forums)

## Critical Pitfalls

### Pitfall 1: Photo Payload Blows Past Email Size Limits

**What goes wrong:**
Pool crews take 10-20+ photos per job with modern iPad cameras (12MP+). Each photo is 4-10MB as JPEG. A 15-photo submission at 5MB each = 75MB of attachments. Resend's API limit is 40MB per email (after Base64 encoding, which inflates by ~33%). SendGrid's recommended limit is 20MB. Gmail and most inboxes cap at 25MB receiving. The email silently fails, bounces, or gets rejected -- and the crew thinks they submitted successfully.

**Why it happens:**
Developers test with 2-3 photos in good lighting. Production crews take 15+ photos in varied conditions. Nobody calculates the Base64 inflation (a 30MB attachment set becomes ~40MB encoded). The math only fails at real-world scale.

**How to avoid:**
- Compress photos client-side before submission. Use canvas-based compression to resize to a reasonable max dimension (e.g., 1600px long edge) and quality (0.7-0.8 JPEG). This drops a 5MB photo to ~200-400KB.
- Set a hard ceiling: if total payload exceeds 20MB after compression, warn the user before attempting submission.
- Alternative architecture: upload photos to cloud storage (S3, Cloudflare R2) and email links/thumbnails instead of raw attachments. This is the correct long-term pattern.
- If emailing attachments directly, batch into multiple emails if necessary.

**Warning signs:**
- Test submission works fine (2-3 small photos). Real crew submissions bounce.
- Office reports "we never got the photos for job X" but crew says they submitted.
- Email delivery logs show 413/payload-too-large errors or silent drops.

**Phase to address:**
Phase 1 (core architecture) -- the photo handling strategy (compress + upload to storage vs. direct email attachment) is a foundational decision that affects the entire data flow. Getting this wrong means a rewrite.

---

### Pitfall 2: iPad Safari Destroys Form Data on Accidental Navigation

**What goes wrong:**
A field worker fills in a 20-field form over 10 minutes, accidentally swipes back in Safari, taps a bookmark, or Safari reloads the page due to memory pressure. All form data is gone. The `beforeunload` event -- the standard web mechanism to warn users before leaving -- does NOT work on iOS Safari. It is simply not fired. The worker has to start over, or worse, gives up and goes back to paper.

**Why it happens:**
Developers test on desktop Chrome where `beforeunload` works perfectly. iPad Safari has intentionally never supported `beforeunload` reliably. Touch-based navigation makes accidental swipe-back extremely easy. iOS Safari also aggressively kills background tabs to reclaim memory, discarding page state.

**How to avoid:**
- Auto-save form data to `localStorage` or `sessionStorage` on every field change (debounced, every 1-2 seconds). On page load, check for saved state and restore it.
- Use the `pagehide` and `visibilitychange` events (which DO fire on iOS Safari) as save triggers.
- Display a visual "saved" indicator so workers know their data is safe.
- For a PWA: be aware that iOS clears all script-writable storage (localStorage, IndexedDB, Cache API) if the PWA hasn't been opened in 7 days. For a tool used daily this is fine, but flag it.
- Consider disabling Safari's swipe-to-go-back gesture via CSS `overscroll-behavior-x: none` on the form container.

**Warning signs:**
- "I filled out the form and it disappeared" complaints from field testers.
- No localStorage save/restore logic exists in the codebase.
- Testing only on desktop browsers.

**Phase to address:**
Phase 1 (form implementation) -- auto-save must be baked in from the first form field, not bolted on later.

---

### Pitfall 3: HEIC Photo Format Chaos

**What goes wrong:**
iPads default to HEIC (High Efficiency Image Container) format for photos. When a user takes a photo via `<input type="file" capture="environment">`, Safari's behavior around HEIC/JPEG conversion is inconsistent and version-dependent. Safari 17+ sometimes auto-converts to JPEG, sometimes delivers HEIC. If the backend or email client doesn't handle HEIC, photos appear as broken attachments. The office staff on Windows PCs may not be able to view HEIC files at all.

**Why it happens:**
Apple's conversion behavior varies based on the `accept` attribute, how the photo was taken (camera vs. photo library), and the Safari version. Developers who test on simulators or recent iOS versions may see auto-conversion, while older iPads in the field deliver raw HEIC. Windows has limited HEIC support (requires a codec install from the MS Store).

**How to avoid:**
- Always convert photos to JPEG on the client side before upload, regardless of input format. Use `canvas.toBlob('image/jpeg', quality)` or the `heic2any` library as a fallback.
- Set `accept="image/jpeg,image/png"` on file inputs (but don't rely on this alone -- Safari may still deliver HEIC).
- Validate file type server-side and convert HEIC to JPEG before emailing.
- Test on actual iPads with HEIC enabled (Settings > Camera > Formats > High Efficiency), not just simulators.

**Warning signs:**
- `.heic` file extensions appearing in upload logs.
- Office staff reporting "can't open photo attachment" on Windows.
- Photos display fine in the app but break in email.

**Phase to address:**
Phase 1 (photo capture implementation) -- format handling must be part of the photo pipeline from day one.

---

### Pitfall 4: UI Unusable in Field Conditions

**What goes wrong:**
The app looks great in an air-conditioned office. On a job site in full sun with dirty/wet hands and gloves, workers can't see the screen (glare), can't hit small buttons (fat fingers, gloves), and can't read small text. They abandon the app and ask for paper forms back. 88% of users don't return after a poor experience.

**Why it happens:**
Developers design for themselves (tech-savvy, indoors, clean hands). Pool installation happens outdoors in bright sun. Workers may have wet or dirty hands. The target users are explicitly non-technical people who are already skeptical of "yet another app."

**How to avoid:**
- Minimum touch targets of 48x48px (better: 54px+) with 8px+ spacing between targets.
- High contrast colors: near-black on white, avoid light grays. Test with a contrast checker (WCAG AA minimum, ideally AAA).
- Large form labels and input fields (minimum 16px font to prevent iOS Safari zoom-on-focus, ideally 18-20px).
- One-column layout only. No side-by-side fields on mobile/tablet.
- Big, obvious primary action buttons. "SUBMIT" should be unmissable.
- Test on an actual iPad, outdoors, with wet fingers. If you can't do this, you haven't tested.

**Warning signs:**
- Designed desktop-first and "also works on tablet."
- Touch targets smaller than 44px.
- Font sizes below 16px on form inputs.
- No outdoor/real-conditions testing.

**Phase to address:**
Phase 1 (UI/layout foundation) -- layout decisions cascade through every screen. Set the large-touch, high-contrast pattern from the first screen.

---

### Pitfall 5: AI Form Template Generation Produces Unusable Output

**What goes wrong:**
The project plans to use AI vision to generate a digital form template from a photo of the paper form. The AI misreads handwritten field labels, misidentifies checkbox vs. text input fields, gets field ordering wrong, or produces a form that technically matches the paper but is painful to fill out on a touchscreen. The boss looks at it, says "this isn't right," and the developer spends more time fixing AI output than they would have spent manually building the form.

**Why it happens:**
Paper forms for construction trades are often photocopied multiple times (degraded quality), have handwritten annotations, use domain-specific abbreviations, and have complex layouts (tables, nested sections, checkboxes mixed with text fields). AI OCR achieves 95-99% on clean printed text but drops significantly on real-world construction forms. Even 95% accuracy on a 30-field form means 1-2 fields are wrong.

**How to avoid:**
- Treat AI generation as a starting point, not a finished product. Build a form editor UI so the generated template can be manually corrected.
- Validate the generated form with the business owner before deploying to crews.
- Have a fallback: if the AI output is bad, the developer or owner can manually define the form template in ~30 minutes. Don't let this block the entire project.
- Use a high-quality photo: coach the user to take a clear, flat, well-lit photo of the paper form.
- Consider using GPT-4o or Claude vision API which handle form structure better than pure OCR.

**Warning signs:**
- No form editor exists -- the app only uses AI-generated output directly.
- No human review step between AI generation and deployment.
- Paper form photo is low quality (angled, shadowed, folded).

**Phase to address:**
Phase 2 (form template creation) -- build the form editor first, then add AI generation as an accelerator. Not the other way around.

---

### Pitfall 6: Email Delivery Looks Successful But Isn't

**What goes wrong:**
The app calls the email API, gets a 200 OK, shows the worker "Submitted!" -- but the email never arrives. It's in a spam folder, the recipient's mailbox is full, the domain isn't verified, or the email provider is rate-limiting. The crew thinks the job is done. The office never gets the form. Nobody knows until days later when the office asks "where's the paperwork for the Johnson pool?"

**Why it happens:**
Email API 200 responses mean "accepted for delivery," not "delivered to inbox." Email deliverability is a complex separate concern. Without domain verification (SPF, DKIM, DMARC), emails from the app domain land in spam. Small business email accounts often have aggressive spam filters.

**How to avoid:**
- Set up proper email authentication: SPF, DKIM, and DMARC records for the sending domain. This is non-negotiable.
- Use a reputable transactional email service (Resend, SendGrid, Postmark) -- never send from your own server.
- Implement a submission log: store every submission with status, so if email fails, the data isn't lost.
- Build a simple "submission history" screen so crews and office can verify submissions went through.
- Set up delivery webhooks from the email provider to track bounces and failures.
- Test with the actual recipient email address (not just your own Gmail).

**Warning signs:**
- No email domain authentication configured.
- No submission history or delivery tracking.
- Only tested with developer email addresses.
- Office says "we sometimes don't get the emails."

**Phase to address:**
Phase 1 (email infrastructure) -- domain verification and delivery testing must happen before any field testing, or you'll waste everyone's time debugging phantom delivery issues.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Emailing full-size photo attachments instead of cloud storage links | Simpler architecture, no storage to manage | Hits email size limits fast, slow delivery, large attachments rejected | Never for 10+ photos. Acceptable for 1-3 compressed photos in MVP only |
| No auto-save on forms | Faster to build | Workers lose data, abandon app | Never -- auto-save is minimal effort and critical for trust |
| Skipping client-side image compression | Photos look higher quality | Uploads take forever on cell data, email limits hit | Never for a photo-heavy field app |
| Hardcoding the form template | Ships faster than building a form editor | Can't adapt when the boss wants to change a field | MVP only, with clear plan to add editor |
| No submission tracking/history | Less UI to build | Can't verify delivery, can't resend, can't debug | First demo only -- add before real field use |
| Skipping email domain verification | Faster initial setup | Emails land in spam, delivery unreliable | Never -- 30 minutes of DNS setup prevents weeks of debugging |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Resend/SendGrid email API | Attaching Base64-encoded photos directly (40MB limit hit fast) | Upload photos to cloud storage, email links + thumbnails. Or compress aggressively. |
| Resend/SendGrid email API | Not setting up SPF/DKIM/DMARC | Configure all three DNS records before first send. Test with mail-tester.com |
| iPad Camera via `<input type="file">` | Assuming photos are always JPEG | Handle HEIC format: validate and convert server-side, or use canvas client-side |
| iPad Camera via `<input type="file">` | Using `accept="image/*"` and hoping for the best | Explicitly set `accept="image/jpeg,image/png"` and still validate/convert on receipt |
| AI Vision API (GPT-4o/Claude) | Sending a single prompt and using raw output as the form template | Use structured output (JSON schema), validate against expected field types, always include human review step |
| localStorage on iOS Safari | Storing critical data only in localStorage | iOS clears storage after 7 days of non-use. Use as cache/auto-save only, not as primary data store. Submissions must go to the server. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Uploading uncompressed photos over cellular | 30+ second upload times, timeouts, failed submissions | Client-side compression to ~200-400KB per photo before upload | First real job site with 10+ photos on LTE |
| Rendering many full-size photo thumbnails | Page jank, memory warnings, Safari tab reload | Generate actual thumbnails (e.g., 200px wide) for preview, keep originals separate | 8+ photos displayed simultaneously |
| Loading all submission history at once | Slow page load as submissions accumulate | Paginate or lazy-load history | After ~50 submissions |
| No upload progress indicator | Workers tap submit repeatedly thinking it's stuck | Show progress bar or spinner with photo count (e.g., "Uploading 3 of 12...") | First submission with more than 3 photos |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No authentication at all (per PROJECT.md: "no worker accounts for v1") | Anyone with the URL can submit fake jobs, spam the office email, or view submitted data | At minimum: use an unguessable URL path or a simple shared PIN. Not a login system -- just a lightweight gate. |
| Storing photos with predictable URLs (e.g., sequential IDs) | Anyone can enumerate and view all job site photos | Use random UUIDs for stored photo URLs, or signed URLs with expiration |
| Emailing form data in plain text | Sensitive job info (addresses, customer names) visible to anyone who intercepts | Use TLS for email (standard with Resend/SendGrid), but be aware email is inherently not encrypted end-to-end. Acceptable for this use case. |
| API keys in client-side code | Anyone can inspect the page source and steal email/AI API keys | All API calls (email, AI) must go through your own backend. Never put API keys in frontend JavaScript. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Tiny form controls designed for mouse precision | Workers can't tap fields reliably, especially outdoors with dirty/wet hands | 48px+ touch targets, 8px+ spacing, full-width inputs |
| Small text (below 16px) on form inputs | iOS Safari auto-zooms on focus for inputs with font-size < 16px, disorienting the user | Set `font-size: 16px` minimum on all inputs (prevents Safari zoom), ideally 18-20px |
| No visual confirmation after submission | Worker unsure if it worked, taps submit again (duplicate submission) | Show a clear full-screen success state with job name, disable submit button during processing |
| Multi-step form with no progress indicator | Worker doesn't know how much is left, may abandon | If multi-step: show step count. Better: single scrollable page for a simple form |
| Generic error messages ("Something went wrong") | Non-technical worker has no idea what to do | Specific, actionable messages: "Photos too large -- try removing some" or "No internet -- saved for later" |
| Requiring exact data entry (dates in specific format, precise measurements) | Workers enter data "wrong" and get frustrated by validation | Use date pickers, dropdowns, and forgiving input parsing. Accept "6ft" and "6'" interchangeably. |
| Icons without labels | Non-technical users don't recognize icon meanings | Always pair icons with text labels, especially for primary actions |

## "Looks Done But Isn't" Checklist

- [ ] **Photo capture:** Test taking 15+ photos in one session on an actual iPad -- memory pressure may cause Safari to reload the page and lose all photos
- [ ] **Email delivery:** Send test submissions to the actual office email address (not developer Gmail) -- spam filters differ per provider
- [ ] **Form submission:** Test with cellular data (not WiFi) and with slow/intermittent connection -- upload may time out
- [ ] **HEIC handling:** Take a photo with an iPad set to "High Efficiency" mode and verify the office can open it on Windows
- [ ] **Form auto-save:** Fill half the form, kill Safari, reopen -- does the data survive?
- [ ] **Outdoor usability:** Use the app outside in bright sunlight and verify text/buttons are readable and tappable
- [ ] **Duplicate submission:** Tap submit twice quickly -- does it send two emails?
- [ ] **Empty required fields:** Submit with missing required fields and verify errors are clear and visible (not a red border on a field scrolled offscreen)
- [ ] **Long form scroll:** Fill out a 20+ field form and verify the submit button doesn't require hunting

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Photos lost on submission failure (no local backup) | HIGH -- photos may be unrecoverable | Rearchitect: upload photos to cloud storage first, then reference in email. Never attach directly without a backup copy. |
| Email deliverability issues (spam, bounces) | MEDIUM -- 30-60 min DNS setup | Add SPF/DKIM/DMARC records, warm up sending domain, test with mail-tester.com |
| Form data lost on navigation | MEDIUM -- add localStorage auto-save | Implement save-on-change with debounce, restore-on-load logic. ~2-4 hours of work. |
| HEIC photos can't be opened by office | LOW -- add server-side conversion | Add sharp or imagemagick conversion step in the upload pipeline. ~1-2 hours. |
| AI-generated form template is wrong | LOW -- manual correction | Build a simple form editor. The AI output is just a starting point. ~4-8 hours for basic editor. |
| Workers refuse to use the app | HIGH -- requires UX overhaul | Observe a real worker using the app in the field. Fix the top 3 friction points they identify. May require significant redesign. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Photo payload exceeds email limits | Phase 1 (architecture) | Submit 15 photos and verify email arrives intact |
| Form data lost on accidental navigation | Phase 1 (form core) | Kill Safari mid-form, reopen, verify data restored |
| HEIC photo format issues | Phase 1 (photo pipeline) | Take HEIC photo on iPad, verify office can open attachment on Windows |
| UI unusable in field conditions | Phase 1 (UI foundation) | Test outdoors on iPad in sunlight with wet hands |
| AI form template accuracy | Phase 2 (form template) | Generate template from paper form photo, compare field-by-field |
| Email delivery unreliable | Phase 1 (email setup) | Send to actual office email, check inbox (not spam) |
| No submission tracking | Phase 1 (submission flow) | Submit a job, verify it appears in history, verify it arrived in email |
| Duplicate submissions on double-tap | Phase 1 (submit handler) | Double-tap submit button, verify only one email sent |
| API keys in frontend | Phase 1 (architecture) | Inspect page source in browser, verify no API keys visible |
| Workers reject the app | Phase 1 (first field test) | Have an actual crew member complete a full form on a real job site |

## Sources

- [Apple Developer Forums: Safari 17+ HEIC auto-conversion](https://developer.apple.com/forums/thread/743049)
- [Apple Developer Forums: beforeunload not supported on iOS Safari](https://developer.apple.com/forums/thread/744732)
- [Apple Developer Forums: Camera permission in PWA](https://developer.apple.com/forums/thread/85665)
- [PWA iOS Limitations and Safari Support (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Brainhub: PWA on iOS Limitations (2025)](https://brainhub.eu/library/pwa-on-ios)
- [Resend API Reference: 40MB attachment limit](https://resend.com/docs/api-reference/emails/send-email)
- [SendGrid Mail Send API Limitations](https://docs.sendgrid.com/api-reference/mail-send/limitations)
- [NN/g: Touch Target Sizes on Touchscreens](https://www.nngroup.com/articles/touch-target-size/)
- [W3C WCAG 2.1: Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Microsoft Dynamics 365: Optimize Image Size for Field Service](https://learn.microsoft.com/en-us/dynamics365/field-service/mobile/optimize-image-size)
- [Microsoft Azure: OCR Capabilities and Limitations](https://learn.microsoft.com/en-us/azure/foundry/responsible-ai/computer-vision/ocr-characteristics-and-limitations)
- [Innolitics: Preventing Data Loss in Web Forms](https://innolitics.com/articles/web-form-warn-on-nav/)
- [Upsidelab: Handling HEIC on the Web](https://upsidelab.io/blog/handling-heic-on-the-web)
- [MDN: beforeunload event](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)
- [NetSuite: Field Service Management Challenges](https://www.netsuite.com/portal/resource/articles/erp/field-services-management-challenges.shtml)

---
*Pitfalls research for: iPad-first field service form app (pool installation crews)*
*Researched: 2026-03-25*
