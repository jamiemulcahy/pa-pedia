// CLI release configuration
// Uses 'latest' tag for download URLs - the release workflow updates this tag
// to always point to the newest release

export interface CliAsset {
  os: string
  arch: string
  filename: string
  label: string
}

export const CLI_RELEASE = {
  githubRepo: 'jamiemulcahy/pa-pedia',
  assets: [
    {
      os: 'windows',
      arch: 'amd64',
      filename: 'pa-pedia_windows_amd64.exe',
      label: 'Windows (64-bit)',
    },
    {
      os: 'darwin',
      arch: 'amd64',
      filename: 'pa-pedia_darwin_amd64',
      label: 'macOS (Intel)',
    },
    {
      os: 'darwin',
      arch: 'arm64',
      filename: 'pa-pedia_darwin_arm64',
      label: 'macOS (Apple Silicon)',
    },
    {
      os: 'linux',
      arch: 'amd64',
      filename: 'pa-pedia_linux_amd64',
      label: 'Linux (64-bit)',
    },
  ] as CliAsset[],
}

export function getDownloadUrl(asset: CliAsset): string {
  return `https://github.com/${CLI_RELEASE.githubRepo}/releases/download/latest/${asset.filename}`
}

export function getReleasesPageUrl(): string {
  return `https://github.com/${CLI_RELEASE.githubRepo}/releases`
}

// Detect user's platform
// Returns os, arch, and whether arch detection is confident
export function detectPlatform(): {
  os: string
  arch: string
  archConfident: boolean
} | null {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  let os: string | null = null
  let arch = 'amd64' // Default to amd64
  let archConfident = true

  if (userAgent.includes('win') || platform.includes('win')) {
    os = 'windows'
  } else if (userAgent.includes('mac') || platform.includes('mac')) {
    os = 'darwin'
    // macOS: Try to detect Apple Silicon vs Intel
    // Default to Intel, but mark as uncertain so UI can show both options
    archConfident = false

    // Check if userAgent explicitly mentions arm
    if (userAgent.includes('arm')) {
      arch = 'arm64'
      archConfident = true
    }
  } else if (userAgent.includes('linux') || platform.includes('linux')) {
    os = 'linux'
  }

  if (!os) return null
  return { os, arch, archConfident }
}
