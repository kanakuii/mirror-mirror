# Mirror, Mirror — Project Brief

Solo hackathon project for the Meta "Bringing People Closer Together with AI" track.
Hackathon theme: fairy tales.

## Concept

An in-room party game where players draw in the air with their hands and try to get
their friends to guess the drawing before the AI does. The AI is the Magic Mirror: a
smug opponent that thinks it knows everything. The winning strategy is drawing with
shared context and inside jokes that only your friends will get.

Pitch: "Mirror, mirror, what did I draw?" Knowing your friends beats the smartest AI
in the room.

## Core game loop (main mode)

1. A TV/laptop shows the game (host screen). Players join by scanning a QR code on their
   phones (browser only, no app install).
2. In the lobby, each player writes a few prompts on their phone. These go into a shared
   pool. An AI-generated random prompt pool exists only as a fallback.
3. A random player becomes the artist. Their phone privately shows a few prompts written
   by other players; they pick one.
4. The artist draws in the air in front of the camera. Hand tracking draws strokes onto
   the host screen.
5. Everyone in the room shouts guesses freely (no buzz-in, no restrictions on talking).
   A listener transcribes the room and checks guesses against the prompt.
6. The Mirror (AI) guesses on a visible timer, about every 5 seconds, from canvas
   snapshots only. Its guesses are displayed on screen ("The Mirror sees: potato…").
7. First correct guess wins the round. The room winning = point for the Kingdom; the
   Mirror winning = point for the Mirror, with a dramatic reveal.
8. After each game mode: a highlight section ("Happily Ever Laughter") with clips of
   moments the room laughed, plus the Mirror's worst guesses and superlatives.

Scoring is the room vs. the Mirror ("Kingdom 7, Mirror 3"). Everyone, including the
current artist, is on the same team, so there is no need to attribute guesses to
individual players.

## Rules that matter

- Prompts must be things a stranger could guess ("horse", "lighthouse"). Inside jokes go
  in HOW you draw, not in the prompt. AI may gently flag prompts that look like names or
  private references, but humans write the prompts.
- The Mirror must NEVER receive the room transcript. It only sees the canvas.
- Guess judging is lenient ("kitty" counts for "cat"). Borderline calls go to the
  artist's phone: "Does this count?"

## Other modes and settings

- Imposter mode: everyone's phone shows the prompt except one imposter's. Players take
  turns adding one stroke each (about two laps), argue out loud, vote on phones. If the
  imposter is caught, they get one guess at the prompt to steal the win. (Inspired by
  the board game A Fake Artist Goes to New York.)
- Brushes (setting, any mode): hand, nose, elbow, foot, or random each round
  (pose tracking).
- Modifiers (setting, any mode): fading lines, mirrored canvas, blind drawing, only draw
  while moving fast. Off, chosen, or randomly spun each round.

## Superlatives (no individual guess tracking needed)

Based on artist stats and room-level events only: most Mirror-proof drawing, drawing the
Mirror got fastest, abstract artist (never guessed), comedian (who was drawing when the
room laughed hardest).

## Privacy design (part of the pitch)

- All camera processing runs in the browser (MediaPipe). Raw video never leaves the
  host device.
- Laugh detection is room-level only: detect that the room is laughing, never whose face
  is whose. No face recognition, no face templates, no per-person face tracking.
- Highlight clips use a rolling ~10-second in-memory buffer; only clips triggered by
  laughter are kept, locally, until the end of the mode.
- Explicit opt-in at the start and a visible "highlights on" indicator.
- End-of-mode review: anyone can veto a clip before anything is saved. Ephemeral by
  default.
- The Mirror receives canvas snapshots only, never camera frames.
- Transcription only runs during guessing windows; disclose that audio goes to the
  transcription API.

## AI pieces (Meta stack)

- Muse Spark (multimodal, accepts images): the Mirror's guesses from canvas snapshots,
  and lenient guess judging. Use the fastest mode/setting; latency must fit a ~5s guess
  cadence. Test this first.
- Muse Voice Transcribe: the room listener.
- Optional stretch: Muse Image glow-ups of drawings for the highlight section; a Muse
  connector exposing game history ("what did we draw last week?").

## Architecture sketch

- Host app (TV/laptop browser): camera, MediaPipe Hands/Pose, canvas rendering, mic
  capture, highlight buffer, main game display.
- Phone controller (mobile web): join via QR/room code, write prompts, pick prompts,
  imposter role, votes, "does this count?" confirmations, clip vetoes.
- Game server: room state, rounds, scoring, WebSockets to host and phones, proxies calls
  to Muse APIs (keep API keys server-side).
- Frontend framework: Vue (developer is comfortable with it). Backend: whatever is
  fastest to ship solo (Rust/Axum is familiar; Node is also fine).

## Build priority (solo, keep scope tight)

1. Phone join + lobby + prompt pool, hand-tracked air drawing on the host screen.
2. Listener + guess judging + the Mirror's timed guesses + room-vs-Mirror scoring.
   This is the demo; it must be rock solid.
3. Highlight section with laugh-triggered clips, veto, superlatives.
4. Imposter mode.
5. Brushes and modifiers.
6. Stretch: Muse Image glow-ups, Muse connector.

## Demo notes

- Fairy-tale theming: the Mirror as narrator/villain, "Kingdom vs. Mirror" scoreboard,
  sparkly wand-like strokes, highlight reel opens "Once upon a game night…".
- Avoid Disney-specific names, lyrics, or character designs; stick to public-domain
  folk tales.
- Have a fallback if an API is slow on stage (cached responses or a demo mode).
