/**
 * GoHighLevel Media API Client
 * Documentation: https://highlevel.stoplight.io/docs/integrations/
 *
 * Base URL: https://services.leadconnectorhq.com
 * Auth: Bearer {GHL_PRIVATE_INTEGRATION_TOKEN}
 * Header: Version: 2021-07-28
 */

const GHL_API_BASE = 'https://services.leadconnectorhq.com'
const GHL_API_VERSION = '2021-07-28'

// =============================================================================
// TYPES
// =============================================================================

export interface GHLMediaFile {
  id: string
  altId: string
  altType: string
  name: string
  parentId?: string
  url?: string
  path?: string
  isFolder: boolean
  mimeType?: string
  size?: number
  createdAt: string
  updatedAt: string
}

export interface GHLMediaListResponse {
  files: GHLMediaFile[]
  total?: number
}

export interface GHLMediaUploadResponse {
  fileId: string
  fileName: string
  url: string
}

export interface GHLMediaFolderResponse {
  folderId: string
  name: string
}

export interface GHLMediaUpdateResponse {
  success: boolean
  file?: GHLMediaFile
}

export interface GHLMediaDeleteResponse {
  success: boolean
}

// =============================================================================
// AUTH
// =============================================================================

/**
 * Get the GHL API Token from environment
 * Tries GHL_PRIVATE_INTEGRATION_TOKEN first, falls back to GHL_API_KEY
 */
export function getGHLToken(): string {
  const token = process.env.GHL_PRIVATE_INTEGRATION_TOKEN || process.env.GHL_API_KEY
  if (!token) {
    throw new Error('GHL API token is not configured. Set GHL_PRIVATE_INTEGRATION_TOKEN or GHL_API_KEY')
  }
  return token
}

/**
 * Get the GHL Location ID from environment
 */
export function getGHLLocationId(): string {
  const locationId = process.env.GHL_LOCATION_ID
  if (!locationId) {
    throw new Error('GHL_LOCATION_ID is not configured')
  }
  return locationId
}

// =============================================================================
// HELPER
// =============================================================================

async function ghlRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = getGHLToken()
  const url = `${GHL_API_BASE}${endpoint}`

  console.log('[GHL Media] Request URL:', url)

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[GHL Media] API error:', response.status, errorText)
    throw new Error(`GHL Media API error: ${response.status} - ${errorText}`)
  }

  // Handle empty responses (e.g., DELETE)
  const text = await response.text()
  if (!text) {
    return {} as T
  }

  try {
    const parsed = JSON.parse(text) as T
    console.log('[GHL Media] Response:', JSON.stringify(parsed, null, 2).slice(0, 500))
    return parsed
  } catch {
    return {} as T
  }
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * List files and folders from GHL Media Library
 * GET /medias/files
 *
 * @param parentId - Optional parent folder ID to list contents of
 * @param searchKey - Optional search term to filter files
 * @param limit - Number of items to return (default 50)
 * @param offset - Pagination offset
 */
export async function listFiles(params?: {
  parentId?: string
  searchKey?: string
  limit?: number
  offset?: number
  type?: 'file' | 'folder'
}): Promise<GHLMediaListResponse> {
  const locationId = getGHLLocationId()
  console.log('[GHL Media] Location ID:', locationId)

  const searchParams = new URLSearchParams({
    altId: locationId,
    altType: 'location',
    type: params?.type || 'file',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  })

  if (params?.parentId) {
    searchParams.set('parentId', params.parentId)
  }
  if (params?.searchKey) {
    searchParams.set('searchKey', params.searchKey)
  }
  if (params?.limit) {
    searchParams.set('limit', String(params.limit))
  }
  if (params?.offset) {
    searchParams.set('offset', String(params.offset))
  }

  return ghlRequest<GHLMediaListResponse>(
    `/medias/files?${searchParams.toString()}`
  )
}

/**
 * Get a single file by ID
 * GET /medias/files/:id
 */
