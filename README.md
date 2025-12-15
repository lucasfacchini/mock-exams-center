Mock Exam Center
=================

This is a quick and simple frontend application to help browse and take mock exams defined in a JSON file.

> This was created using Copilot so don't worry about it not being perfect.

Quick start — run locally

1. Serve the files from the project root (requires Python 3):

```bash
python3 -m http.server 8000
```

2. Open http://localhost:8000 in your browser.

Notes when running locally
- If the app cannot fetch `exams.json` from the server it will show an upload prompt. You can:
  - Upload a valid `exams.json`, or
  - Click "Load sample exams" to populate the app with the provided `exams.sample.json`.
- The upload prompt includes a "View exams.json schema" section so you can inspect the required format.
- Uploaded JSON is saved to `localStorage` under key `uploaded_exams_json`; clear it from the Home screen with the "Clear Uploaded" button.

Deploy to AWS S3 (static site)

Prerequisites:
- AWS CLI installed and configured with credentials that can create buckets, put policies, and upload objects.

Basic deployment (script provided):

```bash
chmod +x deploy_s3.sh
./deploy_s3.sh YOUR-UNIQUE-BUCKET-NAME [region]
```

What the script does:
- Creates the S3 bucket if it does not already exist (in the requested region).
- Applies a public-read bucket policy and enables static website hosting (index.html / error -> index.html).
- Syncs the current directory to the bucket.
- Prints the public website endpoint when complete.

Caveats and notes:
- The script does NOT set object ACLs (some AWS accounts disallow ACLs). Public access is provided via the bucket policy.
- If your organization forbids public bucket policies, you'll need to host behind CloudFront with an origin access configuration. Ask if you want an automated CloudFront flow.
- The website endpoint is HTTP-only (S3 static website endpoints don't provide HTTPS directly). For HTTPS and custom domain, use CloudFront + ACM.

Schema and data

- The expected `exams.json` schema is available in `exams.schema.json`.
- A sample dataset is provided in `exams.sample.json` for quick testing.
