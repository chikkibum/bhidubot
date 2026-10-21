import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3'
import type { AwsEnv } from '@bhidubot/config'

export function createS3Client(env: AwsEnv): S3Client {
  return new S3Client({
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL,
    forcePathStyle: env.AWS_ENDPOINT_URL ? true : undefined,
    credentials: { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY },
  })
}

/** Creates the bucket if it does not exist. Safe to call repeatedly. */
export async function ensureBucket(s3: S3Client, bucket: string): Promise<void> {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
    return
  } catch {
    // missing (or not visible): fall through to create
  }
  try {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === 'BucketAlreadyOwnedByYou' || name === 'BucketAlreadyExists') return
    throw err
  }
}
