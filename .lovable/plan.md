Add a new route and page for an onboarding checklist to guide sharing repository access with Figura Labs.

### Page: `/onboarding-checklist`

Create `src/pages/OnboardingChecklist.tsx` with the following layout and behavior:

1. **Header**
   - Title: "Repository access checklist – external partner"
   - Subtitle: "Complete these steps before sharing repo access with Figura Labs"

2. **Progress Indicator**
   - Display at the top, below the header.
   - Format: "X / 4 completed"
   - Visual: a segmented bar or counter that updates in real time as checkboxes are toggled.

3. **Checklist (4 items)**
   Each item is a toggleable checkbox with a label and descriptive body text:
   - "Remove sensitive files" – ensure .env files, API keys, and secrets are not committed. Add them to .gitignore and verify git history is clean.
   - "Define access level" – decide between fork (read-only, no push access) or collaborator with read-only role. Specify which branch they should base their work on.
   - "Scope the integration" – document which pages/components are in scope (Clothing product pages on ancoraedit.com). Include a brief description of the Figura Labs widget (size-fit box).
   - "Collect partner GitHub/GitLab usernames" – gather usernames or associated emails for everyone at Figura Labs who needs access. Note how many people.

4. **Completed State Styling**
   - When a checkbox is checked, the item text receives a subtle green tint (use a semantic green token or `text-green-600`).
   - No animations required.

5. **"Copy invite email" Button**
   - Placed at the bottom of the checklist.
   - On click, copies a pre-written email template to the clipboard.
   - Shows a brief toast/confirmation feedback.
   - Email template includes:
     - Subject line
     - Repo URL placeholder
     - Branch placeholder
     - Scope description (Clothing product pages)
     - Request for their GitHub username

6. **Design**
   - Clean, minimal, white background (`bg-white`).
   - Sans-serif font (`font-sans`, Trispace / system-ui).
   - Mobile-friendly responsive layout.
   - No dependency on dark mode.

### Routing
- Register the route in `src/App.tsx` at `/onboarding-checklist`.
- Use existing `PageViewTracker` wrapper (no special tracking needed beyond default).

### Technical Details
- Use React `useState` to manage checkbox states and derive progress.
- Use `navigator.clipboard.writeText` for the copy action, with a fallback alert if unavailable.
- Use existing shadcn/ui `Checkbox` component if available; otherwise use native styled `<input type="checkbox">`.
- Use `lucide-react` icons for visual polish (checkmarks, copy icon).
- No backend, database, or auth changes required.
- No new dependencies required.