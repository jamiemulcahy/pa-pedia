/**
 * Extract minimal PA base game data for CI use
 *
 * Walks the PA media directory and copies only the files needed by the CLI:
 * - JSON specs (units, ammo, tools, base specs)
 * - Buildbar icons (*_icon_buildbar.png)
 * - Background/splash images referenced by profiles
 *
 * Creates a tar.gz archive, then encrypts it with AES-256-CBC for safe storage
 * as a public GitHub release asset.
 *
 * Usage:
 *   tsx extract-base-data.ts --pa-root "C:/PA/media" [--key <encryption-key>]
 *
 * Environment:
 *   PA_BASE_DATA_KEY - Encryption key (alternative to --key flag)
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { execSync } from 'node:child_process'
import { parseArgs } from 'node:util'

const INCLUDE_EXTENSIONS = new Set(['.json'])
const INCLUDE_PATTERNS = [/_icon_buildbar\.png$/]

/** Directories within PA media root that contain data the CLI needs */
const SOURCE_DIRS = ['pa', 'pa_ex1']

/** Additional files to include by glob-like patterns (relative to media root) */
const ADDITIONAL_PATTERNS = [
  /^ui\/.*\.(png|jpg)$/, // UI images (splash screens, backgrounds)
]

interface ExtractStats {
  totalFiles: number
  totalSize: number
  jsonFiles: number
  pngFiles: number
  otherFiles: number
}

/**
 * Check if a file should be included in the extract
 */
function shouldIncludeFile(relativePath: string): boolean {
  const ext = path.extname(relativePath).toLowerCase()

  // Always include JSON files
  if (INCLUDE_EXTENSIONS.has(ext)) return true

  // Include files matching specific patterns (icons, etc.)
  for (const pattern of INCLUDE_PATTERNS) {
    if (pattern.test(relativePath)) return true
  }

  // Include UI assets (splash screens referenced by profiles)
  for (const pattern of ADDITIONAL_PATTERNS) {
    if (pattern.test(relativePath.replace(/\\/g, '/'))) return true
  }

  return false
}

/**
 * Recursively walk a directory and return relative file paths
 */
function walkDir(dir: string, baseDir: string): string[] {
  const results: string[] = []

  if (!fs.existsSync(dir)) return results

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath, baseDir))
    } else if (entry.isFile()) {
      const relativePath = path.relative(baseDir, fullPath)
      if (shouldIncludeFile(relativePath)) {
        results.push(relativePath)
      }
    }
  }

  return results
}

/**
 * Try to detect PA build number from game files
 */
function detectBuildNumber(paRoot: string): string | null {
  // PA stores build info in the install root (parent of media/)
  const parentDir = path.dirname(paRoot)
  const candidates = [
    path.join(parentDir, 'version.txt'),
    path.join(parentDir, 'build.txt'),
    path.join(paRoot, 'version.txt'),
    path.join(paRoot, 'build.txt'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const content = fs.readFileSync(candidate, 'utf-8').trim()
      if (content) return content
    }
  }

  return null
}

/**
 * Convert a Windows path to a POSIX path for use with tar
 * e.g., C:\Users\foo -> /c/Users/foo
 */
function toPosixPath(p: string): string {
  // Replace backslashes with forward slashes
  let posix = p.replace(/\\/g, '/')
  // Convert drive letter: C:/... -> /c/...
  posix = posix.replace(/^([A-Za-z]):\//, (_, drive: string) => `/${drive.toLowerCase()}/`)
  return posix
}

/**
 * Create tar.gz archive of selected files
 */
function createArchive(paRoot: string, files: string[], outputPath: string): void {
  // Create a temporary directory with the file structure
  const tempDir = fs.mkdtempSync(path.join(path.dirname(outputPath), 'pa-base-data-'))

  try {
    // Copy files preserving directory structure
    for (const file of files) {
      const srcPath = path.join(paRoot, file)
      const destPath = path.join(tempDir, file)
      const destDir = path.dirname(destPath)

      fs.mkdirSync(destDir, { recursive: true })
      fs.copyFileSync(srcPath, destPath)
    }

    // Create tar.gz using system tar (use POSIX paths on Windows)
    const tarOutput = toPosixPath(outputPath)
    const tarInput = toPosixPath(tempDir)
    execSync(`tar -czf "${tarOutput}" -C "${tarInput}" .`, {
      stdio: 'pipe',
    })
  } finally {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * Encrypt a file with AES-256-CBC
 */
function encryptFile(inputPath: string, outputPath: string, key: string): void {
  const iv = crypto.randomBytes(16)
  // Derive a 32-byte key from the passphrase using scrypt
  const derivedKey = crypto.scryptSync(key, 'pa-pedia-base-data', 32)

  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv)

  const input = fs.readFileSync(inputPath)
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()])

  // Write IV + encrypted data
  const output = Buffer.concat([iv, encrypted])
  fs.writeFileSync(outputPath, output)
}

/**
 * Decrypt a file with AES-256-CBC (for verification)
 */
function decryptFile(inputPath: string, outputPath: string, key: string): void {
  const data = fs.readFileSync(inputPath)
  const iv = data.subarray(0, 16)
  const encrypted = data.subarray(16)

  const derivedKey = crypto.scryptSync(key, 'pa-pedia-base-data', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv)

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  fs.writeFileSync(outputPath, decrypted)
}

