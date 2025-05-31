#!/bin/sh
# Installs Python dependencies for the project

if command -v pip3 >/dev/null 2>&1; then
  PIP_CMD=pip3
elif command -v pip >/dev/null 2>&1; then
  PIP_CMD=pip
else
  echo "Error: pip or pip3 is not installed."
  exit 1
fi

$PIP_CMD install -r requirements.txt