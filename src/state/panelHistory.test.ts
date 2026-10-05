import { describe, expect, it } from 'vitest'
import { emptyHistory, MAX_HISTORY, step, visit } from './panelHistory.ts'

const all = () => true
const walk = (...ids: string[]) => ids.reduce(visit, emptyHistory)

describe('panel history', () => {
  it('goes back and forward through opened people', () => {
    let h = walk('a', 'b', 'c')
    expect(step(h, -1, all)).toBe(1)
    h = { ...h, index: step(h, -1, all) }
    h = { ...h, index: step(h, -1, all) }
    expect(h.stack[h.index]).toBe('a')
    expect(step(h, -1, all)).toBe(-1)
    expect(h.stack[step(h, 1, all)]).toBe('b')
  })

  it('remembers at least five people each way', () => {
    let h = walk('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11')
    for (let n = 0; n < 5; n++) h = { ...h, index: step(h, -1, all) }
    expect(h.stack[h.index]).toBe('6')
    for (let n = 0; n < 5; n++) h = { ...h, index: step(h, 1, all) }
    expect(h.stack[h.index]).toBe('11')
  })

  it('opening someone new after going back clears "forward", like a browser', () => {
    let h = walk('a', 'b', 'c')
    h = { ...h, index: 0 }
    h = visit(h, 'd')
    expect(h.stack).toEqual(['a', 'd'])
    expect(step(h, 1, all)).toBe(-1)
  })

  it('ignores opening the same person twice in a row', () => {
    expect(walk('a', 'a', 'b', 'b').stack).toEqual(['a', 'b'])
  })

  it('skips people who were deleted', () => {
    const h = walk('a', 'gone', 'c')
    expect(step(h, -1, (id) => id !== 'gone')).toBe(0)
  })

  it('keeps a limited number of entries', () => {
    const h = walk(...Array.from({ length: MAX_HISTORY + 10 }, (_, i) => String(i)))
    expect(h.stack).toHaveLength(MAX_HISTORY)
    expect(h.index).toBe(MAX_HISTORY - 1)
  })
})
