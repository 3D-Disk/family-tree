import { useState } from 'react'
import { fullName } from '../model/person.ts'
import type { Person } from '../model/types.ts'
import { useTree } from '../state/treeContext.ts'
import ConfirmDialog from './ConfirmDialog.tsx'

/** "Delete person" button that asks first, then removes the person and their links. */
export default function DeletePersonButton({ person, onDeleted, className = '' }: { person: Person; onDeleted(): void; className?: string }) {
  const { dispatch, notify } = useTree()
  const [asking, setAsking] = useState(false)
  const name = fullName(person)
  return (
    <>
      <button type="button" className={`btn btn-danger ${className}`} onClick={() => setAsking(true)}>
        Delete person
      </button>
      {asking && (
        <ConfirmDialog
          title={`Delete ${name}?`}
          buttons={[
            { label: 'Cancel', value: false },
            { label: 'Delete person', value: true, kind: 'danger' },
          ]}
          cancelValue={false}
          onChoose={(yes) => {
            setAsking(false)
            if (!yes) return
            dispatch({ type: 'deletePerson', id: person.id })
            notify(`Deleted ${name}`)
            onDeleted()
          }}
        >
          Their links to other family members are removed too. This can't be undone.
        </ConfirmDialog>
      )}
    </>
  )
}
