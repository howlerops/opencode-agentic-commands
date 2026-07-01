#!/bin/sh
set -eu

root="$(git rev-parse --show-toplevel)"
hook_dir="$root/.git/hooks"
mkdir -p "$hook_dir"
cp "$root/scripts/hooks/pre-push" "$hook_dir/pre-push"
chmod +x "$hook_dir/pre-push"
echo "Installed pre-push Pages reminder hook."
