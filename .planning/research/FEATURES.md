# Feature Research

**Domain:** Field service digital forms -- pool installation crew iPad app
**Researched:** 2026-03-25
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features field workers and office staff assume exist. Missing any of these and the app feels broken or incomplete compared to the paper forms it replaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Job creation/selection | Workers need to associate forms and photos with a specific job. Without this, data is unorganized -- worse than paper. | LOW | Support both job name and job number per PROJECT.md. Simple list with search/filter. |
| Digital form filling | The entire point of the app. Workers fill out structured fields (text, checkboxes, dropdowns, numbers) on iPad. | MEDIUM | Must feel as fast or faster than paper. Large touch targets, minimal typing. Auto-advance between fields. |
| Photo capture and attachment | Pool installation crews take many photos per job. Every competitor app supports in-app camera capture attached to jobs. | LOW | Use native camera API. Must support multiple photos per job. Show thumbnails after capture. |
| Photo gallery/review per job | Workers and office staff need to see all photos for a job before submission. Deleting a bad photo is essential. | LOW | Grid view of thumbnails. Tap to enlarge. Swipe to delete. |
| Form + photos email submission | The core delivery mechanism. Office staff expect a complete package in their inbox -- form data plus photos in one email. | MEDIUM | This is the make-or-break feature. Must be reliable. Include form data in email body or as PDF attachment, with photos attached or embedded. |
| PDF generation from form data | Industry standard. Every competitor (Jotform, GoFormz, FastField, Sitemate) generates a professional PDF from submitted form data. Office staff need a printable/forwardable document. | MEDIUM | Generate a clean PDF with form fields, values, and embedded photos. Office ladies forward these to clients/inspectors. |
| iPad-optimized UI | Pool crews use iPads in the field. If the app feels like a shrunken desktop site, workers will revert to paper. | MEDIUM | Large buttons, fat touch targets, readable in sunlight. Landscape and portrait support. No tiny form fields. |
| Form validation | Prevent incomplete submissions. Required fields, basic type validation (numbers in number fields). Workers should not be able to submit a half-empty form. | LOW | Highlight missing required fields. Block submission until valid. Keep it simple -- no complex conditional rules for v1. |
| Submission confirmation | Workers need to know the email went through. Without confirmation, they will worry and resubmit or call the office. | LOW | Clear success/failure state after submission. Show what was sent. |
| Job history/list | Workers need to see past jobs and their submission status. "Did I already submit that one?" is a constant question. | LOW | Simple list: job name, date, status (draft/submitted). No complex filtering needed. |

### Differentiators (Competitive Advantage)

Features that set this app apart from both paper forms and generic form builder apps like Jotform/GoFormz. These align with the project's core value proposition.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI form template generation from paper photo | The killer feature. Boss takes a photo of the existing paper form, AI generates a digital template. No manual form building needed. Competitors like GoFormz require manual drag-and-drop form building or expensive enterprise onboarding. | HIGH | Use vision AI (GPT-4o, Claude) to analyze form photo, extract field names/types/layout, generate a usable digital template. This is the PROJECT.md differentiator -- the paper form has not been provided yet, so this solves a real problem. |
| Zero-config simplicity | Competitors (ServiceTitan, Zuper, Synchroteam) are enterprise FSM platforms with weeks of setup. This app: open it, pick a job, fill the form, submit. No accounts, no login, no training. Pool crews are not tech people. | LOW | Simplicity is a feature. No user accounts for v1. No complex settings. One form template active at a time. This is a design discipline, not code complexity. |
| Photo categorization (Before/During/After) | Pool service apps like Pool Service Software already do this. Categorizing photos by stage (before work, during, after completion) makes office review much faster and creates better documentation for clients. | LOW | Simple label picker when taking/reviewing a photo. Three categories. Office email groups photos by category. |
| Branded PDF output | Office ladies forward the PDF to clients and inspectors. A professional-looking PDF with the company name/logo makes the business look polished vs. a raw data dump. | LOW | Simple template with logo placement, company name header, clean layout. Low effort, high perceived value. |
| Draft auto-save | Field work gets interrupted constantly -- phone calls, lunch, equipment issues. If the app loses unsaved form data, workers lose trust immediately. Competitors all have this. | MEDIUM | Auto-save form state to local storage on every field change. Resume where you left off. Critical for field reliability. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but would hurt this specific project. The PROJECT.md Out of Scope section already identifies several of these.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Office admin dashboard | "We need to see all submissions in one place" | Adds an entire second app to build and maintain. Office staff already use email -- it is their dashboard. Building a dashboard doubles the project scope for a favor-for-a-friend project. | Email is the dashboard. If needed later, a simple web view of submission history could be added without a full admin panel. |
| Worker login/accounts | "We need to know who submitted what" | Adds authentication complexity, password resets, account management. Pool crews share iPads. Login friction means workers skip the app and go back to paper. | Include a "submitted by" name field in the form itself. Workers type their name. Simple, no auth infrastructure. |
| Approval/rejection workflow | "Office needs to approve or reject submissions" | Turns a simple forms app into a workflow engine. Office staff handle this via email replies and phone calls already. Building approval flows means state machines, notifications, retry logic. | Office ladies reply to the email or call the crew. This workflow already exists and works. |
| Real-time GPS tracking | "Track where crews are working" | Privacy concerns with workers. Adds location services complexity. Not needed for form submission -- the job address is already in the job data. | Optional GPS coordinates on photos (EXIF data) provide location proof without active tracking. |
| Offline mode with sync | "What if there is no signal at the job site?" | PWA offline on iPad Safari has real limitations: 7-day storage cap if not added to home screen, no background sync, limited storage quotas. Building robust offline-first with conflict resolution is a massive complexity increase. | Defer to v1.x. Most pool installation sites have cell coverage. If it becomes an issue, add home-screen PWA with service worker caching. |
| Multiple form templates per job | "Different jobs need different forms" | Multiplies form management complexity. Which template for which job? Template versioning? The pool company uses one standard form for all jobs. | One active form template. If the company needs a second form type later, add it then. |
| Scheduling/dispatch | "Assign jobs to crews from the office" | Turns the app into a full FSM platform (ServiceTitan, Housecall Pro territory). Massive scope creep. The boss already assigns jobs via phone/text. | Workers create their own jobs by name/number as assigned verbally. |
| Payment processing | "Collect payment on site" | Requires payment gateway integration, PCI compliance, refund handling. Pool installations are invoiced separately, not paid at completion. | Completely out of scope. Different business process. |
| Complex conditional form logic | "Show field X only if field Y is checked" | Adds a form logic engine. The AI-generated form template would need to encode conditional rules. Significant complexity for a simple installation checklist. | Flat forms with all fields visible. If a field does not apply, worker skips it. Good enough for v1. |

