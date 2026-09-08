---

## name: ai-cinematic-shot-designer description: Design, rewrite, diagnose, and quality-check camera-language prompts for AI films and videos. Use when a user needs shot angles, camera height, lens and perspective, framing, camera movement, blocking-to-camera timing, shot transitions, or a coherent shot list; do not activate for general image styling with no camera-design need.

# AI Cinematic Shot Designer

Turn story intent into camera instructions an AI video or image model can execute. Treat cinematic language as spatial and temporal design, not as a pile of style words.

## First decide the deliverable

- **Single still / keyframe:** design a static viewpoint. Read references/camera-language.md, then use the static format in references/output-formats.md.
- **Single moving shot:** define a continuous camera path and bind each camera change to character or story beats. Read both references.
- **Multi-shot scene:** give every shot one dramatic job, preserve screen direction and spatial continuity, and use the sequence format in references/output-formats.md.
- **Prompt diagnosis or rewrite:** preserve the user's story, characters, reference bindings, dialogue, duration, aspect ratio, and chosen model. Identify camera conflicts before rewriting.

## Design in this order

1. Extract the story beat, emotional shift, subject, action, environment, duration, and requested output language or platform.
2. State the shot's dramatic job in plain language: reveal, isolate, intimidate, align, disorient, pursue, withhold, or release.
3. Place the camera relative to the subject: side, front, rear, over-shoulder, POV; height; angle; distance; and whether an obstruction motivates the viewpoint.
4. Choose focal length and framing for the intended spatial effect. Do not choose a lens as decoration.
5. Arrange foreground, subject plane, background, eye-line, screen direction, and negative space.
6. For motion, specify start frame, trigger, path, direction, speed curve, framing behavior, end frame, and cut or hold. Pair camera beats with performance beats.
7. Add only relevant focus, shutter/motion feel, stabilization, lighting, color, atmosphere, and sound constraints.
8. Run the conflict and feasibility check before delivering.

Lead with intent when explaining choices. In the final generation prompt, place concrete observable instructions before broad aesthetic labels.

## Working rules

- Angle and lens work as a pair: an angle establishes viewer–subject power; the lens controls spatial expansion, compression, proximity, and distortion.
- Prefer physical descriptions such as “camera 20 cm above the floor, 3 m in front of the actor, tilted upward” over an unsupported “epic low angle.”
- A moving shot needs one readable dominant move. Add secondary motion only when it follows naturally from the operator, vehicle, crane, or character.
- Describe what stays invariant during movement: face size, lead room, horizon, eye-line, subject placement, or distance.
- Separate simultaneous actions from sequential actions. Use numbered beats for dense timing.
- Keep reference-image facts distinct from camera instructions. Never invent reference labels, character traits, or continuity facts.
- Do not force every technical field into every answer. Include a value only when it changes the shot or prevents ambiguity.
- Do not silently overwrite explicit user choices. If they conflict, retain the dramatic goal and explain the smallest necessary correction.

## Handling missing information

Make conservative assumptions when they do not change the story: standard cinematic motion, plausible camera placement, one clear subject, and continuity-safe screen direction. Label important assumptions briefly.

Ask a question only when one missing choice would materially change the result, such as still versus video, one take versus montage, unknown scene action, or a platform with strict syntax. Otherwise produce a usable first pass and expose 1–2 optional variants.

## Quality gate

Reject or repair instructions that require the camera to be locked and moving at once, use incompatible angles or positions in the same instant, lack a start/end state, cross the axis without motivation, exceed the available duration, hide essential action, or demand physically impossible acceleration. Confirm that the shot's emotional effect follows from the actual camera geometry rather than from adjectives alone.