import { useState, useRef, useCallback } from 'react'
import { useFactionContext } from '@/contexts/FactionContext'

interface FactionUploadProps {
  onClose: () => void
  onSuccess?: (factionId: string) => void
  onOpenCliDownload: () => void
}

export function FactionUpload({
  onClose,
  onSuccess,
  onOpenCliDownload,
}: FactionUploadProps) {
  const { uploadFaction } = useFactionContext()
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.zip')) {
        setError('Please select a .zip file')
        return
      }

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
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [uploadFaction, onSuccess, onClose]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDropZoneClick = () => {
    fileInputRef.current?.click()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isUploading) {
      onClose()
    }
  }

  const handleGetCliClick = () => {
    onClose()
    onOpenCliDownload()
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-dialog-title"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2
            id="upload-dialog-title"
            className="text-xl font-semibold text-white"
          >
            Upload Local Faction
          </h2>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-900/20'
              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
          } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin h-10 w-10 text-blue-400" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-blue-400 font-medium">Uploading...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <svg
                className={`w-12 h-12 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <div>
                <span className={`font-medium ${isDragOver ? 'text-blue-300' : 'text-gray-200'}`}>
                  Drag and drop faction zip here
                </span>
                <p className="text-sm text-gray-400 mt-1">or click to select file</p>
              </div>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Information sections */}
        <div className="space-y-4 mb-6">
          {/* About local factions */}
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">
              About Local Factions
            </h3>
            <p className="text-sm text-gray-300">
              Local factions are custom faction data stored in your browser. They
              persist across sessions and can be deleted from the home page. Your
              data never leaves your device.
            </p>
          </div>

          {/* File requirements */}
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">
              File Requirements
            </h3>
            <p className="text-sm text-gray-300">
              Upload the .zip file generated by the PA-Pedia CLI tool.
            </p>
          </div>

          {/* Get CLI tool */}
          <div className="bg-blue-900/30 border border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-white mb-2">
              Need faction data?
            </h3>
            <p className="text-sm text-gray-300 mb-3">
              Use the PA-Pedia CLI tool to extract faction data from Planetary
              Annihilation Titans installed on your computer.
            </p>
            <button
              onClick={handleGetCliClick}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Get the CLI Tool
            </button>
          </div>
        </div>

        {/* Footer */}
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
