import { Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow, type Node } from '@xyflow/react'
import { useEffect, useMemo, useRef } from 'react'
import { LAYOUT, layoutFamily } from '../../layout/familyLayout.ts'
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
}

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

function Tree({ highlightIds, selectedId, onSelect, onAddRelative, focus }: Props) {
  const { state } = useTree()
  const tree = state.tree!
  const { setCenter, getZoom } = useReactFlow()

  // Only the people and links affect where cards go.
  const layout = useMemo(
    () => layoutFamily({ people: tree.people, parentLinks: tree.parentLinks, partnerships: tree.partnerships }),
    [tree.people, tree.parentLinks, tree.partnerships],
  )

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
      focusable: false,
      zIndex: 0,
    }
    const cards: TreeCardNode[] = Object.values(layout.people).map((p) => ({
      id: p.id,
      type: 'person',
      position: { x: p.x, y: p.y },
      width: LAYOUT.cardWidth,
      height: LAYOUT.cardHeight,
      zIndex: 1,
      data: {
        person: tree.people[p.id],
        photo: cardPhoto(tree.people[p.id], state.photos),
        selected: p.id === selectedId,
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
            focusable: false,
          },
        ]
      : []
    return [lines, ...label, ...cards] as Node[]
  }, [layout, tree.people, state.photos, selectedId, highlightIds, onAddRelative])

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
      nodesDraggable={false}
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
