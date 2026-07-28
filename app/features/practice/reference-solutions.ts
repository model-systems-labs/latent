/**
 * Reviewed, host-owned reference implementations for the bundled method
 * practice library. These are intentionally separate from the declarative
 * Question Group so portable content cannot grant executable authority.
 */
export const methodPracticeReferenceSolutions = {
  "unique-values": `class Solution {
  uniqueValues(values: number[]): number[] {
    return [...new Set(values)];
  }
}
`,
  "pair-target-indices": `class Solution {
  pairTargetIndices(values: number[], target: number): number[] {
    const earliestIndex = new Map<number, number>();
    for (let index = 0; index < values.length; index += 1) {
      const partnerIndex = earliestIndex.get(target - values[index]);
      if (partnerIndex !== undefined) return [partnerIndex, index];
      if (!earliestIndex.has(values[index])) earliestIndex.set(values[index], index);
    }
    return [];
  }
}
`,
  "group-equivalent-words": `class Solution {
  groupEquivalentWords(words: string[]): string[][] {
    const groups = new Map<string, string[]>();
    for (const word of words) {
      const signature = [...word].sort().join("");
      const group = groups.get(signature);
      if (group) group.push(word);
      else groups.set(signature, [word]);
    }
    return [...groups.values()];
  }
}
`,
  "balanced-delimiters": `class Solution {
  balancedDelimiters(text: string): boolean {
    const stack: string[] = [];
    const closing: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
    for (const character of text) {
      if (character === "(" || character === "[" || character === "{") {
        stack.push(character);
      } else if (character in closing && stack.pop() !== closing[character]) {
        return false;
      }
    }
    return stack.length === 0;
  }
}
`,
  "normalize-path": `class Solution {
  normalizePath(path: string): string {
    const segments: string[] = [];
    for (const segment of path.split("/")) {
      if (!segment || segment === ".") continue;
      if (segment === "..") segments.pop();
      else segments.push(segment);
    }
    return "/" + segments.join("/");
  }
}
`,
  "longest-unique-window": `class Solution {
  longestUniqueWindow(text: string): number {
    const characters = [...text];
    const lastIndex = new Map<string, number>();
    let left = 0;
    let longest = 0;
    for (let right = 0; right < characters.length; right += 1) {
      const previous = lastIndex.get(characters[right]);
      if (previous !== undefined && previous >= left) left = previous + 1;
      lastIndex.set(characters[right], right);
      longest = Math.max(longest, right - left + 1);
    }
    return longest;
  }
}
`,
} as const;

export type MethodPracticeReferenceQuestionId =
  keyof typeof methodPracticeReferenceSolutions;

export function methodPracticeReferenceSolution(questionId: string): string {
  if (!(questionId in methodPracticeReferenceSolutions)) {
    throw new Error(`No reviewed method-practice reference exists for ${questionId}.`);
  }
  return methodPracticeReferenceSolutions[
    questionId as MethodPracticeReferenceQuestionId
  ];
}
