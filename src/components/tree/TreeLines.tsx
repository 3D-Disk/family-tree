import type { Node, NodeProps } from '@xyflow/react'
import type { TreeLine } from '../../layout/familyLayout.ts'

export type TreeLinesData = { lines: TreeLine[]; width: number; height: number; originX: number; originY: number }
export type TreeLinesNode = Node<TreeLinesData, 'lines'>

/** All connecting lines, drawn as one SVG behind the cards. */
export default function TreeLines({ data }: NodeProps<TreeLinesNode>) {
  const { lines, width, height, originX, originY } = data
  return (
    <svg className="tree-lines" width={width} height={height} aria-hidden="true">
      <g transform={`translate(${-originX} ${-originY})`}>
        {lines.map((l, i) => (
          <polyline
            key={i}
            className={`tree-line tree-line-${l.kind}`}
            points={l.points.map((p) => p.join(',')).join(' ')}
            strokeDasharray={l.dashed ? '7 6' : undefined}
          />
        ))}
      </g>
    </svg>
  )
}
