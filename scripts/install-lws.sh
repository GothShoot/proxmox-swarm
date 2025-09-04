#!/usr/bin/env bash
set -e

# Télécharger le projet si pas déjà présent
if [ ! -d python_project ]; then
  git clone https://github.com/fabriziosalmi/lws.git lws
fi

# Installer venv + dépendances
cd lws
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
