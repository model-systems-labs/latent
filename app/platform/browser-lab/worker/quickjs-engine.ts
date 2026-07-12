import variant from "@jitl/quickjs-wasmfile-release-sync";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
} from "quickjs-emscripten-core";
import type { ExerciseCase, InvocationObservation, JsonValue, SandboxRunRequest } from "../types";
import type { SandboxEngine, SandboxLogSink } from "./engine";

const quickJSModule = newQuickJSWASMModuleFromVariant(variant);

class VmFailure extends Error {
  readonly errorName: string;

  constructor(errorName: string, message: string) {
    super(message);
    this.name = "VmFailure";
    this.errorName = errorName;
  }
}

function clockNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function errorFromHandle(context: QuickJSContext, handle: QuickJSHandle): VmFailure {
  const dumped = context.dump(handle) as { name?: unknown; message?: unknown } | unknown;
  if (dumped && typeof dumped === "object") {
    const candidate = dumped as { name?: unknown; message?: unknown };
    return new VmFailure(typeof candidate.name === "string" ? candidate.name : "Error", typeof candidate.message === "string" ? candidate.message : "Learner code threw an error.");
  }
  return new VmFailure("Error", typeof dumped === "string" ? dumped : "Learner code threw an error.");
}

function evaluateCode(context: QuickJSContext, code: string, filename: string): void {
  const result = context.evalCode(code, filename, { type: "global" });
  try {
    if (result.error) throw errorFromHandle(context, result.error);
  } finally {
    result.dispose();
  }
}

function installDeterministicIntrinsics(context: QuickJSContext, seed: number, nowMs: number): void {
  const source = `(() => {
    "use strict";
    let state = ${seed >>> 0} || 0x6d2b79f5;
    const random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    Object.defineProperty(Math, "random", { value: random, writable: false, configurable: false });
    const NativeDate = Date;
    const NativeMap = Map;
    const NativeSet = Set;
    const objectEntries = Object.entries;
    const objectFromEntries = Object.fromEntries;
    const arrayIsArray = Array.isArray;
    const fixedNow = ${Math.trunc(nowMs)};
    class DeterministicDate extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [fixedNow])); }
      static now() { return fixedNow; }
    }
    Object.defineProperty(globalThis, "Date", { value: DeterministicDate, writable: false, configurable: false });
    const normalizeForHost = (value, seen = new NativeSet(), depth = 0) => {
      if (value === null || typeof value === "string" || typeof value === "boolean") return value;
      if (typeof value === "number") {
        if (Number.isFinite(value)) return value;
        return { $number: Number.isNaN(value) ? "NaN" : value === Infinity ? "Infinity" : "-Infinity" };
      }
      if (!value || typeof value !== "object" || depth > 50 || seen.has(value)) throw new Error("The return value is not bounded JSON data.");
      seen.add(value);
      let normalized;
      if (value instanceof NativeMap) normalized = objectFromEntries([...value.entries()].map(([key, item]) => [String(key), normalizeForHost(item, seen, depth + 1)]));
      else if (value instanceof NativeSet) normalized = [...value.values()].map((item) => normalizeForHost(item, seen, depth + 1));
      else if (arrayIsArray(value)) normalized = value.map((item) => normalizeForHost(item, seen, depth + 1));
      else normalized = objectFromEntries(objectEntries(value).map(([key, item]) => [key, normalizeForHost(item, seen, depth + 1)]));
      seen.delete(value);
      return normalized;
    };
    Object.defineProperty(globalThis, "__browserLabNormalize", { value: normalizeForHost, writable: false, configurable: false });
    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "localStorage", "indexedDB", "Worker", "postMessage", "importScripts"]) {
      try { delete globalThis[name]; } catch {}
    }
  })();`;
  evaluateCode(context, source, "browser-lab:deterministic-intrinsics");
}

function installConsole(context: QuickJSContext, log: SandboxLogSink): void {
  const globalHandle = context.global;
  const consoleHandle = context.newObject();
  try {
    for (const level of ["debug", "info", "warn", "error"] as const) {
      const functionHandle = context.newFunction(level, (...handles) => {
        log(level, handles.map((handle) => context.dump(handle)));
        return context.undefined;
      });
      try { context.setProp(consoleHandle, level, functionHandle); } finally { functionHandle.dispose(); }
    }
    const logHandle = context.newFunction("log", (...handles) => {
      log("info", handles.map((handle) => context.dump(handle)));
      return context.undefined;
    });
    try { context.setProp(consoleHandle, "log", logHandle); } finally { logHandle.dispose(); }
    context.setProp(globalHandle, "console", consoleHandle);
  } finally {
    consoleHandle.dispose();
    globalHandle.dispose();
  }
}

function createJsonHandle(context: QuickJSContext, value: JsonValue, handles: QuickJSHandle[]): QuickJSHandle {
  let handle: QuickJSHandle;
  if (value === null) handle = context.null.dup();
  else if (typeof value === "string") handle = context.newString(value);
  else if (typeof value === "number") handle = context.newNumber(value);
  else if (typeof value === "boolean") handle = (value ? context.true : context.false).dup();
  else if (Array.isArray(value)) {
    handle = context.newArray();
    for (let index = 0; index < value.length; index += 1) {
      const child = createJsonHandle(context, value[index], handles);
      context.setProp(handle, index, child);
    }
  } else {
    handle = context.newObject();
    for (const [key, childValue] of Object.entries(value)) {
      const child = createJsonHandle(context, childValue, handles);
      context.setProp(handle, key, child);
    }
  }
  handles.push(handle);
  return handle;
}

