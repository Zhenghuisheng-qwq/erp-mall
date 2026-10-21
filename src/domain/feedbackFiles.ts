import JSZip from 'jszip'
import type { FeedbackAttachmentRef, FeedbackItem } from './types'

const DB_NAME = 'iyge-feedback-files'
const STORE = 'files'
export const IMAGE_LIMIT = 5 * 1024 * 1024
export const VIDEO_LIMIT = 30 * 1024 * 1024
export const FILE_LIMIT = 6

interface StoredFile {
  id: string
  name: string
  type: string
  size: number
  blob: Blob
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('这台浏览器不能保存附件'))
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('附件库打不开'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = run(tx.objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error('附件读写失败'))
    })
  } finally {
    db.close()
  }
}

export function checkAttachment(file: File, count: number) {
  if (count >= FILE_LIMIT) return `一次最多 ${FILE_LIMIT} 个附件`
  if (file.type.startsWith('image/')) return file.size > IMAGE_LIMIT ? '单张图片不能超过 5MB' : ''
  if (file.type.startsWith('video/')) return file.size > VIDEO_LIMIT ? '单个视频不能超过 30MB' : ''
  return '只能附加图片或短视频'
}

export async function saveAttachment(id: string, file: File) {
  const row: StoredFile = { id, name: file.name || '未命名', type: file.type, size: file.size, blob: file }
  await withStore('readwrite', (store) => store.put(row))
  return { id, name: row.name, type: row.type, size: row.size } satisfies FeedbackAttachmentRef
}

export async function readAttachment(id: string) {
  return withStore<StoredFile | undefined>('readonly', (store) => store.get(id))
}

export async function deleteAttachments(ids: string[]) {
  if (!ids.length) return
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    ids.forEach((id) => store.delete(id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('附件删除失败'))
  })
  db.close()
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_')
}

export async function exportFeedbackPack(items: FeedbackItem[]) {
  const zip = new JSZip()
  const files = zip.folder('files')
  const feedbacks = []
  for (const item of items) {
    const refs = []
    for (const file of item.attachmentRefs || []) {
      const stored = await readAttachment(file.id)
      const path = `files/${file.id}-${safeName(file.name)}`
      if (stored?.blob && files) files.file(`${file.id}-${safeName(file.name)}`, stored.blob)
      refs.push({ ...file, path, missing: !stored?.blob })
    }
    if (refs.some((file) => file.missing)) throw new Error('有附件没能从本机读出，这次没有导出')
    feedbacks.push({ ...item, files: refs })
  }
  zip.file('manifest.json', JSON.stringify({ kind: 'iyge-feedback-pack', version: 1, exportedAt: new Date().toISOString(), note: '本包由本机导出，不代表开发人员已经收到。', feedbacks }, null, 2))
  return zip.generateAsync({ type: 'blob' })
}

export async function readFeedbackPack(file: File) {
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('这不是反馈包')
  const manifest = JSON.parse(await manifestFile.async('string')) as { kind?: string; version?: number; feedbacks?: Array<FeedbackItem & { files?: Array<FeedbackAttachmentRef & { path?: string; missing?: boolean }> }> }
  if (manifest.kind !== 'iyge-feedback-pack' || manifest.version !== 1 || !Array.isArray(manifest.feedbacks)) throw new Error('反馈包格式不对')
  const feedbacks: FeedbackItem[] = []
  for (const item of manifest.feedbacks) {
    if (!item.id || !item.title || !item.content) throw new Error('反馈包里有不完整的记录')
    const refs: FeedbackAttachmentRef[] = []
    for (const attachment of item.files || []) {
      if (!attachment.path || attachment.missing) continue
      const packed = zip.file(attachment.path)
      if (!packed) throw new Error(`缺少附件 ${attachment.name}`)
      const blob = await packed.async('blob')
      const typed = new File([blob], attachment.name, { type: attachment.type })
      refs.push(await saveAttachment(attachment.id, typed))
    }
    feedbacks.push({
      id: item.id,
      title: item.title,
      content: item.content,
      status: item.status || 'open',
      page: item.page || '历史反馈',
      createdAt: item.createdAt || new Date().toISOString(),
      kind: item.kind,
      route: item.route,
      featureId: item.featureId,
      featureName: item.featureName,
      attachmentRefs: refs,
    })
  }
  return feedbacks
}

export function fileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