async function main() {
  const { values } = parseArgs({
    options: {
      'pa-root': { type: 'string' },
      key: { type: 'string' },
      output: { type: 'string', default: path.join(import.meta.dirname, '..', 'factions', 'dist') },
      verify: { type: 'boolean', default: false },
    },
  })

  const paRoot = values['pa-root']
  const encryptionKey = values.key || process.env.PA_BASE_DATA_KEY
  const outputDir = values.output!
  const verify = values.verify

  if (!paRoot) {
    console.error('Error: --pa-root is required')
    console.error('Usage: tsx extract-base-data.ts --pa-root "C:/PA/media" [--key <key>]')
    process.exit(1)
  }

  if (!encryptionKey) {
    console.error('Error: Encryption key required via --key flag or PA_BASE_DATA_KEY env var')
    process.exit(1)
  }

  if (!fs.existsSync(paRoot)) {
    console.error(`Error: PA root directory does not exist: ${paRoot}`)
    process.exit(1)
  }

  // Validate PA root has expected structure
  const hasPA = fs.existsSync(path.join(paRoot, 'pa'))
  const hasPAEx1 = fs.existsSync(path.join(paRoot, 'pa_ex1'))
  if (!hasPA) {
    console.error(`Error: ${paRoot} does not look like a PA media directory (missing 'pa/' folder)`)
    process.exit(1)
  }

  console.log('PA Base Data Extraction')
  console.log('=======================')
  console.log(`PA Root: ${paRoot}`)
  console.log(`Has pa/: ${hasPA}`)
  console.log(`Has pa_ex1/: ${hasPAEx1}`)
  console.log()

  // Discover files
  console.log('Scanning for files...')
  const files: string[] = []

  for (const sourceDir of SOURCE_DIRS) {
    const dirPath = path.join(paRoot, sourceDir)
    if (!fs.existsSync(dirPath)) continue
    const dirFiles = walkDir(dirPath, paRoot)
    files.push(...dirFiles)
    console.log(`  ${sourceDir}/: ${dirFiles.length} files`)
  }

  // Also scan for UI assets at the root level
  const uiDir = path.join(paRoot, 'ui')
  if (fs.existsSync(uiDir)) {
    const uiFiles = walkDir(uiDir, paRoot)
    files.push(...uiFiles)
    console.log(`  ui/: ${uiFiles.length} files`)
  }

  console.log(`  Total: ${files.length} files`)
  console.log()

  // Calculate stats
  const stats: ExtractStats = { totalFiles: files.length, totalSize: 0, jsonFiles: 0, pngFiles: 0, otherFiles: 0 }
  for (const file of files) {
    const fullPath = path.join(paRoot, file)
    const fileStat = fs.statSync(fullPath)
    stats.totalSize += fileStat.size
    const ext = path.extname(file).toLowerCase()
    if (ext === '.json') stats.jsonFiles++
    else if (ext === '.png') stats.pngFiles++
    else stats.otherFiles++
  }

  console.log(`Stats:`)
  console.log(`  JSON files: ${stats.jsonFiles}`)
  console.log(`  PNG files:  ${stats.pngFiles}`)
  console.log(`  Other:      ${stats.otherFiles}`)
  console.log(`  Total size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB (uncompressed)`)
  console.log()

  // Detect build number
  const buildNumber = detectBuildNumber(paRoot)
  console.log(`PA Build: ${buildNumber || 'unknown'}`)

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true })

  // Generate timestamp
  const now = new Date()
  const timestamp =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0')

  const archiveName = `pa-base-data-${buildNumber || 'unknown'}-${timestamp}`
  const tarPath = path.join(outputDir, `${archiveName}.tar.gz`)
  const encPath = path.join(outputDir, `${archiveName}.tar.gz.enc`)
  const metaPath = path.join(outputDir, 'pa-base-data-meta.json')

  // Create archive
  console.log()
  console.log('Creating archive...')
  createArchive(paRoot, files, tarPath)

  const tarSize = fs.statSync(tarPath).size
  console.log(`  Archive: ${tarPath} (${(tarSize / 1024 / 1024).toFixed(2)} MB)`)

  // Compute hash of unencrypted archive
  const tarHash = crypto.createHash('sha256').update(fs.readFileSync(tarPath)).digest('hex')

  // Encrypt
  console.log('Encrypting...')
  encryptFile(tarPath, encPath, encryptionKey)
  const encSize = fs.statSync(encPath).size
  console.log(`  Encrypted: ${encPath} (${(encSize / 1024 / 1024).toFixed(2)} MB)`)

  // Verify decryption roundtrip
  if (verify) {
    console.log('Verifying decryption...')
    const verifyPath = path.join(outputDir, `${archiveName}-verify.tar.gz`)
    decryptFile(encPath, verifyPath, encryptionKey)
    const verifyHash = crypto.createHash('sha256').update(fs.readFileSync(verifyPath)).digest('hex')
    if (tarHash !== verifyHash) {
      console.error('ERROR: Decryption verification failed! Hashes do not match.')
      process.exit(1)
    }
    console.log('  Verification passed!')
    fs.unlinkSync(verifyPath)
  }

  // Clean up unencrypted archive
  fs.unlinkSync(tarPath)

  // Write metadata
  const metadata = {
    build: buildNumber || 'unknown',
    timestamp,
    archiveFile: path.basename(encPath),
    stats: {
      totalFiles: stats.totalFiles,
      totalSizeBytes: stats.totalSize,
      jsonFiles: stats.jsonFiles,
      pngFiles: stats.pngFiles,
    },
    sha256Unencrypted: tarHash,
    extractedAt: now.toISOString(),
  }
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2))
  console.log()
  console.log(`Metadata: ${metaPath}`)

  console.log()
  console.log('Done! Next steps:')
  console.log(`  1. Upload the encrypted archive: just upload-base-data`)
  console.log(`  2. Set PA_BASE_DATA_KEY as a GitHub Actions secret`)
}

export { decryptFile }

main().catch((error) => {
  console.error('Extraction failed:', error)
  process.exit(1)
})
