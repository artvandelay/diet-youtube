import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { eventElement, sheetActionFromClick } from "../src/lib/sheet-events.js";

function node({ classes = [], attrs = {}, parent = null } = {}) {
  const el = {
    classList: {
      contains: (name) => classes.includes(name),
    },
    parent,
    closest(selector) {
      let cur = el;
      while (cur) {
        if (selector === "[data-save-feed]" && "data-save-feed" in cur.attrs) return cur;
        if (selector === "[data-delete-feed]" && "data-delete-feed" in cur.attrs) return cur;
        if (selector === "[data-confirm-delete]" && "data-confirm-delete" in cur.attrs) return cur;
        if (selector === "[data-add-source]" && "data-add-source" in cur.attrs) return cur;
        if (selector === "[data-remove-source]" && "data-remove-source" in cur.attrs) return cur;
        if (selector === "[data-resolve]" && "data-resolve" in cur.attrs) return cur;
        if (selector === "[data-retry]" && "data-retry" in cur.attrs) return cur;
        if (selector === "[data-undo]" && "data-undo" in cur.attrs) return cur;
        if (selector === "button[data-dismiss-sheet]" && cur.tag === "button" && "data-dismiss-sheet" in cur.attrs) {
          return cur;
        }
        cur = cur.parent;
      }
      return null;
    },
    attrs,
    tag: attrs.tag || "div",
  };
  return el;
}

describe("sheet click routing", () => {
  it("Save inside the dismiss backdrop is save, not dismiss", () => {
    const backdrop = node({
      classes: ["diet-yt-sheet-backdrop"],
      attrs: { "data-dismiss-sheet": "", tag: "div" },
    });
    const save = node({
      parent: backdrop,
      attrs: { "data-save-feed": "", tag: "button" },
    });
    assert.equal(sheetActionFromClick(save), "save");
  });

  it("Cancel and the backdrop itself dismiss", () => {
    const backdrop = node({
      classes: ["diet-yt-sheet-backdrop"],
      attrs: { "data-dismiss-sheet": "", tag: "div" },
    });
    const cancel = node({
      parent: backdrop,
      attrs: { "data-dismiss-sheet": "", tag: "button" },
    });
    assert.equal(sheetActionFromClick(cancel), "dismiss");
    assert.equal(sheetActionFromClick(backdrop), "dismiss");
  });

  it("resolves text-node clicks to the parent element", () => {
    const button = node({ attrs: { "data-save-feed": "", tag: "button" } });
    const text = { parentElement: button };
    assert.equal(eventElement(text), button);
    assert.equal(sheetActionFromClick(text), "save");
  });

  it("clicks on sheet body do not dismiss", () => {
    const backdrop = node({
      classes: ["diet-yt-sheet-backdrop"],
      attrs: { "data-dismiss-sheet": "", tag: "div" },
    });
    const sheet = node({ parent: backdrop, attrs: { tag: "div" } });
    assert.equal(sheetActionFromClick(sheet), null);
  });
});
