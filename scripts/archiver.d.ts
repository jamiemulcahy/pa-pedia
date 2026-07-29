/**
 * archiver 8.0.0 ships no type declarations of its own, and @types/archiver
 * only describes the pre-8.0 factory-function API - so we declare the
 * minimal surface this repo actually uses.
 */
declare module 'archiver' {
  import { Transform } from 'node:stream'

  interface ArchiverOptions {
    zlib?: { level?: number }
  }

  class Archiver extends Transform {
    constructor(options?: ArchiverOptions)
    pointer(): number
    directory(dirpath: string, destpath: string | false): this
    finalize(): Promise<void>
  }

  export class ZipArchive extends Archiver {}
  export class TarArchive extends Archiver {}
  export class JsonArchive extends Archiver {}
}
