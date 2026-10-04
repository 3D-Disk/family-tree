import { useEffect, useRef, type ReactNode } from 'react'

export interface DialogButton<T> {
  label: string
  value: T
  kind?: 'primary' | 'danger' | 'plain'
}

interface Props<T> {
  title: string
  children?: ReactNode
  buttons: DialogButton<T>[]
  /** Value reported when the dialog is dismissed with Esc. */
  cancelValue: T
  onChoose(value: T): void
}

/** A modal pop-up asking the user to pick one of several buttons. */
export default function ConfirmDialog<T>({ title, children, buttons, cancelValue, onChoose }: Props<T>) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      onCancel={(e) => {
        e.preventDefault()
        onChoose(cancelValue)
      }}
    >
      <h2>{title}</h2>
      {children && <div className="confirm-dialog-body">{children}</div>}
      <div className="confirm-dialog-buttons">
        {buttons.map((b) => (
          <button
            key={b.label}
            type="button"
            className={`btn${b.kind === 'primary' ? ' btn-primary' : b.kind === 'danger' ? ' btn-danger' : ''}`}
            onClick={() => onChoose(b.value)}
          >
            {b.label}
          </button>
        ))}
      </div>
    </dialog>
  )
}
