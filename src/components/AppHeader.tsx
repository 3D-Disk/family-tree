const COMING_SOON = 'Coming in the next phase'

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="brand">
        <img src="./favicon.svg" alt="" width={28} height={28} />
        <span className="brand-name">Family Tree</span>
        <span className="file-name" title="The name of the tree file you are working on">
          Untitled tree
        </span>
      </div>

      <div className="header-controls">
        <label className="views-select">
          <span>View</span>
          <select defaultValue="default" aria-label="Choose a view">
            <option value="default">Default</option>
          </select>
        </label>

        <input
          className="search"
          type="search"
          placeholder="Search people…"
          aria-label="Search people"
          disabled
          title={COMING_SOON}
        />

        <button type="button" className="btn btn-primary" disabled title={COMING_SOON}>
          + Add person
        </button>
      </div>
    </header>
  )
}
