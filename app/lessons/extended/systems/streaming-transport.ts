import { defineExtendedLesson } from "../define-lesson";

export const streamingTransportLesson = defineExtendedLesson({
    id: "streaming-transport",
    number: 8,
    courseId: "backend",
    courseTitle: "LLM Serving",
    courseNumber: 3,
    lessonNumber: 1,
    mode: "core-mechanism",
    modeLabel: "Practice protocol build",
    eyebrow: "Transport · SSE-compatible streams",
    title: "Streaming Transport",
    thesis: "A chat client needs a transport adapter that can turn UTF-8 bytes split at any point into typed events. Parsing, cancellation, and render timing should each have their own clear rules.",
    paperUrl: "https://html.spec.whatwg.org/multipage/server-sent-events.html",
    paperTitle: "Server-sent events",
    authors: "WHATWG HTML Living Standard",
    year: "Living standard",
    summary: [
      { label: "Decode bytes before you parse frames.", body: "ReadableStream chunks are Uint8Array values, and a chunk can stop in the middle of a UTF-8 character. TextDecoder.decode(chunk, { stream: true }) holds onto those incomplete bytes. The practice parser starts after that step, so its chunk argument is decoded text, never raw bytes." },
      { label: "Hold text until the frame is done.", body: "Every SSE frame ends with a blank line. Add the leftover text from the previous chunk, emit each complete frame, and return the unfinished ending. This lesson handles LF or CRLF lines, one optional space after the field colon, and \"message\" as the default event name." },
      { label: "Turn wire fields into app events.", body: "The event field gives the type, and data lines hold a JSON payload. The transport adapter returns typed token, metrics, done, or error events. That way React never has to care about byte boundaries or callbacks specific to one backend." },
      { label: "Keep request control separate from rendering.", body: "AbortSignal must stop the reader, parser, and generator at the adapter boundary. Render buffering is different: it can group several decoded token events into one React update, but it can't change their order or let generation keep running after cancellation." },
    ],
    claims: {
      paper: "The HTML event-stream format defines a one-way channel with named events, data fields, reconnect behavior, and UTF-8 framing.",
      lab: "The fixed browser trace compares a stream that finishes with one cancelled after four tokens. It shows when the parser and generator stop, how many late events arrive, and whether resources are released.",
      limit: "This stream runs locally. It doesn't recreate proxy buffering, reconnect fields, retry timing, or disconnects across regions.",
    },
    diagram: {
      title: "One token across arbitrary chunks",
      caption: "A chunk can split in the middle of a character or frame. TextDecoder owns byte carry, parseSseChunk holds the leftover decoded text, and the reducer only sees typed events.",
      nodes: [
        { label: "Byte chunks", value: "… e2 82 | ac …" },
        { label: "TextDecoder", value: "stream: true → decoded text" },
        { label: "Frame buffer", value: "remainder + chunk → blank line" },
        { label: "Typed event", value: "token · { delta: ‘€’ }" },
        { label: "Reducer", value: "append delta → render buffer" },
      ],
    },
    questions: {
      intro: "Ask about SSE framing, chunks split at any point, cancellation, adapters, or render backpressure.",
      suggestions: ["Why can one event span multiple chunks?", "Where should AbortSignal propagate?", "Why buffer token renders?"],
    },
    dataset: {
      name: "Token Event Trace",
      source: "Original fixed stream",
      license: "CC0",
      size: "14 frames · adversarial chunk boundaries",
      preview: "complete: meta → token × 10 → metrics → done · cancel: meta → token × 4 → abort → release",
    },
    implementation: {
      filename: "streaming-transport.py",
      intro: "Build framing and step-by-step parsing in Python using decoded text chunks. A streaming decoder has already turned the byte chunks into strings and saved any incomplete UTF-8 bytes.",
      codeBlocks: [
        {
          id: "encode-sse",
          label: "SSE encoder",
          purpose: "Turn one typed event into the event-stream wire format.",
          concepts: [
            { name: "event", detail: "One safe field value such as token, metrics, done, or error. Reject CR and LF." },
            { name: "data", detail: "json.dumps escapes quotes and newlines in the payload without changing the frame." },
            { name: "blank line", detail: "A final empty line (\\n\\n) ends the frame." },
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
          purpose: "Keep incomplete decoded text and emit only complete typed events.",
          concepts: [
            { name: "chunk", detail: "Text already decoded by TextDecoder, not a Uint8Array." },
            { name: "buffer", detail: "Decoded text that wasn't used yet and carries over to the next network chunk." },
            { name: "separator", detail: "A blank LF or CRLF line that marks the end of a frame." },
            { name: "remainder", detail: "Only the unfinished last frame gets saved for the next chunk." },
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
    experiment: { kind: "systems", variant: "streaming", title: "Replay complete and cancelled streams", intro: "Run the same planned response to completion, then replay it with cancellation after four tokens. Compare parsing, render buffering, when the generator stops, late events, and resource release." },
  });
