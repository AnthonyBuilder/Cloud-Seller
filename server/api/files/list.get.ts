import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const allFiles = query.all === 'true'
  const folder = safeFolder(query.folder)
  const userPath = userPrefix(user.sub)
  const prefix = allFiles
    ? userPath
    : `${userPath}${folder === '/' ? '' : folder.slice(1)}`

  const client = createS3Client()
  const objectPrefixes = []
  const objects = []
  let continuationToken: string | undefined
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: requireS3Bucket(),
      Prefix: prefix,
      ...(!allFiles ? { Delimiter: '/' } : {}),
      ContinuationToken: continuationToken,
    }))
    objectPrefixes.push(...(response.CommonPrefixes || []))
    objects.push(...(response.Contents || []))
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

  if (allFiles) {
    const files = objects
      .filter(item => item.Key && !item.Key.endsWith('/'))
      .map(item => {
        const key = item.Key!
        const relative = key.slice(userPath.length)
        const separator = relative.lastIndexOf('/')
        return {
          key,
          name: relative.slice(separator + 1),
          folder: separator < 0 ? '/' : `/${relative.slice(0, separator + 1)}`,
          size: item.Size || 0,
          modified: item.LastModified?.toISOString() || '',
          etag: item.ETag || '',
        }
      })
    return { folder: '/', folders: [], files }
  }

  const folders = objectPrefixes.map(item => {
    const relative = item.Prefix!.slice(prefix.length).replace(/\/$/, '')
    return {
      name: relative,
      path: `${folder === '/' ? '/' : folder}${relative}/`,
    }
  })

  const files = objects
    .filter(item => item.Key !== prefix)
    .map(item => ({
      key: item.Key!,
      name: item.Key!.slice(prefix.length),
      size: item.Size || 0,
      modified: item.LastModified?.toISOString() || '',
      etag: item.ETag || '',
    }))

  return { folder, folders, files }
})
