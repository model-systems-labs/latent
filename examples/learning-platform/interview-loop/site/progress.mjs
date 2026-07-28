const safeEncode = TextEncoder.prototype.encode.call.bind(TextEncoder.prototype.encode);
const encoder = new TextEncoder();

export async function sha256Hex(source) {
  const digest = await crypto.subtle.digest("SHA-256", safeEncode(encoder, source));
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export function learningPackProgressIdentity(pack, packDigest) {
  const packageId = pack?.package?.id;
  const packageVersion = pack?.package?.version;
  if (typeof packageId !== "string" || typeof packageVersion !== "string") {
    throw new Error("Learning Pack progress requires a package id and version.");
  }
  if (!/^[a-f0-9]{64}$/.test(packDigest ?? "")) {
    throw new Error("Learning Pack progress requires the exact SHA-256 digest.");
  }
  return Object.freeze({
    packageId,
    packageVersion,
    packageDigest: packDigest,
    namespace: `latent-learning-pack:${packageId}@${packageVersion}:sha256:${packDigest}`,
  });
}

export function createJsonStorage(storageArea, namespace) {
  if (
    typeof storageArea?.getItem !== "function"
    || typeof storageArea?.setItem !== "function"
    || typeof storageArea?.removeItem !== "function"
    || typeof namespace !== "string"
    || namespace.length === 0
  ) {
    throw new Error("Progress storage requires a storage area and namespace.");
  }
  return Object.freeze({
    read(key, fallback) {
      try {
        const value = storageArea.getItem(`${namespace}:${key}`);
        return value === null ? fallback : JSON.parse(value);
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      try {
        storageArea.setItem(`${namespace}:${key}`, JSON.stringify(value));
        return true;
      } catch {
        // The platform remains usable without durable device storage.
        return false;
      }
    },
    remove(key) {
      try {
        storageArea.removeItem(`${namespace}:${key}`);
      } catch {
        // The platform remains usable without durable device storage.
      }
    },
  });
}

export function createLearningPackStateStore(storageArea, pack, packDigest) {
  const identity = learningPackProgressIdentity(pack, packDigest);
  return Object.freeze({
    identity,
    store: createJsonStorage(storageArea, identity.namespace),
  });
}

export function practiceContractVersion(library, libraryDigest, groupId, questionId) {
  return [
    `question-groups-v${library.schemaVersion}`,
    `${library.library.id}@${library.library.version}`,
    `sha256:${libraryDigest}`,
    `${groupId}/${questionId}`,
  ].join(":");
}

export function practiceProgressIdentity(library, libraryDigest, question) {
  const contractVersion = practiceContractVersion(
    library,
    libraryDigest,
    question.groupId,
    question.id,
  );
  return Object.freeze({
    libraryId: library.library.id,
    libraryVersion: library.library.version,
    libraryDigest,
    groupId: question.groupId,
    questionId: question.id,
    contractVersion,
  });
}

export function progressMatchesIdentity(progress, identity) {
  return Boolean(progress)
    && progress.libraryId === identity.libraryId
    && progress.libraryVersion === identity.libraryVersion
    && progress.libraryDigest === identity.libraryDigest
    && progress.groupId === identity.groupId
    && progress.questionId === identity.questionId
    && progress.contractVersion === identity.contractVersion
    && /^[a-f0-9]{64}$/.test(progress.sourceDigest ?? "");
}

export function isLeechProgress(progress) {
  return progress?.status !== "solved"
    && (progress?.attemptCount ?? 0) >= 3
    && (progress?.failureCount ?? 0) >= 2;
}

export function nextPracticeProgress(
  identity,
  current,
  { sourceDigest, passed, attemptedAt },
) {
  if (!/^[a-f0-9]{64}$/.test(sourceDigest)) {
    throw new Error("Practice progress requires the exact submitted-source digest.");
  }
  if (!Number.isSafeInteger(attemptedAt) || attemptedAt < 0) {
    throw new Error("Practice progress requires a nonnegative millisecond timestamp.");
  }
  const previous = progressMatchesIdentity(current, identity) ? current : null;
  const attemptCount = (previous?.attemptCount ?? 0) + 1;
  const failureCount = (previous?.failureCount ?? 0) + (passed ? 0 : 1);
  return Object.freeze({
    ...identity,
    sourceDigest,
    status: passed ? "solved" : "attempted",
    attemptCount,
    failureCount,
    lastAttemptAt: attemptedAt,
    solvedAt: passed ? attemptedAt : null,
    updatedAt: attemptedAt,
  });
}
