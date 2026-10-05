// Back / forward through the people opened in the side panel, like a web browser.

export interface PanelHistory {
  /** People opened, oldest first. */
  stack: string[]
  /** Position of the person currently shown. */
  index: number
}

export const MAX_HISTORY = 50
export const emptyHistory: PanelHistory = { stack: [], index: -1 }

/** Record that a person was opened (drops any "forward" entries, like a browser). */
export function visit(h: PanelHistory, id: string): PanelHistory {
  if (h.stack[h.index] === id) return h
  const stack = [...h.stack.slice(0, h.index + 1), id].slice(-MAX_HISTORY)
  return { stack, index: stack.length - 1 }
}

/** Index of the nearest earlier (-1) or later (+1) person that still exists, or -1. */
export function step(h: PanelHistory, dir: -1 | 1, exists: (id: string) => boolean): number {
  for (let i = h.index + dir; i >= 0 && i < h.stack.length; i += dir) {
    if (exists(h.stack[i]) && h.stack[i] !== h.stack[h.index]) return i
  }
  return -1
}
