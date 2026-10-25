# Mirror, Mirror

*Mirror, mirror, what did I draw?* A party game where you draw in the air with your hand
and try to get your friends to guess it before the Magic Mirror, a smug AI, does. The
winning strategy is drawing with shared context and inside jokes: the Mirror can guess a
lighthouse, but not *the* lighthouse from your road trip.

Built solo for HackTX 2026, Meta's "Bringing People Closer Together with AI" track.

## How it plays

1. The game runs on a TV or laptop. Everyone joins by scanning the QR code in the Mirror (browser only, no app).
2. Players can add their own prompts from their phones; they're mixed in with a built-in list.
3. The artist secretly picks a prompt on their phone, then draws in the air: pinch to draw, hold still for the wand menu (colors, sizes, eraser, redo).
4. The room shouts guesses; a listener transcribes them. Every five seconds the Mirror guesses from the canvas.
5. First correct guess wins the round: a point for the Kingdom or the Mirror. Borderline calls go to the artist's phone.
6. At the end: the scales scoreboard, then *Happily Ever Laughter*, a reel of moments the room laughed.

## Running it

Needs Node.js 20+ and a webcam.

```bash
npm install
export MODEL_API_KEY=...        # PowerShell: $env:MODEL_API_KEY = "..."
npm run dev                     # phones join over the local Wi-Fi
npm run dev:tunnel              # campus/venue Wi-Fi: phones join through a Cloudflare tunnel
```

Open **http://localhost:3000** on the laptop (the camera needs `localhost`) and scan the QR code.

- Without `MODEL_API_KEY` the Mirror runs in **demo mode** (canned silly guesses) and the listener uses the browser's own speech recognition.
- `npm run dev:tunnel` needs [`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) (`winget install --id Cloudflare.cloudflared` on Windows). Many campus and guest networks block devices from reaching each other; the tunnel gets around that.
- `npm run latency` measures how fast Muse Spark guesses sample drawings.

## How it's built

| Piece | Tech |
| --- | --- |
| Host screen + phone controller | Vue 3, Vite (inside the Node server) |
| Game server | Node.js, WebSockets (`ws`); the server is authoritative, so the TV never receives the prompt mid-round |
| Air drawing | MediaPipe Hand Landmarker, in the browser |
| The Mirror's guesses + lenient judging | Meta Muse Spark (`muse-spark-1.1`, minimal reasoning) |
| The listener | Meta Muse Voice Transcribe |
| Laugh detection | MediaPipe audio classifier (YAMNet), in the browser |
| Phones on any network | Cloudflare quick tunnel, QR codes generated locally |

```
server/   game rules (game.mjs), the Mirror + listener (mirror.mjs), HTTP/WebSocket/tunnel (index.mjs)
web/      host screens (src/host), phone screens (src/phone), shared theme + Mirror art (src/shared)
scripts/  latency test and the original single-file playground
```

## Privacy

- Camera processing runs in the browser; video never leaves the laptop.
- The Mirror sees only a cropped snapshot of the drawing: never the camera, never the room's audio or transcript.
- Room audio is sent for transcription only while a round is being drawn.
- Laugh detection is room-level and audio-only: no faces, no face recognition.
- Laugh highlights are opt-in, kept in memory on the laptop, vetoable by anyone from their phone, and deleted when you play again.
