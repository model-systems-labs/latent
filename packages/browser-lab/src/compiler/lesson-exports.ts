import { BrowserLabError } from "../errors";

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Replace comments and string/template literal contents with spaces while
 * preserving newlines and braces. This is intentionally a small declaration
 * scanner, not a JavaScript evaluator.
 */
function maskNonCode(source: string): string {
  const characters = [...source];
  let mode: "code" | "line-comment" | "block-comment" | "single" | "double" | "template" = "code";
  let escaped = false;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const next = characters[index + 1];
    if (mode === "code") {
      if (character === "/" && next === "/") {
        characters[index] = characters[index + 1] = " ";
        index += 1;
        mode = "line-comment";
      } else if (character === "/" && next === "*") {
        characters[index] = characters[index + 1] = " ";
        index += 1;
        mode = "block-comment";
      } else if (character === "'") {
        characters[index] = " ";
        mode = "single";
      } else if (character === "\"") {
        characters[index] = " ";
        mode = "double";
      } else if (character === "`") {
        characters[index] = " ";
        mode = "template";
      }
      continue;
    }

    if (character === "\n" && mode === "line-comment") {
      mode = "code";
      escaped = false;
      continue;
    }
    if (character === "\n") {
      escaped = false;
      continue;
    }
    characters[index] = " ";
    if (mode === "block-comment" && character === "*" && next === "/") {
      characters[index + 1] = " ";
      index += 1;
      mode = "code";
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\" && mode !== "block-comment" && mode !== "line-comment") {
      escaped = true;
      continue;
    }
    if ((mode === "single" && character === "'") || (mode === "double" && character === "\"") || (mode === "template" && character === "`")) {
      mode = "code";
    }
  }
  return characters.join("");
}

function topLevelFunctionNames(source: string): Set<string> {
  const masked = maskNonCode(source);
  const depthAt = new Uint32Array(masked.length + 1);
  let depth = 0;
  for (let index = 0; index < masked.length; index += 1) {
    depthAt[index] = depth;
    if (masked[index] === "{") depth += 1;
    else if (masked[index] === "}" && depth > 0) depth -= 1;
  }
  const names = new Set<string>();
  const declaration = /^[\t ]*(?:async[\t ]+)?function[\t ]*\*?[\t ]*([A-Za-z_$][A-Za-z0-9_$]*)[\t ]*\(/gm;
  for (const match of masked.matchAll(declaration)) {
    if (match.index !== undefined && depthAt[match.index] === 0) names.add(match[1]);
  }
  return names;
}

/**
 * Turn a lesson cell containing ordinary top-level function declarations into
 * an ES module. Existing exports are rejected so the supplied allowlist is the
 * complete public surface, not merely an additional set of exports.
 */
export function exposeLessonFunctions(source: string, allowlist: readonly string[]): string {
  if (!allowlist.length) throw new BrowserLabError("EMPTY_EXPORT_ALLOWLIST", "At least one lesson function must be exposed.");
  const unique = new Set<string>();
  for (const name of allowlist) {
    if (!IDENTIFIER.test(name)) throw new BrowserLabError("INVALID_EXPORT_NAME", `Invalid lesson export name: ${JSON.stringify(name)}.`);
    if (unique.has(name)) throw new BrowserLabError("DUPLICATE_EXPORT", `Duplicate lesson export name: ${name}.`);
    unique.add(name);
  }

  const masked = maskNonCode(source);
  if (/\bexport\b/.test(masked)) {
    throw new BrowserLabError("EXISTING_EXPORTS", "Lesson source with existing exports cannot be safely narrowed to an allowlist.");
  }
  const declarations = topLevelFunctionNames(source);
  const missing = allowlist.filter((name) => !declarations.has(name));
  if (missing.length) {
    throw new BrowserLabError("MISSING_LESSON_EXPORT", `No top-level function declaration was found for: ${missing.join(", ")}.`);
  }
  return `${source.replace(/\s+$/, "")}\n\nexport { ${allowlist.join(", ")} };\n`;
}

