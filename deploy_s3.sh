#!/usr/bin/env bash
set -euo pipefail

# deploy_s3.sh
# Create (if needed) a public S3 bucket, enable static website hosting,
# set a public read policy, and upload (sync) the current directory.
# Usage:
#   ./deploy_s3.sh BUCKET_NAME [REGION]
# Example:
#   ./deploy_s3.sh my-mock-exams-bucket us-east-1
# Requirements: AWS CLI v2 configured with credentials and default region (or pass REGION).

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 BUCKET_NAME [REGION]"
  exit 2
fi

BUCKET="$1"
REGION_ARG="${2:-}"

# Obtain default region if not provided
if [ -n "$REGION_ARG" ]; then
  REGION="$REGION_ARG"
else
  REGION=$(aws configure get region || echo "us-east-1")
  if [ -z "$REGION" ] || [ "$REGION" = "None" ]; then
    REGION="us-east-1"
  fi
fi

echo "Using S3 bucket: $BUCKET"
echo "Region: $REGION"

if ! command -v aws >/dev/null 2>&1; then
  echo "ERROR: aws CLI not found. Install and configure credentials first." >&2
  exit 3
fi

# Check if bucket exists
bucket_exists=false
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  bucket_exists=true
  echo "Bucket '$BUCKET' already exists."
else
  echo "Bucket '$BUCKET' does not exist; creating..."
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET"
  else
    aws s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "Created bucket $BUCKET"
fi

# Ensure the bucket has website hosting and is publicly accessible
# Disable S3 public block settings for this bucket (so the policy can take effect)
echo "Configuring public access block to allow public policies on the bucket..."
aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false || true

# Attach a bucket policy granting public read
read -r -d '' POLICY_JSON <<POLICY || true
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Sid":"PublicReadGetObject",
      "Effect":"Allow",
      "Principal":"*",
      "Action":["s3:GetObject"],
      "Resource":["arn:aws:s3:::$BUCKET/*"]
    }
  ]
}
POLICY

echo "Applying public read bucket policy..."
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "$POLICY_JSON"

# Enable static website hosting (index + error both index.html so client-side routing works)
echo "Enabling static website hosting (index.html)..."
aws s3 website s3://$BUCKET --index-document index.html --error-document index.html

# Perform sync to upload files
echo "Syncing files to s3://$BUCKET ..."
# Exclude common local dev directories and the script itself
# Many accounts now enforce 'Bucket owner enforced' (ACLs disabled). Don't rely on ACLs;
# public access is controlled via the bucket policy above. We'll try a sync without setting ACLs.
set +e
aws s3 sync . "s3://$BUCKET" \
  --exclude ".git/*" \
  --exclude "venv/*" \
  --exclude "node_modules/*" \
  --exclude "__pycache__/*" \
  --exclude "*.pyc" \
  --exclude "deploy_s3.sh" \
  --delete
sync_rc=$?
set -e
if [ $sync_rc -ne 0 ]; then
  echo "Warning: initial sync failed with exit code $sync_rc." >&2
  echo "Attempting a retry without altering ACLs or metadata..."
  # Retry once more; this may succeed in environments where transient errors occurred
  aws s3 sync . "s3://$BUCKET" \
    --exclude ".git/*" \
    --exclude "venv/*" \
    --exclude "node_modules/*" \
    --exclude "__pycache__/*" \
    --exclude "*.pyc" \
    --exclude "deploy_s3.sh" \
    --delete
fi

# Determine website endpoint. For us-east-1 the website endpoint still includes the region segment
if [ "$REGION" = "us-east-1" ]; then
  ENDPOINT="http://$BUCKET.s3-website-us-east-1.amazonaws.com"
else
  ENDPOINT="http://$BUCKET.s3-website-$REGION.amazonaws.com"
fi

echo
echo "Deployment complete. Your app should be available at:"
echo "  $ENDPOINT"

echo
# Provide an alternate S3 console link
echo "S3 Console: https://s3.console.aws.amazon.com/s3/buckets/$BUCKET?region=$REGION&tab=objects"

exit 0
