import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rm, stat } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import type { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/** Armazenamento de arquivos. A implementação local pode ser trocada por S3 & cia. */
export interface Storage {
  /** grava o stream e devolve quantos bytes foram escritos */
  save(stream: Readable, key: string): Promise<number>
  open(key: string): Promise<Readable>
  remove(key: string): Promise<void>
  /** apaga tudo sob um prefixo (ex.: todos os arquivos de um usuário) */
  removePrefix(prefix: string): Promise<void>
}

/** Disco local: <root>/<userId>/<fileId> */
export function createDiskStorage(root: string): Storage {
  const base = resolve(root)

  // as chaves são geradas pela api, mas confirmamos que nunca escapam da pasta raiz
  const pathOf = (key: string) => {
    const full = resolve(base, key)
    if (full !== base && !full.startsWith(base + sep)) throw new Error(`chave de arquivo inválida: ${key}`)
    return full
  }

  return {
    async save(stream, key) {
      const path = pathOf(key)
      await mkdir(dirname(path), { recursive: true })
      let bytes = 0
      stream.on('data', (chunk: Buffer) => {
        bytes += chunk.length
      })
      await pipeline(stream, createWriteStream(path, { flags: 'wx' }))
      return bytes
    },
    async open(key) {
      const path = pathOf(key)
      await stat(path) // lança ENOENT antes de começar a responder
      return createReadStream(path)
    },
    async remove(key) {
      await rm(pathOf(key), { force: true })
    },
    async removePrefix(prefix) {
      const path = pathOf(prefix)
      if (path === base) throw new Error('prefixo vazio')
      await rm(path, { recursive: true, force: true })
    },
  }
}
