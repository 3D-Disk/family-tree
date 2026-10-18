// Works out where every card goes in the Default view and which lines to draw.
//
// Rules (see CLAUDE.md):
// - Generations are rows (parents above children, partners on the same row).
// - Siblings oldest → youngest, left → right; unknown birth dates last, in the
//   order they were added.
// - Couples: male left, female right; same-sex couples older on the left.
//   Someone with several partners sits between them, earlier partner left.
// - Children are centred under their parents, parents over their children.
//
// Steps: split into connected families → assign generations → group partners
// into "chains" per row → order chains (sibling groups under their parents)
// → assign x positions → draw lines. Everything here is pure and testable.

import { dateSortKey } from '../model/dates.ts'
import type { Family, ParentLink, ParentType, Partnership, ViewOrder } from '../model/types.ts'

export const LAYOUT = {
  cardWidth: 168,
  cardHeight: 141,
  /** Space between partners (room for the partner line). */
  partnerGap: 36,
  /** Space between siblings. */
  siblingGap: 28,
  /** Space between different families on the same row. */
  groupGap: 64,
  /** Vertical space between generations (room for child lines). */
  rowGap: 104,
  /** Space between unconnected families. */
  componentGap: 160,
  /** Columns in the "Not linked to anyone" area. */
  unlinkedColumns: 4,
}

export interface PlacedPerson {
  id: string
  x: number
  y: number
  generation: number
}

export interface TreeLine {
  kind: 'partner' | 'child' | 'otherParent'
  points: [number, number][]
  dashed: boolean
}

