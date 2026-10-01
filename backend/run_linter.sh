#!/bin/sh

set -e  # Exit immediately if a command exits with a non-zero status.

echo "Running linter..."

flake8 --statistics --show-source

echo "Running linter... ✅"