export async function getFile(id: string): Promise<{ file: GHLMediaFile }> {
  const locationId = getGHLLocationId()
  const searchParams = new URLSearchParams({
    altId: locationId,
    altType: 'location',
    type: 'location',
  })

  return ghlRequest<{ file: GHLMediaFile }>(
    `/medias/files/${id}?${searchParams.toString()}`
  )
}

/**
 * Upload a file to GHL Media Library
 * POST /medias/upload-file
 *
 * Standard uploads: 25MB limit
 * Video uploads: 500MB limit
 *
 * @param file - File buffer to upload
 * @param fileName - Name of the file
 * @param options - Upload options including optional parent folder
 */
export async function uploadFile(
  file: ArrayBuffer,
  fileName: string,
  options?: { parentId?: string }
): Promise<GHLMediaUploadResponse> {
  const token = getGHLToken()
  const locationId = getGHLLocationId()

  const formData = new FormData()

  // Create a Blob from the ArrayBuffer with appropriate mime type
  const mimeType = getMimeType(fileName)
  const blob = new Blob([file], { type: mimeType })
  formData.append('file', blob, fileName)

  // Add location info
  formData.append('altId', locationId)
  formData.append('altType', 'location')

  // Add parent folder if specified
  if (options?.parentId) {
    formData.append('parentId', options.parentId)
  }

  const response = await fetch(`${GHL_API_BASE}/medias/upload-file`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: GHL_API_VERSION,
      // Note: Don't set Content-Type - let fetch set it with boundary for FormData
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[GHL Media] Upload error:', response.status, errorText)
    throw new Error(`GHL Media upload error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/**
 * Create a new folder in GHL Media Library
 * POST /medias/folder
 *
 * @param name - Folder name
 * @param parentId - Optional parent folder ID
 */
export async function createFolder(
  name: string,
  parentId?: string
): Promise<GHLMediaFolderResponse> {
  const locationId = getGHLLocationId()

  const body: Record<string, string> = {
    name,
    altId: locationId,
    altType: 'location',
    type: 'location',
  }

  if (parentId) {
    body.parentId = parentId
  }

  return ghlRequest<GHLMediaFolderResponse>('/medias/folder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

/**
 * Update a file or folder name
 * PUT /medias/:id
 *
 * @param id - File or folder ID
 * @param name - New name
 */
export async function updateFile(
  id: string,
  name: string
): Promise<GHLMediaUpdateResponse> {
  const locationId = getGHLLocationId()

  return ghlRequest<GHLMediaUpdateResponse>(`/medias/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      altId: locationId,
      altType: 'location',
    }),
  })
}

/**
 * Delete a file or folder
 * DELETE /medias/:id
 *
 * @param id - File or folder ID to delete
 */
export async function deleteFile(id: string): Promise<GHLMediaDeleteResponse> {
  const locationId = getGHLLocationId()
  const searchParams = new URLSearchParams({
    altId: locationId,
    altType: 'location',
    type: 'location',
  })

  await ghlRequest<void>(`/medias/${id}?${searchParams.toString()}`, {
    method: 'DELETE',
  })

  return { success: true }
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Get MIME type from file extension
 */
function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const mimeTypes: Record<string, string> = {
    // Images
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    // Videos
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    // Documents
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Audio
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    // Other
    json: 'application/json',
    txt: 'text/plain',
    csv: 'text/csv',
  }

  return mimeTypes[ext || ''] || 'application/octet-stream'
}

/**
 * Check if file size is within limits
 * @param size - File size in bytes
 * @param isVideo - Whether the file is a video
 */
export function isFileSizeValid(size: number, isVideo: boolean): boolean {
  const MAX_STANDARD_SIZE = 25 * 1024 * 1024 // 25MB
  const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_STANDARD_SIZE
  return size <= maxSize
}

/**
 * Check if file is a video based on extension
 */
export function isVideoFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ['mp4', 'webm', 'mov', 'avi'].includes(ext || '')
}
