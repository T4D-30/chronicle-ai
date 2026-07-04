import { useId, useState, Children, isValidElement } from 'react'
import type { ReactNode, KeyboardEvent } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs: Parameters<typeof clsx>) => twMerge(clsx(inputs))

export interface TabDefinition {
  id: string
  label: string
}

interface TabsProps {
  tabs: TabDefinition[]
  /** Controlled active tab id. If omitted, Tabs manages its own state from defaultTabId. */
  activeTabId?: string
  defaultTabId?: string
  onTabChange?: (tabId: string) => void
  children: ReactNode
  className?: string
}

interface TabPanelProps {
  tabId: string
  children: ReactNode
}

/** Marks a child as belonging to a specific tab. Use inside <Tabs>. */
export function TabPanel({ children }: TabPanelProps) {
  return <>{children}</>
}

/**
 * Roll20-style tabbed layout. Implements the full ARIA tablist pattern per
 * the Style Guide: role="tablist" / role="tab" / role="tabpanel", with
 * arrow-key navigation between tabs and only the active panel rendered.
 */
export function Tabs({
  tabs,
  activeTabId,
  defaultTabId,
  onTabChange,
  children,
  className,
}: TabsProps) {
  const baseId = useId()
  const [internalActiveId, setInternalActiveId] = useState(defaultTabId ?? tabs[0]?.id)
  const currentTabId = activeTabId ?? internalActiveId

  function selectTab(tabId: string) {
    setInternalActiveId(tabId)
    onTabChange?.(tabId)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const currentIndex = tabs.findIndex((t) => t.id === currentTabId)
    if (currentIndex === -1) return

    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1
    }

    if (nextIndex !== null) {
      event.preventDefault()
      const nextTab = tabs[nextIndex]
      selectTab(nextTab.id)
      document.getElementById(`${baseId}-tab-${nextTab.id}`)?.focus()
    }
  }

  // Pull out only the TabPanel whose tabId matches the active tab.
  const activePanel = Children.toArray(children).find(
    (child) => isValidElement(child) && child.props.tabId === currentTabId,
  )

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label="Character sheet sections"
        onKeyDown={handleKeyDown}
        className={cn(
          'flex flex-wrap gap-1 border-b border-void-700/50 mb-4',
          'overflow-x-auto',
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === currentTabId
          return (
            <button
              key={tab.id}
              id={`${baseId}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              className={cn(
                'px-3 py-2 text-sm font-body font-semibold whitespace-nowrap',
                'border-b-2 transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcane-400 rounded-t',
                isActive
                  ? 'border-arcane-400 text-arcane-300'
                  : 'border-transparent text-void-400 hover:text-void-200',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
      <div
        id={`${baseId}-panel-${currentTabId}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${currentTabId}`}
        tabIndex={0}
        className="animate-fade-in"
      >
        {activePanel}
      </div>
    </div>
  )
}
