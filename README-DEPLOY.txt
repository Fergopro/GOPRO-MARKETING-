GoProcures V3 — SAFE PREVIEW PACKAGE
=====================================

Target GitHub repository: Fergopro/GOPRO-MARKETING-
PREVIEW branch: goprocures-ai
PRODUCTION branch: main — DO NOT MODIFY before testing.

Files to upload/replace on PREVIEW branch:
  index.html                  (REPLACE existing homepage only)
  assets/cinematic.css        (CREATE NEW file)
  assets/cinematic.js         (CREATE NEW file)

IMPORTANT: DO NOT overwrite these EXISTING shared files:
  assets/styles.css
  assets/app.js

They are used by about.html, contact.html, services.html and how-it-works.html.
The new homepage intentionally loads cinematic.css and cinematic.js instead.

Keep ALL other files and API routes, including:
  login.html, dashboard.html, admin.html, voice.html, api/*.js,
  assets/voice.js, assets/voice.css, current Supabase data and secrets.

The code package contains HTML/CSS/JS only. It does NOT include back-end routes.
To have the full application live, deploy the entire tested goprocures-ai
branch to main after carefully reviewing the pull request.

TEST PREVIEW FIRST:
  1) Homepage loads on mobile and desktop.
  2) Google and email sign-in works; sign-in banner hides when logged in.
  3) Text AI responds and creates an active request in customer dashboard.
  4) Voice AI opens and enforces 1-minute free trial + Pro access.
  5) Existing about/services/contact pages still display correctly.
  6) Admin console shows requests and attachments.
  7) Testimonials section shows only approved Supabase reviews.

KEEP PRODUCTION UNCHANGED until all tests pass.
