#!/usr/bin/env bash
# Instala o ecossistema acadêmico Obsidian + Coado/Trilha + Tinteiro + Widget DMS/Niri.
# Uso:
#   ./install.sh [CAMINHO_DA_VAULT]
# Se CAMINHO_DA_VAULT não for informado, cria ~/Documentos/Obsidian_Vaults/vault-academica
# com o template completo (System/Academico, Datacore, TaskNotes, Templater e Tinteiro).

set -euo pipefail

REPO="$(cd "$(dirname "$0")" && pwd)"
VAULT_DEST="${1:-$HOME/Documentos/Obsidian_Vaults/vault-academica}"
DMS_PLUGINS="$HOME/.config/DankMaterialShell/plugins"
NIRI_DMS="$HOME/.config/niri/dms"

echo "==> 1. Instalando/atualizando a Vault Acadêmica em: $VAULT_DEST"
mkdir -p "$VAULT_DEST"
cp -rn "$REPO/vault-template/." "$VAULT_DEST/"
cp -rf "$REPO/vault-template/System/Scripts/." "$VAULT_DEST/System/Scripts/"
cp -rf "$REPO/vault-template/System/Templates/." "$VAULT_DEST/System/Templates/"
cp -rf "$REPO/vault-template/System/Dashboards/." "$VAULT_DEST/System/Dashboards/"
cp -rf "$REPO/vault-template/.obsidian/plugins/tinteiro" "$VAULT_DEST/.obsidian/plugins/"

echo "==> 2. Instalando o plugin Desktop DMS (vaultAcademico)"
mkdir -p "$DMS_PLUGINS"
ln -sfn "$REPO/dms-plugin/vaultAcademico" "$DMS_PLUGINS/vaultAcademico"

if [ -d "$NIRI_DMS" ]; then
    ln -sfn "$REPO/niri/vault-academico.kdl" "$NIRI_DMS/vault-academico.kdl"
    echo "==> Regra Liquid Glass do Niri vinculada em $NIRI_DMS/vault-academico.kdl"
fi

echo "==> 3. Instalando a ponte bidirecional Coado/Trilha <-> Vault"
mkdir -p "$HOME/.local/bin"
ln -sfn "$REPO/bridge/coado_ponte.py" "$HOME/.local/bin/coado-ponte"
chmod +x "$REPO/bridge/coado_ponte.py"

echo ""
echo "Concluído!"
echo "  • Vault pronta para abrir no Obsidian: $VAULT_DEST"
echo "  • Widget DMS instalado em: $DMS_PLUGINS/vaultAcademico"
echo "  • Para subir o servidor Trilha/Coado (opcional): cd $REPO/trilha && docker compose up -d"
