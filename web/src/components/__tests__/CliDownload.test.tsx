import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, render, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CliDownload } from '../CliDownload'

function renderCliDownload(onClose = vi.fn()) {
  return {
    onClose,
    ...render(<CliDownload onClose={onClose} />)
  }
}

describe('CliDownload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render the modal title', () => {
      renderCliDownload()
      expect(screen.getByText('Download PA-Pedia CLI')).toBeInTheDocument()
    })

    it('should render the description', () => {
      renderCliDownload()
      expect(screen.getByText(/extracts faction data from Planetary Annihilation/i)).toBeInTheDocument()
    })

    it('should render download buttons for all platforms', () => {
      renderCliDownload()
      expect(screen.getByText('Windows (64-bit)')).toBeInTheDocument()
      expect(screen.getByText('macOS (Intel)')).toBeInTheDocument()
      expect(screen.getByText('macOS (Apple Silicon)')).toBeInTheDocument()
      expect(screen.getByText('Linux (64-bit)')).toBeInTheDocument()
    })

    it('should render quick start instructions', () => {
      renderCliDownload()
      expect(screen.getByText('Quick Start')).toBeInTheDocument()
      expect(screen.getByText(/Download and extract the CLI/i)).toBeInTheDocument()
      expect(screen.getByText('pa-pedia extract --faction MLA')).toBeInTheDocument()
    })

    it('should render GitHub releases link', () => {
      renderCliDownload()
      const releasesLink = screen.getByText('View all releases on GitHub')
      expect(releasesLink).toHaveAttribute('href', expect.stringContaining('github.com'))
      expect(releasesLink).toHaveAttribute('target', '_blank')
    })
  })

  describe('accessibility', () => {
    it('should have proper dialog role', () => {
      renderCliDownload()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have aria-modal attribute', () => {
      renderCliDownload()
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('should have aria-labelledby pointing to title', () => {
      renderCliDownload()
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'cli-download-title')
      expect(screen.getByText('Download PA-Pedia CLI')).toHaveAttribute('id', 'cli-download-title')
    })

    it('should have accessible close button', () => {
      renderCliDownload()
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })
  })

  describe('interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const { onClose } = renderCliDownload()

      const closeButton = screen.getByLabelText('Close')
      await userEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Cancel button is clicked', async () => {
      const { onClose } = renderCliDownload()

      const cancelButton = screen.getByText('Close')
      await userEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', () => {
      const { onClose } = renderCliDownload()

      // The backdrop is the element with role="dialog" - it handles the click via e.target === e.currentTarget
      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should not call onClose when modal content is clicked', async () => {
      const { onClose } = renderCliDownload()

      // Click on the modal content, not the backdrop
      const modalContent = screen.getByText('Download PA-Pedia CLI')
      await userEvent.click(modalContent)

      expect(onClose).not.toHaveBeenCalled()
    })

    it('should call onClose when Escape key is pressed', () => {
      const { onClose } = renderCliDownload()

      fireEvent.keyDown(window, { key: 'Escape' })

      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('download links', () => {
    it('should have correct download URL for Windows', () => {
      renderCliDownload()
      const windowsLink = screen.getByText('Windows (64-bit)').closest('a')
      expect(windowsLink).toHaveAttribute('href', expect.stringContaining('pa-pedia_windows_amd64.exe'))
      expect(windowsLink).toHaveAttribute('download')
    })

    it('should have correct download URL for macOS Intel', () => {
      renderCliDownload()
      const macIntelLink = screen.getByText('macOS (Intel)').closest('a')
      expect(macIntelLink).toHaveAttribute('href', expect.stringContaining('pa-pedia_darwin_amd64'))
      expect(macIntelLink).toHaveAttribute('download')
    })

    it('should have correct download URL for macOS Apple Silicon', () => {
      renderCliDownload()
      const macArmLink = screen.getByText('macOS (Apple Silicon)').closest('a')
      expect(macArmLink).toHaveAttribute('href', expect.stringContaining('pa-pedia_darwin_arm64'))
      expect(macArmLink).toHaveAttribute('download')
    })

    it('should have correct download URL for Linux', () => {
      renderCliDownload()
      const linuxLink = screen.getByText('Linux (64-bit)').closest('a')
      expect(linuxLink).toHaveAttribute('href', expect.stringContaining('pa-pedia_linux_amd64'))
      expect(linuxLink).toHaveAttribute('download')
    })
  })
})
