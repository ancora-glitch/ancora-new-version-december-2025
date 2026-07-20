## Staged rollout: Google auth for Admin Portal + retire custom /auth

Målet är att gå från vår custom `/auth`-sida (email/password) till Lovable Clouds inbyggda Google-auth, utan att låsa ute befintliga admins (Sophie + du själv) och utan att skapa dubbletter för Carin.

### Steg 1 — Aktivera Google som provider (behåll email tillfälligt)

- Kör `configure_social_auth` med `providers: ["google"]` (INGEN `disable_providers` ännu).
- Effekt: Google blir tillgänglig; existerande email/password-inloggning fortsätter fungera som fallback under verifieringen.
- Ingen kodändring i det här steget.

### Steg 2 — Uppdatera `/auth`-sidan till en Google-knapp (transition-läge)

- Ersätt email/password-formuläret i `src/pages/Auth.tsx` med en enda "Sign in with Google"-knapp som anropar `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/admin-portal" — nej, se nedan })`.
- Enligt Lovable-reglerna: `redirect_uri` MÅSTE vara en publik same-origin URL. Vi använder `window.location.origin` och låter `RequireAdmin` skicka vidare till `/admin-portal` efter session hydration (befintlig logik i `RequireAdmin` gör det redan).
- `RequireAdmin.tsx` rörs inte — den fortsätter skydda `/admin-portal` via `has_role(auth.uid(), 'admin')`.
- Behåll `/auth`-routen tills Steg 5.

### Steg 3 — Verifiera med Sophie (befintlig admin, säker testperson)

- Sophie loggar in via Google på `sophie.gill.se@gmail.com` (matchar hennes befintliga confirmed email `gill.sophie@gmail.com` — kontrollera exakt adress först via `read_query` mot `auth.users`).
- Direkt efter hennes inlogg: kör en `read_query` mot `auth.users` + `auth.identities` för att bekräfta:
  - Samma `user_id` som tidigare (ingen ny rad skapad)
  - Ny rad i `auth.identities` med `provider = 'google'` kopplad till samma `user_id`
  - `user_roles`-raden med `role = 'admin'` är fortfarande giltig
- Om ny `user_id` skapades → STOPP. Manuellt merge: flytta `admin`-rollen till nya user_id ELLER radera duplikaten och länka om. Först därefter går vi vidare.

### Steg 4 — Bjud in Carin

- Bekräftat Sophie fungerar → Carin loggar in med Google på `carin.roeraade@gmail.com`.
- Samma verifiering: `auth.users` + `auth.identities`.
- Om ny user_id → merge först. Annars: `INSERT INTO user_roles (user_id, role) VALUES (<carins user_id>, 'admin')`.
- Testa att Carin når `/admin-portal` utan "Ingen åtkomst"-skärmen.

### Steg 5 — Ta bort email-provider och custom /auth

Först när både Sophie OCH Carin är verifierade på Google:

- `configure_social_auth` med `providers: ["google"], disable_providers: ["email"]`.
- Ta bort `src/pages/Auth.tsx` helt och route-registreringen i `src/App.tsx` (`<Route path="/auth" ...>`).
- Ersätt `RequireAdmin`s redirect från `navigate("/auth", ...)` → direkt anrop till `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`. Detta gör att oinloggade besökare på `/admin-portal` skickas direkt till Google istället för en mellansida.
- `tsgo --noEmit` för verifiering.

### Steg 6 — Bekräftelse på preview vs published

- Lovable Cloud-auth delar samma backend mellan preview och published (samma project ref). Detta noteras uttryckligen i changelog så vi slipper förvirringen igen.
- Uppdatera `ANCORA_MASTER_SPEC.md` med changelog-entry för 2026-07-20: "Admin-auth migrerad till Lovable Cloud Google OAuth; custom /auth borttagen; email-provider disabled."

### Öppna frågor innan jag kör

1. **Account linking**: Supabase länkar automatiskt ny Google-identitet till befintlig user vid matchande **verified** email. Sophies existerande email är redan `email_confirmed_at`-satt, så det ska funka — men jag vill ändå validera Sophies exakta Google-adress mot `auth.users.email` INNAN Steg 3. Är hennes Google-adress exakt `gill.sophie@gmail.com`?
2. **Carin har inget konto ännu?** Bekräftat från tidigare turnering: hon finns inte i `auth.users`. Google-first-signin skapar då automatiskt en ny rad — vi ger henne admin-rollen efteråt i Steg 4. OK?
3. **`/auth`-fallback under transition (Steg 2–4)**: Vill du att jag behåller en liten "email/password (legacy)"-toggle på `/auth`-sidan som säkerhetsnät ifall Google-flödet fallerar mitt i migreringen? Eller kör vi enbart Google-knapp direkt?

Säg till om något ska justeras, annars börjar jag på Steg 1 så fort planen är godkänd.
