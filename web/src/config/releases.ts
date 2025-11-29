// CLI release configuration
// Version is injected at build time via VITE_CLI_VERSION environment variable

export interface CliAsset {
  os: string
  arch: string
  filename: string
  label: string
}

export const CLI_RELEASE = {
  version: import.meta.env.VITE_CLI_VERSION || 'v0.0.0',
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
  return `https://github.com/${CLI_RELEASE.githubRepo}/releases/download/${CLI_RELEASE.version}/${asset.filename}`
}

export function getReleasesPageUrl(): string {
  return `https://github.com/${CLI_RELEASE.githubRepo}/releases`
}

// Detect user's platform
export function detectPlatform(): { os: string; arch: string } | null {
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  let os: string | null = null
  let arch = 'amd64' // Default to amd64

  if (userAgent.includes('win') || platform.includes('win')) {
    os = 'windows'
  } else if (userAgent.includes('mac') || platform.includes('mac')) {
    os = 'darwin'
    // Check for Apple Silicon - this is a heuristic
    // Modern Safari on Apple Silicon reports arm in userAgent
    if (
      userAgent.includes('arm') ||
      // Check if running on Apple Silicon via WebGL renderer
      (typeof navigator !== 'undefined' && 'userAgentData' in navigator)
    ) {
      // Try to detect Apple Silicon
      try {
        const canvas = document.createElement('canvas')
        const gl = canvas.getContext('webgl')
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
          if (debugInfo) {
            const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
            if (renderer.includes('Apple M')) {
              arch = 'arm64'
            }
          }
        }
      } catch {
        // Fall back to amd64
      }
    }
  } else if (userAgent.includes('linux') || platform.includes('linux')) {
    os = 'linux'
  }

  if (!os) return null
  return { os, arch }
}

export function getRecommendedAsset(): CliAsset | null {
  const platform = detectPlatform()
  if (!platform) return null

  return (
    CLI_RELEASE.assets.find(
      (asset) => asset.os === platform.os && asset.arch === platform.arch
    ) || null
  )
}
