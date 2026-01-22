
#!/bin/bash

if [ -z "$1" ]; then
    echo "Uso: ./restore-odoo.sh odoo-backup-20260121_153045.tar.gz"
    exit 1
fi

BACKUP_FILE="$HOME/odoo-backups/$1"

echo "⚠️  ADVERTENCIA: Esto sobrescribirá los datos actuales"
read -p "¿Continuar? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelado"
    exit 0
fi

# Detener contenedores
echo "🛑 Deteniendo contenedores..."
docker stop odoo-web-1 odoo-db-1

# Restaurar volúmenes
echo "📥 Restaurando backup..."
docker run --rm \
  -v odoo_db-data:/db-data \
  -v odoo_odoo-data:/odoo-data \
  -v $HOME/odoo-backups:/backup \
  ubuntu bash -c "cd / && tar xzf /backup/$1"

# Reiniciar contenedores
echo "▶️  Reiniciando contenedores..."
docker start odoo-db-1 odoo-web-1

echo "✅ Restauración completada"