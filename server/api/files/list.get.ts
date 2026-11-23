import { ListObjectsV2Command } from '@aws-sdk/client-s3'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)
  const folder = safeFolder(query.folder)
  const prefix = `${userPrefix(user.sub)}${folder === '/' ? '' : folder.slice(1)}`

  const client = createS3Client()
  const objectPrefixes = []
  const objects = []
  let continuationToken: string | undefined
  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: requireS3Bucket(),
      Prefix: prefix,
      Delimiter: '/',
      ContinuationToken: continuationToken,
    }))
    objectPrefixes.push(...(response.CommonPrefixes || []))
    objects.push(...(response.Contents || []))
    continuationToken = response.NextContinuationToken
  } while (continuationToken)

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
