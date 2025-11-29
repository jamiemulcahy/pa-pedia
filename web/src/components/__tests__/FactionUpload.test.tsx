import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, render, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FactionUpload } from '../FactionUpload'
import { FactionProvider } from '@/contexts/FactionContext'

// Mock the FactionContext
const mockUploadFaction = vi.fn()

vi.mock('@/contexts/FactionContext', async () => {
  const actual = await vi.importActual('@/contexts/FactionContext')
  return {
    ...actual,
    useFactionContext: () => ({
      uploadFaction: mockUploadFaction,
      factions: new Map(),
      loading: false,
      error: null,
      loadFactionIndex: vi.fn(),
      deleteFaction: vi.fn(),
    }),
  }
})

function renderFactionUpload(
  onClose = vi.fn(),
  onSuccess = vi.fn(),
  onOpenCliDownload = vi.fn()
) {
  return {
    onClose,
    onSuccess,
    onOpenCliDownload,
    ...render(
      <FactionProvider>
        <FactionUpload
          onClose={onClose}
          onSuccess={onSuccess}
          onOpenCliDownload={onOpenCliDownload}
        />
      </FactionProvider>
    ),
  }
}

describe('FactionUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUploadFaction.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render the modal title', () => {
      renderFactionUpload()
      expect(screen.getByText('Upload Local Faction')).toBeInTheDocument()
    })

    it('should render the drop zone', () => {
      renderFactionUpload()
      expect(screen.getByText('Drag and drop faction zip here')).toBeInTheDocument()
      expect(screen.getByText('or click to select file')).toBeInTheDocument()
    })

    it('should render About Local Factions section', () => {
      renderFactionUpload()
      expect(screen.getByText('About Local Factions')).toBeInTheDocument()
      expect(screen.getByText(/stored in your browser/i)).toBeInTheDocument()
      expect(screen.getByText(/Your data never leaves your device/i)).toBeInTheDocument()
    })

    it('should render File Requirements section', () => {
      renderFactionUpload()
      expect(screen.getByText('File Requirements')).toBeInTheDocument()
      // Multiple elements contain "PA-Pedia CLI tool" - use getAllByText
      const cliToolMentions = screen.getAllByText(/PA-Pedia CLI/i)
      expect(cliToolMentions.length).toBeGreaterThan(0)
    })

    it('should render CLI tool download section', () => {
      renderFactionUpload()
      expect(screen.getByText('Need faction data?')).toBeInTheDocument()
      expect(screen.getByText('Get the CLI Tool')).toBeInTheDocument()
    })

    it('should render Cancel button', () => {
      renderFactionUpload()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    it('should have proper dialog role', () => {
      renderFactionUpload()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should have aria-modal attribute', () => {
      renderFactionUpload()
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('should have aria-labelledby pointing to title', () => {
      renderFactionUpload()
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'upload-dialog-title')
    })

    it('should have accessible close button', () => {
      renderFactionUpload()
      expect(screen.getByLabelText('Close')).toBeInTheDocument()
    })

    it('should have hidden file input', () => {
      renderFactionUpload()
      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toHaveClass('hidden')
    })
  })

  describe('interactions', () => {
    it('should call onClose when close button is clicked', async () => {
      const { onClose } = renderFactionUpload()

      const closeButton = screen.getByLabelText('Close')
      await userEvent.click(closeButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Cancel button is clicked', async () => {
      const { onClose } = renderFactionUpload()

      const cancelButton = screen.getByText('Cancel')
      await userEvent.click(cancelButton)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when backdrop is clicked', async () => {
      const { onClose } = renderFactionUpload()

      // The backdrop is the element with role="dialog"
      const backdrop = screen.getByRole('dialog')
      // Click on the backdrop itself (which handles the backdrop click via e.target === e.currentTarget)
      fireEvent.click(backdrop)

      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('should call onOpenCliDownload when Get CLI Tool button is clicked', async () => {
      const { onOpenCliDownload, onClose } = renderFactionUpload()

      const getCliButton = screen.getByText('Get the CLI Tool')
      await userEvent.click(getCliButton)

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(onOpenCliDownload).toHaveBeenCalledTimes(1)
    })

    it('should open file picker when drop zone is clicked', async () => {
      renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const clickSpy = vi.spyOn(fileInput, 'click')

      const dropZone = screen.getByText('Drag and drop faction zip here').closest('div')!
      await userEvent.click(dropZone)

      expect(clickSpy).toHaveBeenCalled()
    })
  })

  describe('drag and drop', () => {
    it('should handle drag over event', () => {
      renderFactionUpload()

      // Find the drop zone - it's the div containing the drop text with border-dashed
      const dropZoneText = screen.getByText('Drag and drop faction zip here')
      const dropZone = dropZoneText.closest('div[class*="border-dashed"]')!

      // Verify drag events can be fired without error
      fireEvent.dragOver(dropZone, {
        dataTransfer: { files: [] },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      })

      // The component should still be rendered after drag over
      expect(screen.getByText('Drag and drop faction zip here')).toBeInTheDocument()
    })

    it('should handle drag leave event', () => {
      renderFactionUpload()

      const dropZoneText = screen.getByText('Drag and drop faction zip here')
      const dropZone = dropZoneText.closest('div[class*="border-dashed"]')!

      fireEvent.dragOver(dropZone, {
        dataTransfer: { files: [] },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      })
      fireEvent.dragLeave(dropZone, {
        dataTransfer: { files: [] },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      })

      // The component should still be rendered after drag leave
      expect(screen.getByText('Drag and drop faction zip here')).toBeInTheDocument()
    })

    it('should handle drop event', async () => {
      mockUploadFaction.mockResolvedValue({ factionId: 'test-faction' })
      const { onSuccess } = renderFactionUpload()

      const dropZoneText = screen.getByText('Drag and drop faction zip here')
      const dropZone = dropZoneText.closest('div[class*="border-dashed"]')!

      const file = new File(['content'], 'faction.zip', { type: 'application/zip' })

      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file] },
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      })

      await waitFor(() => {
        expect(mockUploadFaction).toHaveBeenCalledWith(file)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('test-faction')
      })
    })
  })

  describe('file validation', () => {
    it('should show error for non-zip files', async () => {
      renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('Please select a .zip file')).toBeInTheDocument()
      })
    })

    it('should accept .zip files', async () => {
      mockUploadFaction.mockResolvedValue({ factionId: 'test-faction' })
      const { onSuccess, onClose } = renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['content'], 'faction.zip', { type: 'application/zip' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockUploadFaction).toHaveBeenCalledWith(file)
      })

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith('test-faction')
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('should show error message on upload failure', async () => {
      mockUploadFaction.mockRejectedValue(new Error('Invalid faction data'))
      renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['content'], 'faction.zip', { type: 'application/zip' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('Invalid faction data')).toBeInTheDocument()
      })
    })
  })

  describe('loading state', () => {
    it('should show loading indicator while uploading', async () => {
      // Make uploadFaction never resolve to keep loading state
      mockUploadFaction.mockImplementation(() => new Promise(() => {}))
      renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['content'], 'faction.zip', { type: 'application/zip' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByText('Uploading...')).toBeInTheDocument()
      })
    })

    it('should disable close button while uploading', async () => {
      mockUploadFaction.mockImplementation(() => new Promise(() => {}))
      renderFactionUpload()

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File(['content'], 'faction.zip', { type: 'application/zip' })

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(screen.getByLabelText('Close')).toBeDisabled()
        expect(screen.getByText('Cancel')).toBeDisabled()
      })
    })
  })
})
