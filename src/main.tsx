import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@xyflow/react/dist/style.css'
import './index.css'
import App from './App.tsx'
import TreeProvider from './state/TreeProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TreeProvider>
      <App />
    </TreeProvider>
  </StrictMode>,
)
