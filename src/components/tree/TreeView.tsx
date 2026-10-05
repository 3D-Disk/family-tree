import { Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Node } from '@xyflow/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LAYOUT, layoutFamily } from '../../layout/familyLayout.ts'
import { emptyViewOrder, reorderByDrop } from '../../layout/viewEdits.ts'
import type { ViewOrder } from '../../model/types.ts'
import { focusIds, subFamily, type FocusOptions } from '../../model/focus.ts'
import { cardPhoto } from '../../model/person.ts'
import { useTree } from '../../state/treeContext.ts'
import type { AddKind } from '../family/FamilySection.tsx'
import TreeCard, { type TreeCardNode } from './TreeCard.tsx'
import TreeLabel, { type TreeLabelNode } from './TreeLabel.tsx'
import TreeLines, { type TreeLinesNode } from './TreeLines.tsx'

const nodeTypes = { person: TreeCard, lines: TreeLines, label: TreeLabel }
const PAD = 40

interface Props {
  /** When set, people not in it are dimmed (they don't match the search/filters). */
  highlightIds: Set<string> | null
  selectedId: string | null
  onSelect(id: string): void
  onAddRelative(id: string, kind: AddKind): void
  onAdd(): void
  /** Centre the view on this person; `n` changes for each new request. */
  focus: { id: string; n: number } | null
  /** Show only this person's line (ancestors, descendants, partners, siblings). */
  treeFocus: TreeFocus | null
  /** The saved view being shown (null = Default). */
  view: ViewOrder | null
  /** A card was dragged to a new place: the view's order with that change. */
  onReorder(next: ViewOrder): void
}

export type TreeFocus = FocusOptions & { personId: string }

export default function TreeView(props: Props) {
  const { state } = useTree()
  if (Object.keys(state.tree?.people ?? {}).length === 0) {
    return (
      <div className="board-empty">
        <div className="empty-tree">
          <h1>Add your first person</h1>
          <p>Start with yourself or anyone you know well. You can add their details and a photo.</p>
          <button type="button" className="btn btn-primary" onClick={props.onAdd}>
            + Add person
          </button>
        </div>
      </div>
    )
  }
  return (
    <ReactFlowProvider>
      <Tree {...props} />
    </ReactFlowProvider>
  )
}

function Tree({ highlightIds, selectedId, onSelect, onAddRelative, focus, treeFocus, view, onReorder }: Props) {
  const { state } = useTree()
  const tree = state.tree!
  const { setCenter, getZoom } = useReactFlow()

  // Only the people and links affect where cards go.
  const layout = useMemo(() => {
    const all = { people: tree.people, parentLinks: tree.parentLinks, partnerships: tree.partnerships }
    const shown = treeFocus ? subFamily(all, focusIds(all, treeFocus.personId, treeFocus)) : all
    return layoutFamily(shown, LAYOUT, view ?? undefined)
  }, [tree.people, tree.parentLinks, tree.partnerships, treeFocus, view])

  /** The card being dragged, and its current x (it only moves sideways). */
  const [drag, setDrag] = useState<{ id: string; x: number } | null>(null)

  const nodes = useMemo(() => {
    const { minX, minY, maxX, maxY } = layout.bounds
    const lines: TreeLinesNode = {
      id: '__lines',
      type: 'lines',
      position: { x: minX - PAD, y: minY - PAD },
      data: {
        lines: layout.lines,
        width: maxX - minX + PAD * 2,
        height: maxY - minY + PAD * 2,
        originX: minX - PAD,
        originY: minY - PAD,
      },
      selectable: false,
      draggable: false,
      focusable: false,
      zIndex: 0,
    }
    const cards: TreeCardNode[] = Object.values(layout.people).map((p) => ({
      id: p.id,
      type: 'person',
      position: { x: drag?.id === p.id ? drag.x : p.x, y: p.y },
      width: LAYOUT.cardWidth,
      height: LAYOUT.cardHeight,
      zIndex: drag?.id === p.id ? 20 : 1,
      draggable: true,
      data: {
        person: tree.people[p.id],
        photo: cardPhoto(tree.people[p.id], state.photos),
        selected: p.id === selectedId,
        focused: p.id === treeFocus?.personId,
        dimmed: highlightIds !== null && !highlightIds.has(p.id),
        onAdd: onAddRelative,
      },
    }))
    const label: TreeLabelNode[] = layout.unlinkedLabel
      ? [
          {
            id: '__unlinked',
            type: 'label',
            position: layout.unlinkedLabel,
            data: { text: 'Not linked to anyone', hint: 'Open someone to add their family.' },
            selectable: false,
      draggable: false,
            focusable: false,
          },
        ]
      : []
    return [lines, ...label, ...cards] as Node[]
  }, [layout, tree.people, state.photos, selectedId, highlightIds, onAddRelative, treeFocus, drag])

  // Centre on a person when asked (e.g. picked from the People list).
  const latestLayout = useRef(layout)
  useEffect(() => {
    latestLayout.current = layout
  })
  useEffect(() => {
    if (!focus) return
    const p = latestLayout.current.people[focus.id]
    if (p) {
      setCenter(p.x + LAYOUT.cardWidth / 2, p.y + LAYOUT.cardHeight / 2, {
        zoom: Math.max(getZoom(), 0.8),
        duration: 400,
      })
    }
  }, [focus, setCenter, getZoom])

  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      nodeTypes={nodeTypes}
      onNodeClick={(_, node) => node.type === 'person' && onSelect(node.id)}
      // Cards can be dragged sideways to rearrange them (saved as a view).
      nodesDraggable
      nodeDragThreshold={5}
      onNodesChange={(changes) => {
        for (const c of changes) {
          if (c.type === 'position' && c.dragging && c.position) setDrag({ id: c.id, x: c.position.x })
        }
      }}
      onNodeDragStop={(_, node) => {
        const x = drag?.id === node.id ? drag.x : node.position.x
        setDrag(null)
        const next = reorderByDrop(layout, view ?? emptyViewOrder(), node.id, x + LAYOUT.cardWidth / 2)
        if (next) onReorder(next)
      }}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.1}
      maxZoom={4}
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
    >
      <Controls showInteractive={false} position="bottom-left" />
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor={(n) => (n.type === 'person' ? 'var(--minimap-card)' : 'transparent')}
        nodeStrokeColor={() => 'transparent'}
        maskColor="rgb(244 239 230 / 0.7)"
        className="tree-minimap"
      />
    </ReactFlow>
  )
}
