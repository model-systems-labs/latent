"use client";

import { useEffect, useRef, useState } from "react";
import type { CourseLesson } from "@latent/course-kit";
import {
  TRUSTED_INTERACTIVE_LIMITS,
  isBoundedTrustedInteractiveJson,
  prepareTrustedInteractiveBundle,
  type TrustedInteractiveDefinition,
  type TrustedInteractiveJson,
} from "@/app/features/trusted-interactives/contract";
import {
  mountTrustedInteractiveFrame,
  type TrustedInteractiveFrameRequest,
  type TrustedInteractiveFrameSession,
} from "@/app/features/trusted-interactives/frame";
import {
  TrustedInteractivePersistenceError,
  cloneBoundedTrustedInteractiveState,
  createTrustedInteractiveStatePersistence,
  type TrustedInteractiveStateIdentity,
} from "@/app/features/trusted-interactives/persistence";
import { isExperimentDurablyComplete } from "@/app/lib/learner-state";
import {
  resolveTrustedInteractive,
  validateTrustedInteractiveCheckpoint,
  type TrustedInteractiveStateTransitionEvidence,
} from "@/app/features/trusted-interactives/registry";
import {
  createTrustedInteractiveVisualContext,
  trustedInteractiveVisualContextJson,
  trustedInteractiveVisualCss,
} from "@/app/features/trusted-interactives/visual-contract";
import { getLessonFlair } from "@/examples/learning-platform/llm-learning/lessons/lesson-flair";
import styles from "@/app/features/trusted-interactives/TrustedInteractiveFrame.module.css";

type HostState = {
  state: TrustedInteractiveJson;
  revision: number;
  token: string | null;
  storage: "device" | "visit-only";
  ready: boolean;
};

type StatusTone = "neutral" | "complete" | "error";

type Status = {
  message: string;
  tone: StatusTone;
};

