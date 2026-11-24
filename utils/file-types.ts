export const FILE_CATEGORIES = [
  'image',
  'video',
  'audio',
  'pdf',
  'spreadsheet',
  'document',
  'archive',
  'other',
] as const

export type FileCategory = typeof FILE_CATEGORIES[number]

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  image: 'Imagens',
  video: 'Vídeos',
  audio: 'Áudio',
  pdf: 'PDF',
  spreadsheet: 'Planilhas',
  document: 'Documentos',
  archive: 'Compactados',
  other: 'Outros',
}

const EXTENSION_CATEGORIES: Record<string, FileCategory> = {
  avif: 'image',
  bmp: 'image',
  gif: 'image',
  heic: 'image',
  jpeg: 'image',
  jpg: 'image',
  png: 'image',
  svg: 'image',
  webp: 'image',
  avi: 'video',
  mkv: 'video',
  mov: 'video',
  mp4: 'video',
  webm: 'video',
  m4a: 'audio',
  mp3: 'audio',
  oga: 'audio',
  ogg: 'audio',
  wav: 'audio',
  pdf: 'pdf',
  csv: 'spreadsheet',
  ods: 'spreadsheet',
  xls: 'spreadsheet',
  xlsx: 'spreadsheet',
  doc: 'document',
  docx: 'document',
  odt: 'document',
  rtf: 'document',
  txt: 'document',
  '7z': 'archive',
  gz: 'archive',
  rar: 'archive',
  tar: 'archive',
  zip: 'archive',
}

export function getFileCategory(fileName: string): FileCategory {
  const extension = fileName.split('.').pop()?.toLowerCase() || ''
  return EXTENSION_CATEGORIES[extension] || 'other'
}
