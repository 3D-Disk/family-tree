import { createContext, useContext, type Dispatch } from 'react'
import type { TreeAction, TreeState } from './treeReducer.ts'

export interface TreeApi {
  state: TreeState
  dispatch: Dispatch<TreeAction>
  startNew(name: string): void
  /** Pick a .familytree file and load it. */
  openFile(): Promise<void>
  /** Load the copy kept in the browser. */
  continueFromBrowser(): Promise<void>
  save(): Promise<void>
  saveAs(): Promise<void>
  /** Return to the start screen. */
  close(): void
  /** Ask before discarding unsaved changes; true means it's OK to proceed. */
  confirmDiscard(): boolean
  /** Brief message shown at the bottom of the screen. */
  notify(message: string, kind?: 'info' | 'error'): void
}

export const TreeContext = createContext<TreeApi | null>(null)

export function useTree(): TreeApi {
  const api = useContext(TreeContext)
  if (!api) throw new Error('useTree must be used inside <TreeProvider>')
  return api
}
