import type { Node, NodeProps } from '@xyflow/react'

export type TreeLabelNode = Node<{ text: string; hint: string }, 'label'>

export default function TreeLabel({ data }: NodeProps<TreeLabelNode>) {
  return (
    <div className="tree-label">
      <strong>{data.text}</strong>
      <span>{data.hint}</span>
    </div>
  )
}
