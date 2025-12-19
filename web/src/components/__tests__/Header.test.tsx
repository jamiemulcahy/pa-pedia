import { describe, it, expect, vi } from 'vitest'
import { screen, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Header } from '../Header'

function renderHeader(
  onUploadClick = vi.fn(),
  onDownloadClick = vi.fn(),
  isFestiveMode = false,
  onToggleFestiveMode = vi.fn()
) {
  return render(
    <BrowserRouter>
      <Header
        onUploadClick={onUploadClick}
        onDownloadClick={onDownloadClick}
        isFestiveMode={isFestiveMode}
        onToggleFestiveMode={onToggleFestiveMode}
      />
    </BrowserRouter>
  )
}

describe('Header', () => {
  it('should render the title', () => {
    renderHeader()
    expect(screen.getByText('PA-PEDIA')).toBeInTheDocument()
  })

  it('should render the subtitle', () => {
    renderHeader()
    expect(screen.getByText('Browse Planetary Annihilation Titans faction data')).toBeInTheDocument()
  })

  it('should link title to home page', () => {
    renderHeader()
    const titleLink = screen.getByText('PA-PEDIA').closest('a')
    expect(titleLink).toHaveAttribute('href', '/')
  })

  it('should render GitHub link with correct URL', () => {
    renderHeader()
    const githubLink = screen.getByLabelText('View on GitHub')
    expect(githubLink).toHaveAttribute('href', 'https://github.com/jamiemulcahy/pa-pedia')
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('should render download button', () => {
    renderHeader()
    expect(screen.getByLabelText('Download CLI tool')).toBeInTheDocument()
  })

  it('should render upload button', () => {
    renderHeader()
    expect(screen.getByLabelText('Upload local faction')).toBeInTheDocument()
  })

  it('should call onDownloadClick when download button is clicked', async () => {
    const onDownloadClick = vi.fn()
    renderHeader(vi.fn(), onDownloadClick)

    const downloadButton = screen.getByLabelText('Download CLI tool')
    await userEvent.click(downloadButton)

    expect(onDownloadClick).toHaveBeenCalledTimes(1)
  })

  it('should call onUploadClick when upload button is clicked', async () => {
    const onUploadClick = vi.fn()
    renderHeader(onUploadClick)

    const uploadButton = screen.getByLabelText('Upload local faction')
    await userEvent.click(uploadButton)

    expect(onUploadClick).toHaveBeenCalledTimes(1)
  })

  it('should have sticky positioning', () => {
    renderHeader()
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('sticky')
    expect(header).toHaveClass('top-0')
  })

  it('should have proper z-index for layering', () => {
    renderHeader()
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('z-40')
  })

  it('should render festive mode toggle button', () => {
    renderHeader()
    expect(screen.getByLabelText('Enable festive mode')).toBeInTheDocument()
  })

  it('should call onToggleFestiveMode when toggle button is clicked', async () => {
    const onToggleFestiveMode = vi.fn()
    renderHeader(vi.fn(), vi.fn(), false, onToggleFestiveMode)

    const toggleButton = screen.getByLabelText('Enable festive mode')
    await userEvent.click(toggleButton)

    expect(onToggleFestiveMode).toHaveBeenCalledTimes(1)
  })

  it('should show Santa emoji when festive mode is enabled', () => {
    renderHeader(vi.fn(), vi.fn(), true)
    expect(screen.getByLabelText('Disable festive mode')).toBeInTheDocument()
    expect(screen.getByText('🎅')).toBeInTheDocument()
  })

  it('should show snowman emoji when festive mode is disabled', () => {
    renderHeader(vi.fn(), vi.fn(), false)
    expect(screen.getByLabelText('Enable festive mode')).toBeInTheDocument()
    expect(screen.getByText('☃️')).toBeInTheDocument()
  })

  it('should show Christmas tree in subtitle when festive mode is enabled', () => {
    renderHeader(vi.fn(), vi.fn(), true)
    expect(screen.getByText(/🎄/)).toBeInTheDocument()
  })
})
