interface Props {
  name: string
  onReset(): void
}

/** Shown above the tree while a saved view is selected. */
export default function ViewBar({ name, onReset }: Props) {
  return (
    <div className="view-bar" role="region" aria-label="Current view">
      <span>
        View: <strong>{name}</strong>
      </span>
      <span className="view-bar-hint">Drag cards left or right to rearrange.</span>
      <button type="button" className="btn btn-small" onClick={onReset}>
        Reset this view
      </button>
    </div>
  )
}
