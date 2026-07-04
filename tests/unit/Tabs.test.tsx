import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Tabs, TabPanel } from '@/components/ui/Tabs'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'abilities', label: 'Abilities' },
  { id: 'skills', label: 'Skills' },
]

function renderTabs(props: Partial<React.ComponentProps<typeof Tabs>> = {}) {
  return render(
    <Tabs tabs={TABS} defaultTabId="overview" {...props}>
      <TabPanel tabId="overview">Overview content</TabPanel>
      <TabPanel tabId="abilities">Abilities content</TabPanel>
      <TabPanel tabId="skills">Skills content</TabPanel>
    </Tabs>,
  )
}

describe('Tabs', () => {
  it('renders a tablist with one tab per definition', () => {
    renderTabs()
    expect(screen.getAllByRole('tab')).toHaveLength(3)
  })

  it('shows only the default tab panel content initially', () => {
    renderTabs()
    expect(screen.getByText('Overview content')).toBeInTheDocument()
    expect(screen.queryByText('Abilities content')).not.toBeInTheDocument()
  })

  it('marks the active tab with aria-selected=true', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Abilities' })).toHaveAttribute('aria-selected', 'false')
  })

  it('switches the visible panel when a different tab is clicked', async () => {
    const user = userEvent.setup()
    renderTabs()
    await user.click(screen.getByRole('tab', { name: 'Abilities' }))
    expect(screen.getByText('Abilities content')).toBeInTheDocument()
    expect(screen.queryByText('Overview content')).not.toBeInTheDocument()
  })

  it('calls onTabChange with the new tab id', async () => {
    const user = userEvent.setup()
    const handleChange = vi.fn()
    renderTabs({ onTabChange: handleChange })
    await user.click(screen.getByRole('tab', { name: 'Skills' }))
    expect(handleChange).toHaveBeenCalledWith('skills')
  })

  it('navigates to the next tab with ArrowRight', async () => {
    const user = userEvent.setup()
    renderTabs()
    screen.getByRole('tab', { name: 'Overview' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('Abilities content')).toBeInTheDocument()
  })

  it('navigates to the previous tab with ArrowLeft, wrapping around', async () => {
    const user = userEvent.setup()
    renderTabs()
    screen.getByRole('tab', { name: 'Overview' }).focus()
    await user.keyboard('{ArrowLeft}')
    // Wraps to the last tab
    expect(screen.getByText('Skills content')).toBeInTheDocument()
  })

  it('jumps to the first tab on Home and last tab on End', async () => {
    const user = userEvent.setup()
    renderTabs()
    screen.getByRole('tab', { name: 'Overview' }).focus()
    await user.keyboard('{End}')
    expect(screen.getByText('Skills content')).toBeInTheDocument()
    await user.keyboard('{Home}')
    expect(screen.getByText('Overview content')).toBeInTheDocument()
  })

  it('respects a controlled activeTabId over internal state', () => {
    renderTabs({ activeTabId: 'skills' })
    expect(screen.getByText('Skills content')).toBeInTheDocument()
  })

  it('only inactive tabs are not reachable via Tab key (tabIndex=-1)', () => {
    renderTabs()
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('tabIndex', '0')
    expect(screen.getByRole('tab', { name: 'Abilities' })).toHaveAttribute('tabIndex', '-1')
  })
})
