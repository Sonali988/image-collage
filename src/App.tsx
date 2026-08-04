import { ImageEditor } from './components/ImageEditor'
import { PagesGallery } from './components/PagesGallery'
import { CollageBuilder } from './components/CollageBuilder'
import { ExportPanel } from './components/ExportPanel'
import { SettingsPanel } from './components/SettingsPanel'
import { useAppStore } from './store/useAppStore'
import type { TabId } from './types'

const tabs: { id: TabId; label: string }[] = [
  { id: 'editor', label: 'Editor' },
  { id: 'collage', label: 'Collage' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'export', label: 'Export' },
  { id: 'settings', label: 'Settings' },
]

function App() {
  const activeTab = useAppStore((state) => state.activeTab)
  const setActiveTab = useAppStore((state) => state.setActiveTab)
  const pageCount = useAppStore((state) => state.pages.length)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0f0f14]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800/80 px-3 py-2">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          Testimonies Report
        </h1>
        <nav className="flex flex-wrap justify-end gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                activeTab === tab.id
                  ? 'bg-rose-500 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {tab.label}
              {tab.id === 'gallery' && pageCount > 0 && (
                <span
                  className={`rounded-full px-1 text-[10px] ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-zinc-700'
                  }`}
                >
                  {pageCount}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-hidden p-3">
        {activeTab === 'editor' && <ImageEditor />}
        {activeTab === 'gallery' && (
          <div className="h-full overflow-y-auto">
            <PagesGallery />
          </div>
        )}
        {activeTab === 'collage' && <CollageBuilder />}
        {activeTab === 'export' && (
          <div className="h-full overflow-y-auto">
            <ExportPanel />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="h-full overflow-y-auto">
            <SettingsPanel />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
