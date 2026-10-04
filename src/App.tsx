import AppHeader from './components/AppHeader.tsx'
import EmptyTree from './components/EmptyTree.tsx'

export default function App() {
  return (
    <div className="app">
      <AppHeader />
      <main className="canvas">
        <EmptyTree />
      </main>
    </div>
  )
}
