import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { loadAutosave, writeAutosave } from '../storage/autosave.ts'
import { pickTreeFile, saveTreeFile } from '../storage/fileAccess.ts'
import { readTreeFile, TreeFileError, writeTreeFile } from '../storage/fileFormat.ts'
import { TreeContext, type TreeApi } from './treeContext.ts'
import { initialState, treeReducer } from './treeReducer.ts'

const AUTOSAVE_DELAY_MS = 600

interface Notice {
  id: number
  message: string
  kind: 'info' | 'error'
}

export default function TreeProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(treeReducer, initialState)
  const [notice, setNotice] = useState<Notice | null>(null)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  const notify = useCallback((message: string, kind: 'info' | 'error' = 'info') => {
    setNotice({ id: Date.now(), message, kind })
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 3500)
    return () => clearTimeout(t)
  }, [notice])

  // Keep a safety-net copy in the browser whenever the tree changes.
  const { tree, photos, fileName, fileHandle, dirty } = state
  useEffect(() => {
    if (!tree) return
    const t = setTimeout(() => {
      writeAutosave({ tree, fileName, fileHandle, dirty }, photos).catch((e) => {
        console.error(e)
        notify("Couldn't update the browser backup. Save to a file to be safe.", 'error')
      })
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [tree, photos, fileName, fileHandle, dirty, notify])

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const confirmDiscard = useCallback(
    () =>
      !stateRef.current.dirty ||
      window.confirm('You have changes that are not saved to a file. Continue anyway and lose them?'),
    [],
  )

  const doSave = useCallback(
    async (saveAs: boolean) => {
      const s = stateRef.current
      if (!s.tree) return
      try {
        const blob = await writeTreeFile(s.tree, s.photos)
        const result = await saveTreeFile(blob, { treeName: s.tree.name, handle: s.fileHandle, saveAs })
        if (!result) return
        dispatch({ type: 'saved', ...result, fileHandle: result.handle, revision: s.revision })
        notify(`Saved to "${result.fileName}"`)
      } catch (e) {
        console.error(e)
        notify("Couldn't save the file. Please try Save As.", 'error')
      }
    },
    [notify],
  )

  const api = useMemo<TreeApi>(
    () => ({
      state,
      dispatch,
      notify,
      confirmDiscard,
      startNew(name) {
        dispatch({ type: 'newTree', name: name.trim() || 'My family tree' })
      },
      async openFile() {
        try {
          const picked = await pickTreeFile()
          if (!picked) return
          const { tree, photos } = await readTreeFile(picked.file)
          dispatch({ type: 'load', tree, photos, fileName: picked.file.name, fileHandle: picked.handle, dirty: false })
          notify(`Opened "${picked.file.name}"`)
        } catch (e) {
          if (e instanceof TreeFileError) return notify(e.message, 'error')
          console.error(e)
          notify("Couldn't open that file.", 'error')
        }
      },
      async continueFromBrowser() {
        const saved = await loadAutosave()
        if (!saved) {
          notify('Nothing was found to continue from.', 'error')
          return
        }
        const { session, photos } = saved
        dispatch({ type: 'load', tree: session.tree, photos, fileName: session.fileName, fileHandle: session.fileHandle, dirty: session.dirty })
      },
      save: () => doSave(false),
      saveAs: () => doSave(true),
      close() {
        dispatch({ type: 'close' })
      },
    }),
    [state, notify, confirmDiscard, doSave],
  )

  return (
    <TreeContext.Provider value={api}>
      {children}
      {notice && (
        <div key={notice.id} className={`toast toast-${notice.kind}`} role="status">
          {notice.message}
        </div>
      )}
    </TreeContext.Provider>
  )
}
