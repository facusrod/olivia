#!/bin/bash

# Configuración
BACKUP_DIR="$HOME/odoo-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/odoo-backup-$DATE.tar.gz"

# Crear directorio si no existe
mkdir -p $BACKUP_DIR

echo "🔄 Iniciando backup de Odoo..."

# Backup de AMBOS volúmenes en un solo archivo
docker run --rm \
  -v odoo_db-data:/db-data:ro \
  -v odoo_odoo-data:/odoo-data:ro \
  -v $BACKUP_DIR:/backup \
  ubuntu tar czf /backup/odoo-backup-$DATE.tar.gz /db-data /odoo-data

echo "✅ Backup completado: $BACKUP_FILE"
echo "📦 Tamaño: $(du -h $BACKUP_FILE | cut -f1)"

# Opcional: Mantener solo últimos 7 backups
ls -t $BACKUP_DIR/odoo-backup-*.tar.gz | tail -n +8 | xargs -r rm

echo "🗂️  Backups disponibles:"
ls -lh $BACKUP_DIR/odoo-backup-*.tar.gz