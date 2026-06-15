## Plan: Update all site email addresses to carin@ancoraedit.com

### Scope
Replace every public-facing email address on the Ancora site with `carin@ancoraedit.com`.

### Affected files and changes

| File | Current email | New email | Locations |
|------|-------------|-----------|-----------|
| `src/pages/Contact.tsx` | `ancoraedit@gmail.com` | `carin@ancoraedit.com` | `mailto:` link + displayed text |
| `src/pages/Partners.tsx` | `ancoraedit@gmail.com` | `carin@ancoraedit.com` | CTA button (×2) |
| `src/pages/Terms.tsx` | `hello@ancoraedit.com` | `carin@ancoraedit.com` | Contact section link + text |
| `src/pages/Sourcing.tsx` | already `carin@ancoraedit.com` | no change | — |

### Verification
- Search the `src/` directory to confirm no other email addresses remain.
- Spot-check the Contact, Partners, and Terms pages in the preview.

### Exclusions
- No edge functions, backend code, or database changes.
- No layout, styling, or copy other than the email addresses themselves.