## Feature Dependencies

```
[AI Form Template Generation]
    └──enables──> [Digital Form Filling]
                      └──enables──> [Form Validation]
                      └──enables──> [Draft Auto-Save]
                      └──combines with──> [Photo Capture + Gallery]
                                              └──enhances──> [Photo Categorization]
                      └──feeds into──> [PDF Generation]
                                           └──feeds into──> [Email Submission]
                                                                └──triggers──> [Submission Confirmation]

[Job Creation/Selection]
    └──organizes──> [Digital Form Filling]
    └──organizes──> [Photo Capture + Gallery]
    └──displayed in──> [Job History List]

[Branded PDF Output] ──enhances──> [PDF Generation]

[iPad-Optimized UI] ──applies to──> [ALL features]
```

### Dependency Notes

- **AI Form Template Generation enables Digital Form Filling:** Without a template, there is no form to fill. This is the bootstrap problem -- the template must exist before anything else works. However, the template only needs to be created once, not per-job.
- **PDF Generation feeds into Email Submission:** The email needs to contain or attach the PDF. These are tightly coupled -- build them together.
- **Photo Capture combines with Digital Form Filling:** Photos and form data are separate data streams that merge at submission time. They can be built somewhat independently but must integrate at the email/PDF layer.
- **Job Creation/Selection organizes everything:** Jobs are the container for all data. This is the first thing to build but is also the simplest.
- **iPad-Optimized UI is not a feature -- it is a constraint** that applies to every screen and interaction.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what is needed to replace paper forms for the pool crew.

- [ ] **Job creation/selection** -- Workers pick or create a job by name/number. The container for everything.
- [ ] **Digital form filling** -- One form template with text, number, checkbox, and dropdown fields. Large iPad-friendly inputs.
- [ ] **Photo capture and gallery** -- Take photos with iPad camera, review them, delete bad ones. Attached to the current job.
- [ ] **PDF generation** -- Convert filled form + photos into a clean PDF document.
- [ ] **Email submission** -- Send the PDF (and/or form data + photos) to the configured office email address.
- [ ] **Submission confirmation** -- Clear success/failure feedback after sending.
- [ ] **Form validation** -- Required field enforcement before submission.
- [ ] **Job history list** -- See past jobs and whether they have been submitted.

### Add After Validation (v1.x)

Features to add once the core workflow is proven with real pool crews.

- [ ] **AI form template generation** -- Add when the paper form photo is available or when the boss wants to change the form. High value but can be deferred if a template is manually built first.
- [ ] **Draft auto-save** -- Add if workers report losing data due to app interruptions. Likely needed quickly.
- [ ] **Photo categorization (Before/During/After)** -- Add if office staff request better photo organization.
- [ ] **Branded PDF output** -- Add company logo and styling to the PDF. Quick win for professional appearance.
- [ ] **Offline form saving** -- Add if field connectivity proves to be a real problem.

### Future Consideration (v2+)

Features to defer until the app is established and the business owner requests them.

