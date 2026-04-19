
User wants to add two more presentation penalties to the scoring prompt in `intake-score-test`:
1. Mirror selfies (person photographing themselves in a mirror, often with phone visible)
2. Garments shown in plastic bags / poly mailers

These should score very low on presentation (1-2 range, similar to home environment).

Single-file change: `supabase/functions/intake-score-test/index.ts` — update the `presentation_score` rubric and the "Be strict" instruction block.

## Plan: Penalize mirror selfies and plastic-bag shots

Update only the scoring prompt in `supabase/functions/intake-score-test/index.ts`. No other files, tables, or logic changed.

### Changes to the presentation rubric (0-10)

Add two new low-score categories alongside the existing "home environment" rule:

- **Mirror selfie** (person photographing themselves in a mirror, phone visible, bathroom/bedroom mirror): score **1**
- **Garment in plastic bag / poly mailer / shipping bag**: score **1**

Updated scale:
- 10 = model or mannequin, clean/white/neutral background, sharp and well-lit, professional styling
- 6 = flat lay on clean surface, good lighting
- 3 = hanger shot on plain wall or door, acceptable background
- 1 = home environment (bedroom, living room, furniture visible), **mirror selfie with phone visible**, **garment shown inside or on top of a plastic bag / poly mailer**, outfit shot on person in home setting
- 0 = floor, cluttered background, very dark or blurry

### Strictness instruction update

Extend the existing "Be strict about background quality" paragraph:

> "Be strict about background quality. A home environment with furniture, walls, or personal items visible should score 1-2 regardless of garment quality. Mirror selfies (where a person or phone is visible reflecting in a mirror) and items photographed inside or on plastic shipping bags / poly mailers must score 1-2 regardless of garment quality. Only professional or clean neutral backgrounds score above 6."

### Guarantees
- Only the prompt text inside `aiEvaluate()` changes
- No changes to scoring weights, thresholds, decision logic, DB schema, or other functions
- No UI changes
- Spec-aligned: shadow-mode test pipeline only, no live data affected
