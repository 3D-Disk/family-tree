import type { FocusOptions } from '../../model/focus.ts'

const CHOICES: { value: number; label: string }[] = [
  { value: 0, label: 'None' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: Infinity, label: 'All' },
]

interface Props {
  name: string
  options: FocusOptions
  onChange(options: FocusOptions): void
  onExit(): void
}

/** Bar over the tree while it's focused on one person. */
export default function FocusBar({ name, options, onChange, onExit }: Props) {
  const select = (key: keyof FocusOptions, label: string) => (
    <label className="focus-select">
      <span>{label}</span>
      <select
        value={String(options[key])}
        onChange={(e) => onChange({ ...options, [key]: Number(e.target.value) })}
      >
        {CHOICES.map((c) => (
          <option key={c.label} value={String(c.value)}>{c.label}</option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="focus-bar" role="region" aria-label="Focused view">
      <span className="focus-title">
        Focused on <strong>{name}</strong>
      </span>
      {select('up', 'Generations up')}
      {select('down', 'Generations down')}
      <button type="button" className="btn btn-small btn-primary" onClick={onExit}>
        Show everyone
      </button>
      {options.up === 0 && <span className="focus-note">Brothers &amp; sisters show when parents are shown.</span>}
    </div>
  )
}