- [ ] **Multiple form templates** -- If the company adds new form types beyond the standard installation form.
- [ ] **Form template editor** -- Visual editor for modifying AI-generated templates or creating new ones.
- [ ] **Photo annotation/markup** -- Drawing on photos to highlight issues. Useful but not essential for installation documentation.
- [ ] **Digital signature capture** -- Customer or foreman sign-off on completed work. Common in field service but not part of current paper workflow.
- [ ] **Simple web dashboard** -- If email-based review becomes unmanageable at scale.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Job creation/selection | HIGH | LOW | P1 |
| Digital form filling | HIGH | MEDIUM | P1 |
| Photo capture and gallery | HIGH | LOW | P1 |
| PDF generation | HIGH | MEDIUM | P1 |
| Email submission | HIGH | MEDIUM | P1 |
| Submission confirmation | MEDIUM | LOW | P1 |
| Form validation | MEDIUM | LOW | P1 |
| Job history list | MEDIUM | LOW | P1 |
| iPad-optimized UI | HIGH | MEDIUM | P1 (constraint, not feature) |
| AI form template generation | HIGH | HIGH | P2 |
| Draft auto-save | HIGH | MEDIUM | P2 |
| Photo categorization | MEDIUM | LOW | P2 |
| Branded PDF output | MEDIUM | LOW | P2 |
| Offline form saving | MEDIUM | HIGH | P3 |
| Multiple form templates | LOW | MEDIUM | P3 |
| Photo annotation | LOW | MEDIUM | P3 |
| Digital signature capture | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch -- the app is non-functional without these
- P2: Should have, add shortly after launch when validated
- P3: Nice to have, future consideration based on user feedback

## Competitor Feature Analysis

| Feature | GoFormz | Jotform | Housecall Pro | This App's Approach |
|---------|---------|---------|---------------|---------------------|
| Form building | Drag-and-drop builder, AI PDF digitization | 10,000+ templates, drag-and-drop | Pre-built service templates | AI generates from paper form photo -- zero manual building |
| Photo capture | Attachments, no categorization | File upload fields | Basic photo capture | In-app camera with Before/During/After categorization |
| Offline mode | Full offline with auto-sync | Local storage offline | Native app offline | Defer -- PWA limitations on iPad are significant |
| PDF output | Auto-generated, customizable | PDF Editor, branded | Invoice-focused PDFs | Auto-generated, clean layout with optional branding |
| Email delivery | Automated email with PDF | Email notifications with attachments | Automated notifications | Direct email with PDF + photos to configured address |
| Pricing | $30+/user/month | Free tier, $34+/month | $49+/month | Free -- built as a favor for a friend |
| Setup complexity | Days of configuration | Hours of template setup | Account setup, onboarding | Minutes -- open and go, no accounts |
| Target user | Enterprise field teams | General forms users | Home service businesses | One pool installation company |

## Key Insight: Simplicity IS the Feature

The biggest competitors (GoFormz, Jotform, ServiceTitan) are powerful but complex. They serve thousands of companies across dozens of industries. This app serves one company with one form. The competitive advantage is radical simplicity:

- No accounts to create
- No templates to configure (AI does it)
- No integrations to set up
- No training needed
- No monthly subscription

The danger is scope creep toward becoming a generic forms platform. Every "just add one more feature" request moves the app away from its core value: dead-simple form submission for pool crews.

## Sources

- [ServiceTitan: 15 Best Field Service Mobile Apps for 2026](https://www.servicetitan.com/blog/best-field-service-mobile-apps)
- [TrueContext: Mobile Forms App for Field Service](https://truecontext.com/product/mobile-forms-app/)
- [GoFormz: Top 5 Mobile Form Builders Comparison 2025](https://blog.goformz.com/post/top-5-mobile-form-builders-a-comprehensive-comparison-2025-guide)
- [Jotform: 5 Mobile Features for Field Service Management](https://www.jotform.com/blog/mobile-features-to-help-with-field-service-management/)
- [FastField: Construction Safety & Reporting App](https://www.fastfieldforms.com/construction-reporting.html)
- [Fieldwire: Digital Construction Forms Tool](https://www.fieldwire.com/construction-forms/)
- [OpenSpace: Best Practices for Construction Site Photo Documentation](https://www.openspace.ai/blog/best-practices-for-construction-site-photo-documentation-what-to-capture-and-why-it-matters/)
- [Brainhub: PWA on iOS - Current Status & Limitations 2025](https://brainhub.eu/library/pwa-on-ios)
- [MagicBell: PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)
- [Artificio: Form Digitization from Physical to Digital](https://artificio.ai/blog/form-digitization-from-physical-forms-to-digital)
- [BuildOps: 6 Best Construction Forms Apps](https://buildops.com/resources/construction-forms-app/)
- [Sitemate: Field Service Report Software and App](https://sitemate.com/plant-equipment-assets/field-service-report-software-app/)
- [Fillout: Form Submission to PDF](https://www.fillout.com/blog/form-submission-to-pdf)

---
*Feature research for: Pool installation field service forms iPad app*
*Researched: 2026-03-25*