function cloneJson(value: TrustedInteractiveJson): TrustedInteractiveJson {
  return JSON.parse(JSON.stringify(value)) as TrustedInteractiveJson;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function requestError(error: unknown): { code: string; message: string } {
  if (error instanceof TrustedInteractivePersistenceError) {
    return {
      code: error.code === "WRITE_CONFLICT" ? "write-conflict" : "invalid-state",
      message: error.message,
    };
  }
  return {
    code: "host-error",
    message: error instanceof Error ? error.message : "The interactive host request failed.",
  };
}

function frameHeight(definition: TrustedInteractiveDefinition, requested: number): number {
  return Math.round(Math.min(
    definition.frame.maximumHeight,
    Math.max(definition.frame.minimumHeight, requested),
  ));
}

export function TrustedInteractiveFrame({
  lesson,
  onComplete,
}: {
  lesson: CourseLesson;
  onComplete: () => Promise<void> | void;
}) {
  const reference = lesson.experiment.interactive;
  const definition = reference ? resolveTrustedInteractive(reference) : null;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const sessionRef = useRef<TrustedInteractiveFrameSession | null>(null);
  const resetActionRef = useRef<(() => Promise<void>) | null>(null);
  const onCompleteRef = useRef(onComplete);
  const resetNoticeRef = useRef(false);
  const [generation, setGeneration] = useState(0);
  const [height, setHeight] = useState(definition?.frame.minimumHeight ?? 420);
  const [frameReady, setFrameReady] = useState(false);
  const [resetReady, setResetReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<Status>({
    message: definition ? "Preparing the interactive…" : "The interactive is unavailable.",
    tone: definition ? "neutral" : "error",
  });
  const [fatalError, setFatalError] = useState(
    definition ? "" : "This lesson references a trusted interactive that is not registered in this build.",
  );

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!definition || !iframe) return;

    let cancelled = false;
    const persistence = createTrustedInteractiveStatePersistence();
    const flair = getLessonFlair(lesson.id);
    const courseId = lesson.programId ?? lesson.courseId;
    const hostState: HostState = {
      state: cloneJson(definition.initialState),
      revision: 0,
      token: null,
      storage: "device",
      ready: false,
    };
    const acceptedCheckpoints = new Set<string>();
    const validatedCheckpoints = new Set<string>();
    const recordedEvents: Array<{
      event: string;
      payload: TrustedInteractiveJson;
      sequence: number;
    }> = [];
    const stateTransitions: TrustedInteractiveStateTransitionEvidence[] = [];
    let eventSequence = 0;
    let lastTransitionSequence = 0;
    let identity: TrustedInteractiveStateIdentity | null = null;
    let loadPromise: Promise<void> | null = null;
    let acceptingRequests = true;
    let requestQueue: Promise<void> = Promise.resolve();

    const updateStatus = (next: Status) => {
      if (!cancelled) setStatus(next);
    };

    const loadState = async () => {
      if (!identity || hostState.ready) return;
      try {
        const loaded = await persistence.load(identity);
        if (loaded) {
          hostState.state = cloneJson(loaded.record.state as TrustedInteractiveJson);
          hostState.revision = loaded.record.revision;
          hostState.token = loaded.token;
        }
        hostState.storage = "device";
        const resetCompleted = resetNoticeRef.current;
        resetNoticeRef.current = false;
        updateStatus({
          message: resetCompleted
            ? "Interactive state reset. Completed lesson progress was kept."
            : loaded
            ? "Restored your saved interactive state on this device."
            : "Interactive state will save on this device.",
          tone: resetCompleted || loaded ? "complete" : "neutral",
        });
      } catch (error) {
        if (
          error instanceof TrustedInteractivePersistenceError
          && error.code === "INVALID_STORED_STATE"
          && error.token
        ) {
          try {
            await persistence.reset(identity, error.token);
          } catch {
            // A competing tab may already have repaired the invalid record.
          }
        }
        hostState.state = cloneJson(definition.initialState);
        hostState.revision = 0;
        hostState.token = null;
        hostState.storage = "visit-only";
        updateStatus({
          message: "State storage is unavailable, so changes will last only for this visit.",
          tone: "error",
        });
      } finally {
        hostState.ready = true;
        if (!cancelled) setResetReady(true);
      }
    };

    const ensureState = async () => {
      loadPromise ??= loadState();
      await loadPromise;
    };

    const ensureActive = () => {
      if (cancelled || !acceptingRequests) {
        throw new Error("The interactive host session has closed.");
      }
    };

    const settleRequest = async (
      message: TrustedInteractiveFrameRequest,
    ): Promise<TrustedInteractiveJson> => {
      await ensureState();
      ensureActive();

      if (message.method === "context.get") {
        if (message.payload !== null || !identity) {
          throw new Error("The interactive requested malformed host context.");
        }
        return {
          state: cloneJson(hostState.state),
          revision: hostState.revision,
          input: cloneJson(definition.input),
          visual: trustedInteractiveVisualContextJson(visualContext),
          identity: { ...identity },
          storage: hostState.storage,
        };
      }

      if (message.method === "state.save") {
        if (
          !isPlainRecord(message.payload)
          || !hasExactKeys(message.payload, ["revision", "state"])
          || !Number.isSafeInteger(message.payload.revision)
          || message.payload.revision !== hostState.revision
          || !isBoundedTrustedInteractiveJson(message.payload.state, {
            maxBytes: TRUSTED_INTERACTIVE_LIMITS.maxStateBytes,
          })
          || !identity
        ) {
          throw new TrustedInteractivePersistenceError(
            "INVALID_STATE",
            "The interactive tried to save malformed or stale state.",
          );
        }
        const nextState = cloneBoundedTrustedInteractiveState(
          message.payload.state,
        ) as TrustedInteractiveJson;
        const beforeState = cloneJson(hostState.state);
        if (hostState.storage === "device") {
          const saved = await persistence.save(identity, nextState, hostState.token);
          hostState.state = cloneJson(saved.record.state as TrustedInteractiveJson);
          hostState.revision = saved.record.revision;
          hostState.token = saved.token;
          ensureActive();
        } else {
          hostState.state = cloneJson(nextState);
          hostState.revision += 1;
        }
        if (
          message.interaction
          && message.interaction.sequence > lastTransitionSequence
          && JSON.stringify(beforeState) !== JSON.stringify(hostState.state)
        ) {
          stateTransitions.push({
            interaction: { ...message.interaction },
            beforeState,
            afterState: cloneJson(hostState.state),
          });
          lastTransitionSequence = message.interaction.sequence;
          if (stateTransitions.length > 64) stateTransitions.shift();
        }
        return { revision: hostState.revision };
      }

      if (message.method === "events.record") {
        if (
          !isPlainRecord(message.payload)
          || !hasExactKeys(message.payload, ["event", "payload"])
          || typeof message.payload.event !== "string"
          || !definition.events.includes(message.payload.event)
          || !isBoundedTrustedInteractiveJson(message.payload.payload)
        ) {
          throw new Error("The interactive emitted an event outside its reviewed allowlist.");
        }
        eventSequence += 1;
        recordedEvents.push({
          event: message.payload.event,
          payload: cloneJson(message.payload.payload),
          sequence: eventSequence,
        });
        if (recordedEvents.length > 64) recordedEvents.shift();
        return { recorded: true, retention: "visit", sequence: eventSequence };
      }

      if (message.method === "progress.request") {
        if (
          !isPlainRecord(message.payload)
          || !hasExactKeys(message.payload, ["checkpointId", "payload"])
          || typeof message.payload.checkpointId !== "string"
          || !definition.completionCheckpoints.includes(message.payload.checkpointId)
          || !isBoundedTrustedInteractiveJson(message.payload.payload)
        ) {
          throw new Error("The interactive did not provide valid completion evidence.");
        }
        const checkpointId = message.payload.checkpointId;
        if (
          acceptedCheckpoints.has(checkpointId)
          || await isExperimentDurablyComplete(lesson.id)
        ) {
          acceptedCheckpoints.add(checkpointId);
          return { accepted: true, checkpointId };
        }
        if (
          !validatedCheckpoints.has(checkpointId)
          && !validateTrustedInteractiveCheckpoint(
            definition,
            checkpointId,
            message.payload.payload,
            hostState.state,
            {
              transitions: stateTransitions,
              completionInteraction: message.interaction,
            },
          )
        ) {
          throw new Error("The interactive did not provide valid completion evidence.");
        }
        validatedCheckpoints.add(checkpointId);
        if (!acceptedCheckpoints.has(checkpointId)) {
          await Promise.resolve(onCompleteRef.current());
          ensureActive();
          acceptedCheckpoints.add(checkpointId);
        }
        return { accepted: true, checkpointId };
      }

      throw new Error("The interactive requested an unsupported host method.");
    };

    const visualContext = createTrustedInteractiveVisualContext({
      palette: definition.appearance?.palette,
      lessonTone: flair?.tone,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      forcedColors: window.matchMedia("(forced-colors: active)").matches,
    });

    void prepareTrustedInteractiveBundle(
      definition,
      trustedInteractiveVisualCss(visualContext),
    ).then((bundle) => {
      if (cancelled) return;
      if (!courseId) {
        throw new Error("A trusted interactive lesson requires an explicit course or program id.");
      }
      identity = {
        courseId,
        lessonId: lesson.id,
        interactiveId: definition.id,
        definitionVersion: definition.definitionVersion,
        sourceHash: bundle.sourceHash,
        stateSchemaVersion: definition.stateSchemaVersion,
      };
      resetActionRef.current = async () => {
        acceptingRequests = false;
        await requestQueue.catch(() => undefined);
        await ensureState();
        if (identity && hostState.storage === "device" && hostState.token) {
          const removed = await persistence.reset(identity, hostState.token);
          if (!removed) {
            throw new TrustedInteractivePersistenceError(
              "WRITE_CONFLICT",
              "Interactive state changed in another tab. Reload before resetting it.",
            );
          }
        }
        hostState.state = cloneJson(definition.initialState);
        hostState.revision = 0;
        hostState.token = null;
      };

      let session: TrustedInteractiveFrameSession | null = null;
      session = mountTrustedInteractiveFrame({
        iframe,
        bundle,
        allowedMethods: new Set(definition.capabilities),
        handlers: {
          onReady: (message) => {
            if (
              message.id !== definition.id
              || message.sourceHash !== bundle.sourceHash
            ) {
              setFatalError("The interactive frame reported the wrong trusted source identity.");
              setStatus({ message: "The interactive failed its identity check.", tone: "error" });
              session?.dispose();
              return;
            }
            setFrameReady(true);
          },
          onResize: (requestedHeight) => {
            setHeight(frameHeight(definition, requestedHeight));
          },
          onError: (message) => {
            setFrameReady(false);
            setFatalError(message.message);
            setStatus({ message: "The interactive reported a runtime error.", tone: "error" });
            session?.dispose();
          },
          onProtocolViolation: () => {
            setFrameReady(false);
            setFatalError("The interactive sent a message outside its reviewed protocol.");
            setStatus({ message: "The interactive protocol was rejected.", tone: "error" });
            session?.dispose();
          },
          onRequest: (message) => {
            if (!acceptingRequests || cancelled) return;
            const processRequest = async () => {
              try {
                const value = await settleRequest(message);
                session?.respond(message.requestId, value);
              } catch (error) {
                const failure = requestError(error);
                if (failure.code === "write-conflict") {
                  updateStatus({ message: failure.message, tone: "error" });
                }
                try {
                  session?.fail(message.requestId, failure.code, failure.message);
                } catch {
                  // Disposal can settle the frame before an asynchronous host call.
                }
              }
            };
            requestQueue = requestQueue
              .catch(() => undefined)
              .then(processRequest);
          },
        },
      });
      sessionRef.current = session;
    }).catch((error) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "The interactive bundle could not be prepared.";
      setFatalError(message);
      setStatus({ message: "The interactive could not be prepared.", tone: "error" });
    });

    return () => {
      cancelled = true;
      acceptingRequests = false;
      resetActionRef.current = null;
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, [definition, generation, lesson.courseId, lesson.id, lesson.programId]);

  const restartFrame = () => {
    setFatalError("");
    setFrameReady(false);
    setResetReady(false);
    setHeight(definition?.frame.minimumHeight ?? 420);
    setStatus({ message: "Preparing the interactive…", tone: "neutral" });
    setGeneration((value) => value + 1);
  };

  const reset = async () => {
    if (!resetActionRef.current || resetting) return;
    setResetting(true);
    setStatus({ message: "Resetting the interactive…", tone: "neutral" });
    try {
      await resetActionRef.current();
      sessionRef.current?.dispose();
      resetNoticeRef.current = true;
      restartFrame();
    } catch (error) {
      const failure = requestError(error);
      sessionRef.current?.dispose();
      sessionRef.current = null;
      setFrameReady(false);
      setResetReady(false);
      setFatalError(failure.message);
      setStatus({ message: failure.message, tone: "error" });
    } finally {
      setResetting(false);
    }
  };

  const statusId = `trusted-interactive-status-${lesson.id}`;
  const resetNoteId = `trusted-interactive-reset-note-${lesson.id}`;

  return (
    <div
      className={styles.host}
      data-interactive-id={definition?.id ?? "missing"}
      data-frame-ready={frameReady ? "true" : "false"}
    >
      <div className={styles.frameSurface} aria-busy={!frameReady && !fatalError}>
        <iframe
          key={generation}
          ref={iframeRef}
          className={styles.frame}
          title={definition?.frame.title ?? "Unavailable trusted lesson interactive"}
          style={{ height }}
          tabIndex={frameReady && !fatalError ? 0 : -1}
          aria-hidden={!frameReady || Boolean(fatalError)}
        />
        {!frameReady && !fatalError ? (
          <div className={styles.loading} role="status">
            <span aria-hidden="true" />
            Preparing the worked example…
          </div>
        ) : null}
        {fatalError ? (
          <div className={styles.error} role="alert">
            <strong>This interactive could not start.</strong>
            <p>{fatalError}</p>
            <button type="button" onClick={restartFrame}>
              Reload interactive
            </button>
          </div>
        ) : null}
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerCopy}>
          <p
            id={statusId}
            role="status"
            aria-live="polite"
            data-tone={status.tone}
          >
            {status.message}
          </p>
          <small id={resetNoteId}>
            Reset clears this interactive&apos;s saved state; completed lesson progress is kept.
          </small>
        </div>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={!resetReady || resetting}
          aria-describedby={`${statusId} ${resetNoteId}`}
        >
          {resetting ? "Resetting…" : "Reset interactive"}
        </button>
      </footer>
    </div>
  );
}
