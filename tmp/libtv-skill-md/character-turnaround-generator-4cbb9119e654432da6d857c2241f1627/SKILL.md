---

## name: libtv-character-sheet description: Create LibTV real-person photographic character turnaround/reference sheets from a supplied image or character description. Use when the user asks for a character sheet, turnaround, model sheet, expression/angle reference, or 人设图, especially the left-three-right-four composition with 1990s photographic film grain and no anime, cartoon, illustration, or 3D-rendered style. This skill operates inside LibTV: keep prompt assembly internal and do not expose or ask the user to approve a standalone character prompt.

# LibTV Character Sheet

Build a production-style character model sheet for LibTV, not a poster, portrait collage, or cinematic still. Treat the user's reference image as the authority for both character identity and, when supplied, the target sheet's visual organization. Complete only information that is not visible, and keep any completion conservative.

## Runtime behavior

1. Accept the user's reference image(s), description, or both. Do not require a separate prompt-writing step.
2. Extract stable identity facts internally: face/head shape, eyes, brows, nose, mouth, jaw, ears, skin tone/texture, hair, age impression, body proportions, clothing silhouette/colors/materials, and shoes.
3. Compose the internal LibTV generation instruction using the locked layout and style below.
4. Generate the image directly through the LibTV image workflow. Do not print the assembled prompt, prompt fragments, or a confirmation question.
5. After generation, inspect the result against the validation checklist. If a hard layout or identity rule fails, revise and regenerate internally; expose only the final image and a short result note.

## Locked composition

- Canvas: horizontal 16:9 character reference sheet with a clean, nearly white studio page.
- Exactly seven views of the same person; no extra figures, duplicates, or alternate costumes.
- Divide the sheet into two unmistakable areas: approximately 60% width on the left for full bodies and 40% on the right for headshots. Use three equal left columns and four equal right tiles; use only very thin, pale separators or natural whitespace, never decorative frames.
- Left section: three complete, standing full-body views in one horizontal row, in this exact order: front-facing, strict 90-degree side profile, back-facing. Align the three heads on one horizontal line, keep the same camera distance and scale, and align all shoes on one baseline.
- Right section: four close-up head-and-shoulder portraits in a clean 2x2 grid, in this exact order: top-left frontal, top-right left 3/4, bottom-left right 3/4, bottom-right strict side profile. Keep all four heads the same size and crop at a consistent shoulder/chest level.
- Keep all full-body figures fully inside frame from head through shoes. Keep headshots fully readable and similarly framed; do not mix portrait crops with busts, waist-ups, or tiny faces.
- Use the body orientation itself to communicate each view. Never add labels, arrows, rulers, captions, or other explanatory marks.
- Keep eye-line/head height, figure scale, spacing, camera distance, vertical margins, and panel rhythm consistent across views. Use a neutral, relaxed, front-facing reference stance: arms naturally down, hands visible, legs uncrossed, no walking, twisting, gesturing, or fashion pose.
- Treat the result as a measured reference layout: no oversized hero portrait, no dominant central figure, no diagonal composition, no overlapping views, and no visual element crossing the left/right boundary.

## Identity and completion

- Preserve the same face, hair, body, clothing, shoes, age impression, and temperament in every view. Identity consistency has priority over decorative detail.
- Preserve visible reference details exactly, including asymmetries, marks, hairline, garment construction, and shoe structure.
- For unseen areas, choose simple, plausible continuations that match visible materials and colors. Do not invent logos, occupations, weapons, jewelry, elaborate prints, or story props.
- Keep the four headshots as the same head and hairstyle with only subtle natural expression changes: neutral, slight natural smile, calm attentive, quiet thoughtful. Avoid broad smiles, open-mouth expressions, or dramatic emotion.
- Do not change apparent age, facial proportions, hairstyle, garment color, or shoe design between views.

## Locked visual treatment

- Use a high-key 1990s studio reference-photo aesthetic: straightforward documentation, even exposure, restrained contrast, and an almost white page. The retro quality comes from the analog capture texture, not from nostalgic props, film borders, color casts, or a cinematic mood.
- Enforce a real-person photographic appearance: natural human anatomy, photographic skin, real hair and fabric, and camera-captured depth. Do not use anime, manga, cartoon, illustration, comic-book, cel-shaded, 3D-rendered, game-concept, doll-like, or other animated-looking styles unless the user explicitly overrides this rule.
- Background: plain warm white, neutral white, or extremely pale grey; preserve clear whitespace around every figure. No room, street, furniture, props, scenery, gradient backdrop, or environmental storytelling.
- Lighting: broad soft frontal/overhead studio light with gentle contact shadows under shoes and almost no cast shadows; keep facial features, seams, pleats, cuffs, collars, and shoe construction legible.
- Color: natural skin and fabric colors with mild 1990s print softness, slightly muted saturation, and a subtle warm-neutral balance. Do not force a cold blue grade, monochrome, neon, or glossy commercial polish.
- Texture: subtle fine 35mm film grain and sparse analog speckles, most visible in the blank background and midtones. Keep grain low enough that it never competes with eyes, facial structure, hair strands, fabric weave, pleats, silhouette, or shoes; never add heavy dirt, scratches, sprocket holes, or fake film borders.

## Negative controls

Internally reject or revise results containing: poster layout, freeform collage, movie-still/story-scene composition, oversized hero portrait, unequal panel sizes, missing separators/spacing rhythm, misaligned heads or shoe baselines, overlapping views, glamour or fashion-editorial posing, beauty filter/retouching, plastic or waxy skin, over-sharpening, glossy commercial look, strong blue color cast, high saturation, dramatic contrast, strong shadows/backlight, busy background, room/street/props, text or letters of any kind, labels, title graphics, captions, arrows, measurements, annotations, logos, anime, manga, cartoon, illustration, comic-book, cel shading, 3D render, game concept art, doll/plastic character look, chibi proportions, cropped head or feet, inconsistent headshot crops, exaggerated expressions, different people across views, identity drift, inconsistent hair/clothing/shoes, or four headshots that are all frontal or near-frontal.

## Final response contract

Return the generated character sheet (or the LibTV result object) and at most a concise note describing completion or any unavoidable limitation. Never include the internal English/Chinese prompt, a negative prompt, a prompt template, or a pre-generation approval request.

## Validation checklist

Before returning, verify:

- Seven views only, with 3 full-body left and 4 headshots right.
- Left order is front / strict side / back; right order is front / left 3/4 / right 3/4 / strict side.
- All views depict one consistent person, outfit, hairstyle, and age.
- Full bodies show head through shoes without cropping; headshots are clear and similarly framed.
- Left/right area proportions, three-column row, 2x2 grid, head alignment, shoe baseline, and shoulder crop are visibly stable.
- No text, labels, arrows, rulers, logos, or decorative graphics appear.
- Background and lighting are clean, high-key, nearly white, and even.
- 1990s film grain is subtle and subordinate to identity, clothing structure, and layout readability.
- The result reads as real-person photography, with no animation, illustration, cartoon, manga, anime, or 3D-rendered appearance.