function normalizeJsonValue(value: unknown, maximumBytes: number): JsonValue {
  const seen = new Set<object>();
  const visit = (candidate: unknown, depth: number): JsonValue => {
    if (candidate === null || typeof candidate === "string" || typeof candidate === "boolean") return candidate;
    if (typeof candidate === "number") {
      if (Number.isFinite(candidate)) return candidate;
      return { $number: Number.isNaN(candidate) ? "NaN" : candidate === Number.POSITIVE_INFINITY ? "Infinity" : "-Infinity" };
    }
    if (!candidate || typeof candidate !== "object" || depth > 50) throw new VmFailure("SerializationError", "The return value is not bounded JSON data.");
    if (seen.has(candidate)) throw new VmFailure("SerializationError", "The return value contains a cycle.");
    seen.add(candidate);
    const result: JsonValue = Array.isArray(candidate)
      ? candidate.map((item) => visit(item, depth + 1))
      : Object.fromEntries(Object.entries(candidate).map(([key, item]) => [key, visit(item, depth + 1)]));
    seen.delete(candidate);
    return result;
  };
  const normalized = visit(value, 0);
  if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > maximumBytes) {
    throw new VmFailure("SerializationError", `The return value exceeds ${maximumBytes} serialized bytes.`);
  }
  return normalized;
}

function classifyFailure(error: unknown, deadlineReached: boolean): InvocationObservation {
  const failure = error instanceof VmFailure ? error : new VmFailure(error instanceof Error ? error.name : "Error", error instanceof Error ? error.message : "The sandbox failed.");
  if (deadlineReached || /interrupted/i.test(failure.message)) return { status: "timed-out", message: "The invocation exceeded its CPU limit." };
  if (/out of memory|allocation|stack overflow/i.test(failure.message)) return { status: "resource-error", message: "The invocation exceeded its memory or stack limit." };
  if (failure.errorName === "SerializationError") return { status: "harness-error", message: failure.message };
  return { status: "threw", errorName: failure.errorName, message: failure.message };
}

export class QuickJSSandboxEngine implements SandboxEngine {
  async observe(request: SandboxRunRequest, exerciseCase: ExerciseCase, log: SandboxLogSink): Promise<InvocationObservation> {
    const compiledModule = request.program.modules.find((candidate) => candidate.modulePath === exerciseCase.invoke.modulePath);
    if (!compiledModule) return { status: "harness-error", message: `Compiled module not found: ${exerciseCase.invoke.modulePath}.` };
    const QuickJS = await quickJSModule;
    const runtime = QuickJS.newRuntime();
    runtime.setMemoryLimit(request.limits.memoryLimitBytes);
    runtime.setMaxStackSize(request.limits.stackLimitBytes);
    const deadline = clockNow() + request.limits.cpuTimeoutMs;
    runtime.setInterruptHandler(() => clockNow() >= deadline);
    const context = runtime.newContext();
    try {
      installConsole(context, log);
      installDeterministicIntrinsics(context, request.deterministicSeed, request.deterministicNowMs);
      evaluateCode(context, compiledModule.code, compiledModule.modulePath);
      const globalHandle = context.global;
      const moduleHandle = context.getProp(globalHandle, compiledModule.globalName);
      const functionHandle = context.getProp(moduleHandle, exerciseCase.invoke.exportName);
      const argumentHandles: QuickJSHandle[] = [];
      try {
        if (context.typeof(moduleHandle) !== "object") throw new VmFailure("MissingModule", `Compiled module ${compiledModule.modulePath} did not expose ${compiledModule.globalName}.`);
        if (context.typeof(functionHandle) !== "function") throw new VmFailure("MissingExport", `Export ${exerciseCase.invoke.exportName} is not a function.`);
        const args = exerciseCase.invoke.args.map((value) => createJsonHandle(context, value, argumentHandles));
        const result = context.callFunction(functionHandle, moduleHandle, args);
        try {
          if (result.error) throw errorFromHandle(context, result.error);
          const normalizeHandle = context.getProp(globalHandle, "__browserLabNormalize");
          try {
            const normalized = context.callFunction(normalizeHandle, globalHandle, [result.value]);
            try {
              if (normalized.error) throw errorFromHandle(context, normalized.error);
              return { status: "returned", value: normalizeJsonValue(context.dump(normalized.value), request.limits.maxSerializedValueBytes) };
            } finally {
              normalized.dispose();
            }
          } finally {
            normalizeHandle.dispose();
          }
        } finally {
          result.dispose();
        }
      } finally {
        for (const handle of [...argumentHandles].reverse()) if (handle.alive) handle.dispose();
        functionHandle.dispose();
        moduleHandle.dispose();
        globalHandle.dispose();
      }
    } catch (error) {
      return classifyFailure(error, clockNow() >= deadline);
    } finally {
      context.dispose();
      runtime.dispose();
    }
  }
}
