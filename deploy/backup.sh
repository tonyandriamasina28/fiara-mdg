#!/usr/bin/env sh
# Sauvegarde quotidienne chiffrée de la base fiara.mdg vers un stockage S3 (IONOS Object Storage).
# À planifier sur le VPS : 30 3 * * * /opt/fiara/deploy/backup.sh >> /var/log/fiara-backup.log 2>&1
# Prérequis : docker, openssl, aws-cli configuré avec les clés d'accès IONOS S3.
set -eu
cd "$(dirname "$0")"
. ./.env

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
FILE="/tmp/fiara-db-$STAMP.sql.gz.enc"

# Dump → compression → chiffrement AES-256 (la phrase de passe n'est jamais sur le stockage distant)
docker compose --env-file .env exec -T db pg_dump -U fiara -d fiara --no-owner \
  | gzip -9 \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$FILE"

aws s3 cp "$FILE" "s3://$BACKUP_S3_BUCKET/db/$STAMP.sql.gz.enc" --endpoint-url "$BACKUP_S3_ENDPOINT"
rm -f "$FILE"

# Photos d'annonces (non sensibles) : synchronisation incrémentale
docker run --rm -v deploy_photos:/data:ro -v "$HOME/.aws:/root/.aws:ro" amazon/aws-cli \
  s3 sync /data "s3://$BACKUP_S3_BUCKET/photos" --endpoint-url "$BACKUP_S3_ENDPOINT"

# Les pièces d'identité ne sont PAS sauvegardées : elles sont temporaires et supprimées après vérification.
echo "Sauvegarde $STAMP terminée"
# Restauration : aws s3 cp … ; openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in f | gunzip | psql