export interface TreeLayout {
  people: Record<string, PlacedPerson>
  /** Partners kept side by side, left to right (one entry per row group, including single people). */
  chains: string[][]
  /** Brothers & sisters drawn together under their parents: one person per chain, left to right. */
  siblingGroups: { key: string; ids: string[] }[]
  lines: TreeLine[]
  /** Where to put the "Not linked to anyone" heading, if there are such people. */
  unlinkedLabel: { x: number; y: number } | null
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

const TYPE_PRIORITY: ParentType[] = ['biological', 'adoptive', 'foster', 'guardian', 'step']
const ENDED_LINE = new Set(['divorced', 'separated'])

interface Chain {
  id: number
  members: string[]
  width: number
  /** Family the chain belongs to for grouping (parents' key), or a unique key. */
  group: string
  /** Families of the chain's members (for "bridge" chains joining two families). */
  families: string[]
}

interface FamilyUnit {
  key: string
  parents: string[]
  children: string[]
}

/** Key for a group of people (e.g. a couple): their ids sorted and joined. */
export const groupKeyOf = (ids: string[]) => [...ids].sort().join('+')

/**
 * Apply a saved order to a default order: the people listed in `preferred`
 * take the same slots they had, in the preferred order; everyone else (e.g.
 * people added later) keeps their default spot.
 */
export function applyOrder(defaultOrder: string[], preferred: string[] | undefined): string[] {
  if (!preferred?.length) return defaultOrder
  const listed = new Set(defaultOrder.filter((id) => preferred.includes(id)))
  const queue = preferred.filter((id) => listed.has(id))
  return defaultOrder.map((id) => (listed.has(id) ? queue.shift()! : id))
}

export function layoutFamily(f: Family, L = LAYOUT, view?: ViewOrder): TreeLayout {
  const people = Object.values(f.people)
  const added = new Map(
    [...people].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((p, i) => [p.id, i]),
  )
  const birth = (id: string) => dateSortKey(f.people[id]?.birth.date ?? '') ?? Infinity
  const byBirth = (a: string, b: string) => birth(a) - birth(b) || added.get(a)! - added.get(b)!
  const links = Object.values(f.parentLinks).filter((l) => l.parentId in f.people && l.childId in f.people)
  const partnerships = Object.values(f.partnerships).filter((p) => p.personIds.every((id) => id in f.people))

  // ---- Lookups ----
  const linksByChild = new Map<string, ParentLink[]>()
  const childrenOf = new Map<string, string[]>()
  for (const l of links) {
    if (!linksByChild.has(l.childId)) linksByChild.set(l.childId, [])
    linksByChild.get(l.childId)!.push(l)
    if (!childrenOf.has(l.parentId)) childrenOf.set(l.parentId, [])
    childrenOf.get(l.parentId)!.push(l.childId)
  }

  /** The (up to two) parents a child is drawn under; any others get a separate dashed line. */
  const primaryLinks = (child: string): ParentLink[] =>
    [...(linksByChild.get(child) ?? [])]
      .sort((a, b) => TYPE_PRIORITY.indexOf(a.type) - TYPE_PRIORITY.indexOf(b.type) || added.get(a.parentId)! - added.get(b.parentId)!)
      .slice(0, 2)
  const familyKeyOf = new Map<string, string>()
  const families = new Map<string, FamilyUnit>()
  for (const p of people) {
    const primary = primaryLinks(p.id)
    if (!primary.length) continue
    const parents = primary.map((l) => l.parentId).sort()
    const key = groupKeyOf(parents)
    familyKeyOf.set(p.id, key)
    if (!families.has(key)) families.set(key, { key, parents, children: [] })
    families.get(key)!.children.push(p.id)
  }

  // ---- Connected families (union-find) ----
  const root = new Map(people.map((p) => [p.id, p.id]))
  const find = (id: string): string => {
    let r = id
    while (root.get(r) !== r) r = root.get(r)!
    root.set(id, r)
    return r
  }
  const join = (a: string, b: string) => root.set(find(a), find(b))
  links.forEach((l) => join(l.parentId, l.childId))
  partnerships.forEach((p) => join(p.personIds[0], p.personIds[1]))
  const componentMap = new Map<string, string[]>()
  for (const p of people) {
    const r = find(p.id)
    if (!componentMap.has(r)) componentMap.set(r, [])
    componentMap.get(r)!.push(p.id)
  }
  const components = [...componentMap.values()]
    .map((ids) => ids.sort((a, b) => added.get(a)! - added.get(b)!))
    .sort((a, b) => b.length - a.length || added.get(a[0])! - added.get(b[0])!)

  // ---- Generations ----
  // First count generations like a genealogist: walk from relative to relative,
  // one row up to a parent, one row down to a child, the same row for a partner.
  // So every generation shares a row, even when one side goes back further.
  const gen = new Map<string, number>()
  const steps = new Map<string, [string, number][]>(people.map((p) => [p.id, []]))
  for (const l of links) {
    steps.get(l.childId)!.push([l.parentId, -1])
    steps.get(l.parentId)!.push([l.childId, 1])
  }
  for (const p of partnerships) {
    steps.get(p.personIds[0])!.push([p.personIds[1], 0])
    steps.get(p.personIds[1])!.push([p.personIds[0], 0])
  }
  for (const start of [...people].sort((a, b) => added.get(a.id)! - added.get(b.id)!)) {
    if (gen.has(start.id)) continue
    gen.set(start.id, 0)
    const queue = [start.id]
    while (queue.length) {
      const id = queue.shift()!
      for (const [other, d] of steps.get(id)!) {
        if (gen.has(other)) continue // already placed (unusual families can disagree; fixed below)
        gen.set(other, gen.get(id)! + d)
        queue.push(other)
      }
    }
  }
  // Start each family group at row 0, so the rules below can only move people down.
  for (const comp of components) {
    const min = Math.min(...comp.map((id) => gen.get(id)!))
    comp.forEach((id) => gen.set(id, gen.get(id)! - min))
  }

  const hasParents = (id: string) => (linksByChild.get(id)?.length ?? 0) > 0
  // Then make sure the basic rules hold even in unusual families (e.g. someone who
  // married a person from another generation). Each rule only ever moves people
  // down, so this settles; the cap guards odd data.
  for (let i = 0, changed = true; changed && i < people.length * 2 + 10; i++) {
    changed = false
    const raise = (id: string, g: number) => {
      if (g > gen.get(id)!) {
        gen.set(id, g)
        changed = true
      }
    }
    for (const l of links) raise(l.childId, gen.get(l.parentId)! + 1)
    for (const p of partnerships) {
      const g = Math.max(gen.get(p.personIds[0])!, gen.get(p.personIds[1])!)
      p.personIds.forEach((id) => raise(id, g))
    }
    // People with no parents sit just above their highest child.
    for (const p of people) {
      const kids = childrenOf.get(p.id)
      if (!hasParents(p.id) && kids?.length) raise(p.id, Math.min(...kids.map((c) => gen.get(c)!)) - 1)
    }
  }

  const placed: Record<string, PlacedPerson> = {}
  const allChains: string[][] = []
  const siblingGroups: TreeLayout['siblingGroups'] = []
  const lines: TreeLine[] = []
  let cursorX = 0
  const unlinked: string[] = []
  const rowTop = (g: number) => g * (L.cardHeight + L.rowGap)

  for (const comp of components) {
    if (comp.length === 1) {
      unlinked.push(comp[0])
      continue
    }
    const minGen = Math.min(...comp.map((id) => gen.get(id)!))
    comp.forEach((id) => gen.set(id, gen.get(id)! - minGen))
    const left = layoutComponent(comp)
    const minX = Math.min(...comp.map((id) => left.get(id)!))
    let maxX = -Infinity
    for (const id of comp) {
      const x = left.get(id)! - minX + cursorX
      placed[id] = { id, x, y: rowTop(gen.get(id)!), generation: gen.get(id)! }
      maxX = Math.max(maxX, x + L.cardWidth)
    }
    cursorX = maxX + L.componentGap
  }

  // People not linked to anyone go in a grid at the end.
  let unlinkedLabel: TreeLayout['unlinkedLabel'] = null
  if (unlinked.length) {
    unlinked.sort((a, b) => added.get(a)! - added.get(b)!)
    unlinkedLabel = { x: cursorX, y: -56 }
    unlinked.forEach((id, i) => {
      const col = i % L.unlinkedColumns
      const row = Math.floor(i / L.unlinkedColumns)
      placed[id] = {
        id,
        x: cursorX + col * (L.cardWidth + L.siblingGap),
        y: row * (L.cardHeight + L.siblingGap),
        generation: 0,
      }
    })
  }

  drawLines()

  const xs = Object.values(placed)
  const bounds = xs.length
    ? {
        minX: Math.min(...xs.map((p) => p.x)),
        minY: Math.min(...xs.map((p) => p.y), unlinkedLabel ? unlinkedLabel.y : Infinity),
        maxX: Math.max(...xs.map((p) => p.x + L.cardWidth)),
        maxY: Math.max(...xs.map((p) => p.y + L.cardHeight)),
      }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  return { people: placed, chains: allChains, siblingGroups, lines, unlinkedLabel, bounds }

  // ---------------------------------------------------------------------------

  /** Returns each person's left x within the component. */
  function layoutComponent(comp: string[]): Map<string, number> {
    const inComp = new Set(comp)
    const maxGen = Math.max(...comp.map((id) => gen.get(id)!))

    // Chains: partners on the same row, kept side by side.
    const rows: Chain[][] = []
    const chainOf = new Map<string, Chain>()
    let chainId = 0
    for (let g = 0; g <= maxGen; g++) {
      const rowIds = comp.filter((id) => gen.get(id) === g)
      const seen = new Set<string>()
      const chains: Chain[] = []
      for (const id of [...rowIds].sort(byBirth)) {
        if (seen.has(id)) continue
        // Everyone on this row joined to `id` through partnerships.
        const members: string[] = []
        const queue = [id]
        seen.add(id)
        while (queue.length) {
          const cur = queue.shift()!
          members.push(cur)
          for (const other of partnersOnRow(cur, g)) {
            if (!seen.has(other)) {
              seen.add(other)
              queue.push(other)
            }
          }
        }
        const ordered = orderChain(members, g)
        const fams = [...new Set(ordered.map((m) => familyKeyOf.get(m)).filter((k): k is string => !!k))]
        const chain: Chain = {
          id: chainId++,
          members: ordered,
          width: ordered.length * L.cardWidth + (ordered.length - 1) * L.partnerGap,
          group: fams.length === 1 ? fams[0] : `chain:${chainId}`,
          families: fams,
        }
        ordered.forEach((m) => chainOf.set(m, chain))
        chains.push(chain)
      }
      rows.push(chains)
    }

    // Positions used while ordering and placing (left edge of each chain).
    const pos = new Map<Chain, number>()
    const gapAfter = (row: Chain[], i: number) => (row[i].group === row[i + 1].group ? L.siblingGap : L.groupGap)
    /** Left edge of each card. Partners start side by side but may move apart later. */
    const left = new Map<string, number>()
    const setChain = (c: Chain, x: number) => {
      pos.set(c, x)
      c.members.forEach((m, i) => left.set(m, x + i * (L.cardWidth + L.partnerGap)))
    }
    const pack = (row: Chain[]) => {
      let x = 0
      row.forEach((c, i) => {
        setChain(c, x)
        x += c.width + (i < row.length - 1 ? gapAfter(row, i) : 0)
      })
    }
    const center = (id: string) => left.get(id)! + L.cardWidth / 2
    const unionX = (fam: FamilyUnit) => avg(fam.parents.filter((p) => inComp.has(p)).map(center))
    const childrenCenter = (chain: Chain): number | null => {
      const kids = chain.members.flatMap((m) => childrenOf.get(m) ?? []).filter((k) => inComp.has(k))
      return kids.length ? avg(kids.map(center)) : null
    }

    // ---- Ordering: sibling groups under their parents (down), parents over children (up) ----
    rows[0].sort((a, b) => byBirth(a.members[0], b.members[0]))
    rows.forEach(pack)
    const groupKey = (c: Chain): number => {
      if (c.families.length === 0) return pos.get(c)! + c.width / 2
      return avg(c.families.map((k) => unionX(families.get(k)!)))
    }
    /** First (by birth) member of the chain that belongs to its group's family. */
    const groupBirth = (c: Chain) => {
      const ids = c.members.filter((m) => familyKeyOf.get(m) === c.group)
      return ids.length ? ids.sort(byBirth)[0] : c.members[0]
    }
    const reorder = (row: Chain[], key: (c: Chain) => number | null) => {
      // Keep each group together and its siblings in birth order; move whole groups.
      const groups = new Map<string, Chain[]>()
      for (const c of row) {
        if (!groups.has(c.group)) groups.set(c.group, [])
        groups.get(c.group)!.push(c)
      }
      const scored = [...groups.values()].map((cs, i) => {
        cs.sort((a, b) => byBirth(groupBirth(a), groupBirth(b)))
        // A saved view can change the order of brothers & sisters.
        const preferred = view?.siblingOrder[cs[0].group]
        if (preferred && families.has(cs[0].group)) {
          const byRep = new Map(cs.map((c) => [groupBirth(c), c]))
          const order = applyOrder([...byRep.keys()], preferred)
          cs.splice(0, cs.length, ...order.map((id) => byRep.get(id)!))
        }
        const keys = cs.map(key).filter((k): k is number => k !== null)
        return { cs, i, k: keys.length ? avg(keys) : avg(cs.map((c) => pos.get(c)! + c.width / 2)) }
      })
      scored.sort((a, b) => a.k - b.k || a.i - b.i)
      row.splice(0, row.length, ...scored.flatMap((s) => s.cs))
      pack(row)
    }
    for (let sweep = 0; sweep < 3; sweep++) {
      for (let g = 1; g <= maxGen; g++) reorder(rows[g], groupKey)
      for (let g = maxGen - 1; g >= 0; g--) reorder(rows[g], childrenCenter)
    }
    for (let g = 1; g <= maxGen; g++) reorder(rows[g], groupKey)

    // ---- X positions: alternate "children under parents" and "parents over children" ----
    // Each card is placed on its own, so partners can move apart when both of their
    // families need the room. That keeps every line from parents to children straight.
    interface RowCards { ids: string[]; chain: Chain[]; gaps: number[]; packed: number[] }
    const rowCards = (row: Chain[]): RowCards => {
      const ids: string[] = []
      const chain: Chain[] = []
      const gaps: number[] = []
      row.forEach((c, ci) => {
        c.members.forEach((m, mi) => {
          if (ids.length) gaps.push(mi > 0 ? L.partnerGap : gapAfter(row, ci - 1))
          ids.push(m)
          chain.push(c)
        })
      })
      // Card centres with everyone as close together as allowed.
      const packed: number[] = []
      ids.forEach((_, i) => packed.push(i === 0 ? 0 : packed[i - 1] + L.cardWidth + gaps[i - 1]))
      return { ids, chain, gaps, packed }
    }
    /** Cards with no wish of their own stay next to a partner who has one, or where they are. */
    const fillIn = (r: RowCards, want: (number | null)[]) => {
      const out = [...want]
      r.ids.forEach((id, i) => {
        if (want[i] !== null) return
        let best = -1
        for (let j = 0; j < r.ids.length; j++) {
          if (r.chain[j] === r.chain[i] && want[j] !== null && (best === -1 || Math.abs(j - i) < Math.abs(best - i))) best = j
        }
        out[i] = best === -1 ? center(id) : want[best]! + r.packed[i] - r.packed[best]
      })
      return out as number[]
    }
    /** An only child's line to their parents is a single straight drop, so it should never bend. */
    const ONLY_CHILD = 1e6
    const isOnlyChild = (id: string) => {
      const fam = families.get(familyKeyOf.get(id) ?? '')
      return !!fam && fam.parents.some((p) => inComp.has(p)) && fam.children.filter((k) => inComp.has(k)).length === 1
    }
    const place = (r: RowCards, wantCentres: number[], weights: number[]) => {
      const lefts = isotonicPlace(
        wantCentres.map((x) => x - L.cardWidth / 2),
        r.ids.map(() => L.cardWidth),
        r.gaps,
        weights,
      )
      r.ids.forEach((id, i) => left.set(id, lefts[i]))
    }
    const downPass = (g: number) => {
      const r = rowCards(rows[g])
      const want: (number | null)[] = r.ids.map(() => null)
      for (const fam of families.values()) {
        const idx = r.ids.map((id, i) => (familyKeyOf.get(id) === fam.key ? i : -1)).filter((i) => i >= 0)
        if (!idx.length || !fam.parents.some((p) => inComp.has(p))) continue
        // Centre the brothers & sisters (not their partners) under their parents.
        const mid = (r.packed[idx[0]] + r.packed[idx[idx.length - 1]]) / 2
        for (const i of idx) want[i] = unionX(fam) + r.packed[i] - mid
      }
      place(r, fillIn(r, want), r.ids.map((id) => (isOnlyChild(id) ? ONLY_CHILD : 1)))
    }
    const upPass = (g: number) => {
      const r = rowCards(rows[g])
      const want = r.ids.map((id, i): number | null => {
        const targets: number[] = []
        for (const fam of families.values()) {
          if (!fam.parents.includes(id)) continue
          const kids = fam.children.filter((k) => inComp.has(k))
          if (!kids.length) continue
          const kidCenters = kids.map(center)
          const target = (Math.min(...kidCenters) + Math.max(...kidCenters)) / 2
          // Sit beside the other parent so that their join point is over the children.
          const onRow = fam.parents.map((p) => r.ids.indexOf(p)).filter((j) => j >= 0)
          targets.push(target + r.packed[i] - avg(onRow.map((j) => r.packed[j])))
        }
        return targets.length ? avg(targets) : null
      })
      // An only child already sits under their parents: moving them would bend that line.
      r.ids.forEach((id, i) => {
        if (isOnlyChild(id)) want[i] = center(id)
      })
      place(r, fillIn(r, want), r.ids.map((id) => (isOnlyChild(id) ? ONLY_CHILD : 1)))
    }
    for (let round = 0; round < 8; round++) {
      for (let g = 1; g <= maxGen; g++) downPass(g)
      for (let g = maxGen - 1; g >= 0; g--) upPass(g)
    }
    // Finish with children under their parents, so only children end up straight below them.
    for (let g = 1; g <= maxGen; g++) downPass(g)

    // Record the final arrangement so a drag can be turned into a new order.
    for (const row of rows) {
      for (const c of row) allChains.push(c.members)
      for (let i = 0; i < row.length; ) {
        let j = i
        while (j + 1 < row.length && row[j + 1].group === row[i].group) j++
        if (families.has(row[i].group)) {
          siblingGroups.push({ key: row[i].group, ids: row.slice(i, j + 1).map(groupBirth) })
        }
        i = j + 1
      }
    }

    const result = new Map<string, number>()
    for (const id of comp) result.set(id, center(id) - L.cardWidth / 2)
    return result
  }

  function partnersOnRow(id: string, g: number): string[] {
    return partnerships
      .filter((p) => p.personIds.includes(id))
      .map((p) => (p.personIds[0] === id ? p.personIds[1] : p.personIds[0]))
      .filter((o) => gen.get(o) === g)
  }

  function partnershipBetween(a: string, b: string): Partnership | undefined {
    return partnerships.find((p) => p.personIds.includes(a) && p.personIds.includes(b))
  }

  /** Order partners left → right using the couple rules. */
  function orderChain(members: string[], g: number): string[] {
    return applyOrder(defaultChainOrder(members, g), view?.chainOrder[groupKeyOf(members)])
  }

  function defaultChainOrder(members: string[], g: number): string[] {
    if (members.length === 1) return members
    if (members.length === 2) return orderCouple(members[0], members[1])
    // Several partners: the person with the most partners sits in the middle,
    // their partners in date order (earlier on the left).
    const count = (id: string) => partnersOnRow(id, g).filter((o) => members.includes(o)).length
    const middle = [...members].sort((a, b) => count(b) - count(a) || byBirth(a, b))[0]
    const startKey = (o: string) => dateSortKey(partnershipBetween(middle, o)?.start.date ?? '') ?? Infinity
    const theirs = partnersOnRow(middle, g)
      .filter((o) => members.includes(o))
      .sort((a, b) => startKey(a) - startKey(b) || added.get(a)! - added.get(b)!)
    const half = Math.floor(theirs.length / 2)
    const order = [...theirs.slice(0, half), middle, ...theirs.slice(half)]
    // Anyone else (a partner's other partner) goes on the outside next to them.
    const rest = members.filter((m) => !order.includes(m))
    while (rest.length) {
      const next = rest.findIndex((r) => partnersOnRow(r, g).some((o) => order.includes(o)))
      const [r] = rest.splice(next === -1 ? 0 : next, 1)
      const anchor = partnersOnRow(r, g).find((o) => order.includes(o))
      const at = anchor === undefined ? order.length : order.indexOf(anchor)
      if (anchor !== undefined && at < order.indexOf(middle)) order.splice(at, 0, r)
      else order.splice(at + 1, 0, r)
    }
    return order
  }

  function orderCouple(a: string, b: string): string[] {
    const ga = f.people[a].gender
    const gb = f.people[b].gender
    if (ga === 'male' && gb !== 'male') return [a, b]
    if (gb === 'male' && ga !== 'male') return [b, a]
    if (ga === 'female' && gb !== 'female') return [b, a]
    if (gb === 'female' && ga !== 'female') return [a, b]
    return byBirth(a, b) <= 0 ? [a, b] : [b, a]
  }

  function drawLines() {
    const W = L.cardWidth
    const H = L.cardHeight
    const cx = (id: string) => placed[id].x + W / 2

    // Partner lines, at mid-card height.
    for (const p of partnerships) {
      const [a, b] = p.personIds.map((id) => placed[id]).sort((m, n) => m.x - n.x)
      const dashed = ENDED_LINE.has(p.type)
      if (a.y === b.y) {
        lines.push({ kind: 'partner', dashed, points: [[a.x + W, a.y + H / 2], [b.x, b.y + H / 2]] })
      } else {
        lines.push({ kind: 'partner', dashed, points: [[a.x + W / 2, a.y + H / 2], [b.x + W / 2, b.y + H / 2]] })
      }
    }

    // Children: from the parents' join point down to a horizontal "bus", then down to each child.
    interface Bus { fam: FamilyUnit; ux: number; uy: number; row: number; kids: string[]; from: number; to: number }
    const buses: Bus[] = []
    for (const fam of families.values()) {
      const ps = fam.parents.map((id) => placed[id])
      const sameRow = ps.length === 2 && ps[0].y === ps[1].y
      const ux = sameRow ? (cx(ps[0].id) + cx(ps[1].id)) / 2 : cx(ps.sort((a, b) => b.y - a.y)[0].id)
      const uy = sameRow ? ps[0].y + H / 2 : Math.max(...ps.map((p) => p.y)) + H
      const byRow = new Map<number, string[]>()
      for (const k of fam.children) {
        const r = placed[k].y
        if (!byRow.has(r)) byRow.set(r, [])
        byRow.get(r)!.push(k)
      }
      for (const [row, kids] of byRow) {
        const xs = [ux, ...kids.map(cx)]
        buses.push({ fam, ux, uy, row, kids, from: Math.min(...xs), to: Math.max(...xs) })
      }
    }
    // Overlapping buses in the same gap get different heights so they can be told apart.
    const levels = new Map<Bus, number>()
    const levelCount = new Map<number, number>()
    for (const row of new Set(buses.map((b) => b.row))) {
      const inRow = buses.filter((b) => b.row === row).sort((a, b) => a.from - b.from)
      const ends: number[] = []
      for (const b of inRow) {
        let lvl = ends.findIndex((end) => end < b.from - 8)
        if (lvl === -1) lvl = ends.length
        ends[lvl] = b.to
        levels.set(b, lvl)
      }
      levelCount.set(row, ends.length)
    }
    for (const b of buses) {
      const n = levelCount.get(b.row)!
      const step = Math.min(14, (L.rowGap * 0.5) / Math.max(1, n))
      const busY = b.row - L.rowGap / 2 + (levels.get(b)! - (n - 1) / 2) * step
      const solid = (k: string) => primaryLinks(k).every((l) => l.type === 'biological')
      lines.push({ kind: 'child', dashed: false, points: [[b.ux, b.uy], [b.ux, busY]] })
      lines.push({ kind: 'child', dashed: false, points: [[b.from, busY], [b.to, busY]] })
      for (const k of b.kids) lines.push({ kind: 'child', dashed: !solid(k), points: [[cx(k), busY], [cx(k), b.row]] })
    }

    // Extra parents (e.g. a step-parent alongside two others): a dashed elbow line.
    for (const p of people) {
      const primary = new Set(primaryLinks(p.id))
      for (const l of linksByChild.get(p.id) ?? []) {
        if (primary.has(l)) continue
        const par = placed[l.parentId]
        const kid = placed[p.id]
        const midY = kid.y - L.rowGap / 2 + 6
        lines.push({
          kind: 'otherParent',
          dashed: true,
          points: [[par.x + W / 2, par.y + H], [par.x + W / 2, midY], [kid.x + W / 2, midY], [kid.x + W / 2, kid.y]],
        })
      }
    }
  }
}

function avg(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length
}

/**
 * Place items left → right as close as possible to their desired left edges,
 * keeping their order and minimum gaps (least squares, via pool-adjacent-violators).
 */
export function isotonicPlace(desired: number[], widths: number[], gaps: number[], weights?: number[]): number[] {
  const n = desired.length
  const offset: number[] = []
  for (let i = 0, o = 0; i < n; i++) {
    offset.push(o)
    o += widths[i] + (gaps[i] ?? 0)
  }
  // Solve for y_i = x_i - offset_i, which must be non-decreasing.
  // Heavier items move less when two wishes clash.
  const blocks: { sum: number; weight: number; count: number }[] = []
  for (let i = 0; i < n; i++) {
    const w = weights?.[i] ?? 1
    blocks.push({ sum: w * (desired[i] - offset[i]), weight: w, count: 1 })
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1]
      const a = blocks[blocks.length - 2]
      if (a.sum / a.weight <= b.sum / b.weight) break
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, weight: a.weight + b.weight, count: a.count + b.count })
    }
  }
  const result: number[] = []
  for (const b of blocks) for (let k = 0; k < b.count; k++) result.push(b.sum / b.weight + offset[result.length])
  return result
}
