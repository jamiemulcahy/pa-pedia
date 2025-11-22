import { useState, useRef } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'

interface FactionUploadProps {
  onClose: () => void
  onSuccess?: (factionId: string) => void
}

export function FactionUpload({ onClose, onSuccess }: FactionUploadProps) {
  const { uploadFaction } = useFactionContext()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setIsUploading(true)

    try {
      const result = await uploadFaction(file)
      onSuccess?.(result.factionId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload faction')
    } finally {
      setIsUploading(false)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
        <h2 id="upload-dialog-title" className="text-xl font-semibold text-white mb-4">
          Upload Faction
        </h2>

        <p className="text-gray-300 mb-4">
          Select a faction zip file to upload. The zip should contain metadata.json and units.json files.
        </p>

        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="block w-full text-sm text-gray-300
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-600 file:text-white
              hover:file:bg-blue-500
              file:cursor-pointer
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {isUploading && (
          <div className="flex items-center gap-2 text-blue-400 mb-4">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Uploading...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
