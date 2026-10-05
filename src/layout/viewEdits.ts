// Turn "this card was dropped here" into a change to a view's saved order.

import type { ViewOrder } from '../model/types.ts'
import { groupKeyOf, LAYOUT, type TreeLayout } from './familyLayout.ts'

export const emptyViewOrder = (): ViewOrder => ({ siblingOrder: {}, chainOrder: {} })

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

/**
 * Work out the new order after a card is dragged sideways and dropped with its
 * centre at `dropCenterX`. Returns the updated view, or null if nothing changed.
 *  - Dropped within its own couple/partners → new order of that couple.
 *  - Otherwise → new place among its brothers & sisters (moving their partner with them).
 */
export function reorderByDrop(layout: TreeLayout, view: ViewOrder, draggedId: string, dropCenterX: number): ViewOrder | null {
  const W = LAYOUT.cardWidth
  const centre = (id: string) => layout.people[id].x + W / 2
  if (!layout.people[draggedId]) return null
  const chain = layout.chains.find((c) => c.includes(draggedId))
  if (!chain) return null
  const at = (id: string) => (id === draggedId ? dropCenterX : centre(id))

  if (chain.length > 1) {
    const centres = chain.map(centre)
    const within = dropCenterX >= Math.min(...centres) - W / 2 && dropCenterX <= Math.max(...centres) + W / 2
    if (within) {
      const order = [...chain].sort((a, b) => at(a) - at(b))
      if (same(order, chain)) return null
      return { ...view, chainOrder: { ...view.chainOrder, [groupKeyOf(chain)]: order } }
    }
  }

  const group = layout.siblingGroups.find((g) => g.ids.some((id) => chain.includes(id)))
  if (!group || group.ids.length < 2) return null
  const mine = group.ids.find((id) => chain.includes(id))!
  // Compare against each brother's or sister's own card (what you aim at), not their couple's middle.
  const shift = dropCenterX - centre(draggedId)
  const pos = (rep: string) => centre(rep) + (rep === mine ? shift : 0)
  const order = [...group.ids].sort((a, b) => pos(a) - pos(b))
  if (same(order, group.ids)) return null
  return { ...view, siblingOrder: { ...view.siblingOrder, [group.key]: order } }
}
