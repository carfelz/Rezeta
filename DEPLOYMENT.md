# Deployment Guide

## Manual Setup (One-Time)

### GCP Project

- Project ID: `medical-erp-dev`
- Region: `southamerica-east1` (São Paulo, Brazil)
- Billing: [link to billing account]

### Cloud SQL

- Instance: `medical-erp-dev-db`
- Type: PostgreSQL 16
- Machine: db-f1-micro (1 vCPU, 0.6GB RAM)
- Storage: 10GB SSD
- Connection: Private IP + Cloud SQL Proxy
- Password: Stored in Secret Manager as `database-url`

### GCS Buckets

1. `gs://medical-erp-dev-frontend` - Public, static website hosting
2. `gs://medical-erp-dev-uploads` - Private, signed URLs only

### Firebase

- Project: Linked to `medical-erp-dev`
- Auth: Email/Password + Google OAuth
- Admin SDK key: Stored in Secret Manager as `firebase-admin-key`

### Secret Manager

- `database-url` - PostgreSQL connection string
- `firebase-admin-key` - Firebase Admin SDK JSON

## Deployment

### Frontend

```bash
./scripts/deploy-frontend.sh
```

### API

```bash
./scripts/deploy-api.sh
```

### Database Migrations

```bash
./scripts/run-migration.sh
```

## URLs (Dev)

- Frontend: https://storage.googleapis.com/medical-erp-dev-frontend/index.html
- API: [get from Cloud Run console]
- Database: Private (Cloud SQL Proxy only)

## Cost Estimate

- Cloud SQL: ~$7/month
- Cloud Run: ~$5-10/month (minimal traffic)
- GCS: ~$1-2/month
- **Total: ~$15-20/month**

## Disaster Recovery

- Cloud SQL: Automated daily backups, 7-day retention
- Manual: Export Prisma schema + seed data monthly
