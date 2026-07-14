import { defineExtendedLesson } from "../define-lesson";

export const streamingTransportLesson = defineExtendedLesson({
    id: "streaming-transport",
    number: 8,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Mock protocol implementation",
    eyebrow: "Transport · SSE-compatible streams",
    title: "Streaming Transport",
    thesis: "A chat client needs a transport adapter that turns arbitrarily split UTF-8 bytes into typed events while keeping parsing, cancellation, and render pacing as separate contracts.",
    paperUrl: "https://html.spec.whatwg.org/multipage/server-sent-events.html",
    paperTitle: "Server-sent events",
    authors: "WHATWG HTML Living Standard",
    year: "Living standard",
    summary: [
      { label: "Decode bytes before parsing frames.", body: "ReadableStream chunks are Uint8Array values, and a chunk may end midway through one UTF-8 character. TextDecoder.decode(chunk, { stream: true }) retains those incomplete bytes. The practice parser starts after this step: its chunk argument is decoded text, never raw bytes." },
      { label: "Carry text until a frame is complete.", body: "Each SSE frame ends at a blank line. Prepend the previous text remainder, emit every complete frame, and return the unfinished suffix. This lesson supports LF or CRLF lines, an optional single space after the field colon, and the default event name message." },
      { label: "Convert wire fields into domain events.", body: "The event field supplies the type; data lines contain a JSON payload. The transport adapter returns typed token, metrics, done, or error events so React never depends on byte boundaries or backend-specific callbacks." },
      { label: "Keep lifecycle and presentation separate.", body: "AbortSignal must stop the reader, parser, and generator at the adapter boundary. Render buffering is different: it may batch several decoded token events into one React update, but it must not reorder events or let generation continue after cancellation." },
    ],
    claims: {
      paper: "The HTML event-stream format defines a one-way event channel with named events, data fields, reconnection behavior, and UTF-8 framing.",
      lab: "The deterministic browser trace compares a complete stream with cancellation after four tokens, including parser stop, generator stop, late-event count, and resource release.",
      limit: "The stream is local; proxy buffering, reconnection fields, retry timing, and multi-region disconnects are not reproduced.",
    },
    diagram: {
      title: "One token across arbitrary chunks",
      caption: "Bytes can split inside a character or frame. TextDecoder owns byte carry; parseSseChunk owns decoded-text carry; the reducer sees only typed events.",
      nodes: [
        { label: "Byte chunks", value: "… e2 82 | ac …" },
        { label: "TextDecoder", value: "stream: true → decoded text" },
        { label: "Frame buffer", value: "remainder + chunk → blank line" },
        { label: "Typed event", value: "token · { delta: ‘€’ }" },
        { label: "Reducer", value: "append delta → render buffer" },
      ],
    },
    questions: {
      intro: "Ask about SSE framing, arbitrary chunks, cancellation, adapters, or render backpressure.",
      suggestions: ["Why can one event span multiple chunks?", "Where should AbortSignal propagate?", "Why buffer token renders?"],
    },
    dataset: {
      name: "Token Event Trace",
      source: "Original deterministic stream",
      license: "CC0",
      size: "14 frames · adversarial chunk boundaries",
      preview: "complete: meta → token × 10 → metrics → done · cancel: meta → token × 4 → abort → release",
    },
    implementation: {
      filename: "streaming-transport.py",
      intro: "Implement framing and incremental parsing in Python against decoded text chunks. A streaming decoder has already converted byte chunks to strings and retained incomplete UTF-8 bytes.",
      codeBlocks: [
        {
          id: "encode-sse",
          label: "SSE encoder",
          purpose: "Serialize one typed event using the event-stream wire format.",
          concepts: [
            { name: "event", detail: "A single safe field value such as token, metrics, done, or error; CR and LF are rejected." },
            { name: "data", detail: "json.dumps escapes payload quotes and newlines without changing framing." },
            { name: "blank line", detail: "A final empty line (\\n\\n) terminates the frame." },
          ],
          code: `import json

def encode_sse(event, data):
    if not isinstance(event, str) or not event or "\\r" in event or "\\n" in event:
        raise ValueError("event name must be non-empty and contain no CR or LF")
    serialized = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event}\\ndata: {serialized}\\n\\n"`,
          checkCode: `frame = encode_sse("token", {"delta": "hi"})
RESULT = {
    "passed": frame == 'event: token\\ndata: {"delta":"hi"}\\n\\n',
    "detail": frame.replace("\\n", " ↵ "),
}`,
        },
        {
          id: "parse-sse",
          label: "Incremental parser",
          purpose: "Retain incomplete decoded text and emit only complete typed events.",
          concepts: [
            { name: "chunk", detail: "Decoded text from TextDecoder, not a Uint8Array." },
            { name: "buffer", detail: "Unconsumed decoded text carried across network chunks." },
            { name: "separator", detail: "An LF or CRLF blank line marking the end of one frame." },
            { name: "remainder", detail: "Only the partial final frame is saved for the next chunk." },
          ],
          code: `import json
import re

def parse_sse_chunk(buffer, chunk):
    combined = buffer + chunk
    parts = re.split(r"\\r?\\n\\r?\\n", combined)
    frames = parts[:-1]
    remainder = parts[-1]
    events = []

    for frame in frames:
        event = "message"
        data_lines = []

        for line in re.split(r"\\r?\\n", frame):
            if not line or line.startswith(":"):
                continue
            colon = line.find(":")
            field = line if colon == -1 else line[:colon]
            value = "" if colon == -1 else line[colon + 1:]
            if value.startswith(" "):
                value = value[1:]
            if field == "event" and value:
                event = value
            if field == "data":
                data_lines.append(value)

        serialized = "\\n".join(data_lines) if data_lines else "null"
        events.append({"event": event, "data": json.loads(serialized)})

    return {"events": events, "remainder": remainder}`,
          checkCode: `first = parse_sse_chunk("", 'event: token\\ndata: {"delta":"h')
second = parse_sse_chunk(first["remainder"], 'i"}\\n\\n')
RESULT = {
    "passed": (
        len(first["events"]) == 0
        and second["events"][0]["data"]["delta"] == "hi"
        and second["remainder"] == ""
    ),
    "detail": f'{len(second["events"])} event parsed across chunks',
}`,
        },
      ],
    },
    experiment: { kind: "systems", variant: "streaming", title: "Replay complete and cancelled streams", intro: "Replay the same authored response to completion or cancellation after four tokens. Compare parsing, render buffering, generator stop, late events, and resource release." },
  });
