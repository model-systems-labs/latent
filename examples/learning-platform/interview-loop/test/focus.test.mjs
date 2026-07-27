import assert from "node:assert/strict";
import { test } from "node:test";

import {
  focusElement,
  scheduleFocus,
} from "../site/focus.mjs";

test("mobile focus reveals its disclosure and scrolls before focusing", () => {
  const calls = [];
  const panel = { open: false };
  const target = {
    closest(selector) {
      calls.push(["closest", selector]);
      return panel;
    },
    focus(options) {
      calls.push(["focus", options]);
    },
    scrollIntoView(options) {
      calls.push(["scroll", options]);
    },
  };

  assert.equal(focusElement(target, {
    revealMobilePanel: true,
    scroll: true,
  }), true);
  assert.equal(panel.open, true);
  assert.deepEqual(calls, [
    ["closest", "details.learner-mobile-panel"],
    ["scroll", {
      behavior: "auto",
      block: "center",
      inline: "nearest",
    }],
    ["focus", { preventScroll: true }],
  ]);
});

test("scheduled focus resolves the replacement element after rendering", () => {
  let callback;
  let replacement = null;
  const panel = { open: false };
  const calls = [];
  const target = {
    closest() {
      return panel;
    },
    focus(options) {
      calls.push(options);
    },
  };

  scheduleFocus("#leeches-only", { revealMobilePanel: true }, {
    query(selector) {
      assert.equal(selector, "#leeches-only");
      return replacement;
    },
    schedule(next) {
      callback = next;
    },
  });

  replacement = target;
  callback();
  assert.equal(panel.open, true);
  assert.deepEqual(calls, [{ preventScroll: true }]);
});

test("focusElement safely ignores a missing rendered target", () => {
  assert.equal(focusElement(null, { scroll: true }), false);
});
