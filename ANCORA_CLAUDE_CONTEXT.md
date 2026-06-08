ANCORA — CLAUDE CONTEXT v1.0
Klistra in detta i början av varje Claude-session. Uppdatera "Aktiv logg" löpande.

VAD ÄR ANCORA
Ancora är ett redaktionellt lager ovanpå second hand-marknaden.
Inte en marketplace, ett lager eller ett checkout-system
Är ett kurerat gränssnitt, en trafikmotor och en affiliate-driven shopping-upplevelse
Intäktsmodell: affiliate-klick till Tradera, eBay, VintageSphere (ingen egen transaktion)

TECH STACK
Frontend + Admin: Lovable (React, TypeScript)
Backend: Supabase (Postgres + Edge Functions)
Import-adaptrar: Tradera (SOAP), eBay (Browse API), VintageSphere (Shopify JSON)
Status: Production MVP låst — Master Spec v1.9 är source of truth

HÅRDREGLER (bryt aldrig dessa)
Master Spec prevails — vid konflikt mellan kod och spec vinner spec alltid
Cron får aldrig skriva över redaktionella fält — name, description, brand, color, material, condition
Import skapar alltid draft — aldrig auto-publish
Enums är alltid lowercase snake_case — t.ex. tradera, very_good, draft
Quota-guard: avbryt bakgrundsjobb om remaining quota < 30
Editorial > Automation alltid

SYSTEM-LAGER
Lager
Vad det gör
Ägs av
Import Layer
Adaptrar per källa → products draft
Edge Functions + Admin UI
Product Layer
Canonical model (products-tabellen)
DB
Editorial Layer
Stories, kuraterade edits, draft→publish
Admin UI
Availability Layer
Sold-detection, cron 03:00 UTC
Cron Edge Functions
Analytics Layer
Views, klick, telemetri
DB + Analytics beacon


AKTIVA PARTNERS & IMPORT-REGLER
Partner
Metod
Max per run
Isolerad?
Tradera
SOAP GetItem
Quota-styrd
Ja
eBay
Browse API (GB, leverans SE)
25/batch
Ja
VintageSphere
Shopify JSON (manuell)
10
Ja


VIKTIGA ENUM-VÄRDEN
products.status:       draft | published | sold | archived | active | pending_import | review_required
products.marketplace:  tradera | ebay | vintagesphere | manual
products.condition:    new | very_good | good | fair | poor
unpublished_reason:    affiliate_unavailable | ended | sold | manual_unpublish | data_incomplete

CRON-JOBB (får ej ändras utan spec-uppdatering)
Jobb
Schema
Batch
Guard
tradera-sync
03:00 UTC dagligen
25
quota < 30 → abort
ebay-availability
03:00 UTC dagligen
25
rate-limit pacing
tradera-retry-import
var 30:e min
cap per run
quota < 30 → abort


EBAY AFFILIATE-LÄNKAR (aktuell status)
Direktlänkar används (inte rover):
https://www.ebay.co.uk/itm/{itemId}?campid=5339143507&toolid=10001
campid 5339143507 = Ancora Main-kampanj
rover-redirecten är borttagen (orsakade svarta sidor i moderna browsers)
Pågående: verifierar att klick registreras korrekt i EPN Click Report

FRAMTIDA ARBETE (ej påbörjat)
AI Intake System v1 — en isolerad, testbar import-pipeline med:
AI-enrichment och scoring av produkter
Editorial queue med ranked review
Shadow mode — får inte påverka live-miljön
Unified pipeline för alla partners
Full spec finns — byggs när MVP-fasen är stabil

HUR CLAUDE SKA ARBETA MED ANCORA
Identifiera alltid vilket lager en förändring tillhör innan du svarar
Uppdatera spec-excerpts innan du föreslår kod
Minimal surface change — ändra bara det som krävs
Bekräfta alltid: inga editorial overwrites, enums oförändrade, quota-guard bevarad
Om du är osäker — fråga, gissa aldrig enum-värden
Svara alltid med: berörda filer, DB-migrations (om aktuellt), invariant-validering

AKTIV LOGG
(Uppdatera detta löpande — senaste beslut och pågående ärenden)
2026-03-12
- Back-knapp i ProductDetail fixad — navigerar nu till rätt subkategori
- Label visar subkategori (t.ex. "Back to Blazers") när ?sub= finns
- Fallback: kategori → /shop → "Back to shop"

2026-03-12
- Back-knapp i ProductDetail fixad — navigerar nu till rätt subkategori
- Label visar subkategori (t.ex. "Back to Blazers") när ?sub= finns
- Fallback: kategori → /shop → "Back to shop"

2026-03-12 (Carin)
- eBay EPN affiliate-URL standardiserat — direktlänkar med alla EPN-parametrar
  (mkcid, mkrid, siteid, campid, toolid, mkevt). Rover-redirect borttagen.
- isEbayAffiliateUrl validerar nu mkevt=1
- Alla befintliga eBay-produkter uppdaterade via SQL-migration (affiliate_url återbyggd)
- intake-fetch-test: q=women's clothing, category_ids=15724, min 38.46 GBP (≈500 SEK)
- price_debug i dry_run: visar råpris, valuta och SEK för de 5 första objekten
- Master Spec uppdaterad till v1.8 (sektion 4.3.1 ny, changelog tillagt)


Genererad: 2026-03-10 | Baserad på Master Spec v1.7 + AI Operating Protocol v1.1



