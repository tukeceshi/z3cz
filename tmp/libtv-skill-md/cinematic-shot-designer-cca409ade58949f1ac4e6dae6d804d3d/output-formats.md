# Output formats and checks

Choose the smallest format that satisfies the request. Do not force headings or fields the user did not ask for.

## Static shot / keyframe

Recommended order inside the generation prompt:

```text
[Dramatic purpose]. [Camera side/height/angle/distance], [focal length and optical behavior], [shot size and composition]. [Subject action, pose, gaze, emotion]. [Foreground–subject–background relationship and spatial lines]. [Lighting/color/atmosphere only as relevant]. [Continuity and model-specific constraints].
```

Before the prompt, optionally give one sentence explaining why the camera choice serves the beat.

## Single moving shot

Use compact technical metadata followed by chronological beats:

```text
SHOT INTENT: [one dramatic job]
DURATION / FORMAT: [seconds, aspect ratio, frame rate if supplied]
CAMERA BASELINE: [rig, lens, stabilization/motion character]

START FRAME: [position, angle, distance, framing, subject and geography]
BEAT 1 — [trigger]: [character action] ↔ [camera response], [speed/path], maintaining/changing [framing invariant].
BEAT 2 — [trigger]: ...
END FRAME: [final geometry, framing, revealed information, hold or cut]

CONTINUITY / LIMITS: [only essential identity, axis, physics, or exclusion constraints]
```

For simple moves, collapse this into one paragraph. Use beat numbering when there are simultaneous events, direction changes, dialogue cues, transformations, or a precise end frame.

## Multi-shot scene

Start with a short visual strategy, then give a shot table or numbered list:

| Shot | Dramatic job | Camera design | Action and timing | Transition / continuity |
|---|---|---|---|---|
| 1 | What changes for the viewer | angle, height, lens, size, move | subject beat + duration | cut motivation, axis, match |

After the plan, provide generation-ready prompts per shot only if the user asked for them. Repeat locked character/environment facts only when the target model needs self-contained prompts; otherwise keep a shared continuity block.

## Diagnosis format

When reviewing an existing prompt, return:

1. **Camera intent found:** what the shot appears to be trying to do.
2. **Blocking issues:** only concrete ambiguities or contradictions.
3. **Revised prompt:** preserve non-camera content and repair camera geometry/timing.
4. **Optional alternate:** one meaningfully different solution, not cosmetic synonyms.

## Conflict and feasibility check

Check each prompt for:

- **State conflict:** locked-off plus pan/tilt/track/shake; static frame plus reframing; “camera holds” plus continued travel.
- **Geometry conflict:** front and rear view at once; low and overhead at once; subject approaches while distance and scale stay fixed without matching camera motion.
- **Optical conflict:** simultaneous focal lengths without a timed lens change; deep focus and extreme shallow focus on the same planes; telephoto compression claimed from an implausibly close position.
- **Temporal conflict:** too many beats for duration; sequential events written as simultaneous; no trigger or endpoint; dialogue/action timing cannot fit.
- **Continuity conflict:** unmotivated axis crossing, reversed travel, broken eye-line, changed prop side, reference identity drift, unexplained lighting direction change.
- **Physical conflict:** impossible acceleration, collision path, camera passing through solids, floating rig behavior, massless impacts, absent settling/follow-through.
- **Visibility conflict:** essential gesture outside frame, face required but occluded, reveal visible too early, focus target unavailable.
- **Instruction priority:** decorative style clauses overwhelm the camera action; repeated negatives bury the positive target.

Repair with the smallest change that preserves the user's dramatic goal.

## Platform adaptation

When a platform or model is named, retain the camera logic but adapt syntax, density, duration limits, reference notation, and negative-prompt strategy to that platform. Do not invent unsupported parameters. If platform syntax is unknown and browsing was not requested or available, provide a platform-neutral prompt and label it as such.
