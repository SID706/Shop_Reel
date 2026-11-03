/* eslint-disable no-undef */
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { createClient } from '@supabase/supabase-js'

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'R2_BUCKET', 'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`)
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const storage = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
})
const known = new Set()
for (const table of ['reels']) {
  const { data, error } = await supabase.from(table).select('video_key,poster_key,product_image_key')
  if (error) throw error
  for (const row of data ?? []) {
    for (const key of [row.video_key, row.poster_key, row.product_image_key]) if (key) known.add(key)
  }
}
const cutoff = Date.now() - 24 * 60 * 60 * 1000
let continuationToken
let deleted = 0
do {
  const page = await storage.send(new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, Prefix: 'users/', ContinuationToken: continuationToken }))
  for (const object of page.Contents ?? []) {
    if (object.Key && object.LastModified && object.LastModified.getTime() < cutoff && !known.has(object.Key)) {
      await storage.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: object.Key }))
      deleted += 1
    }
  }
  continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
} while (continuationToken)
console.log(`Deleted ${deleted} orphaned R2 objects`)
