#!/usr/bin/env bash

set -e

ok() { echo "ok: $1"; }
changed() { echo "changed: $1"; }
skipped() { echo "skipped: $1"; }
failed() { echo "failed: $1"; exit 1; }

run_task() {
echo ""
echo "TASK [$1]"
}

PROJECT_ROOT="$(pwd -P)"
TARGET_USER="${SUDO_USER:-$(id -un)}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

if [ -z "$TARGET_HOME" ]; then
failed "could not resolve home directory for $TARGET_USER"
fi

run_as_target_user() {
local command="$1"

if [ "$(id -un)" = "$TARGET_USER" ]; then
bash -lc "$command"
else
sudo -u "$TARGET_USER" -H bash -lc "$command"
fi
}

# update system

run_task "Update apt packages"
if sudo apt update -y > /dev/null 2>&1; then
changed "apt update"
else
failed "apt update"
fi

# install base dependencies

run_task "Install base dependencies"

PKGS=(curl git build-essential ca-certificates gnupg lsb-release unzip wget)
TO_INSTALL=()

for pkg in "${PKGS[@]}"; do
if dpkg -s "$pkg" > /dev/null 2>&1; then
ok "$pkg already installed"
else
TO_INSTALL+=("$pkg")
fi
done

if [ ${#TO_INSTALL[@]} -gt 0 ]; then
sudo apt install -y "${TO_INSTALL[@]}" > /dev/null
changed "installed: ${TO_INSTALL[*]}"
else
skipped "all base packages installed"
fi

# install nvm

run_task "Install NVM"

export NVM_DIR="$TARGET_HOME/.nvm"

if [ -d "$NVM_DIR" ]; then
ok "nvm already installed"
else
run_as_target_user 'curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash'
changed "nvm installed"
fi

source "$NVM_DIR/nvm.sh"

# install node 24

run_task "Install Node.js 24"

if run_as_target_user 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm ls 24 | grep -q "v24"'; then
ok "Node.js 24 already installed"
else
run_as_target_user 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm install 24 > /dev/null'
changed "Node.js 24 installed"
fi

run_as_target_user 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24 > /dev/null; nvm alias default 24 > /dev/null'

# enable pnpm

run_task "Enable pnpm"

if command -v pnpm > /dev/null 2>&1; then
ok "pnpm already available"
else
PNPM_VERSION="$(sed -n 's/.*"packageManager": "pnpm@\([^"]*\)".*/\1/p' "$PROJECT_ROOT/package.json" | head -n 1)"

if [ -z "$PNPM_VERSION" ]; then
failed "could not determine pnpm version"
fi

run_as_target_user "export NVM_DIR=\"\$HOME/.nvm\"; . \"\$NVM_DIR/nvm.sh\"; corepack enable; corepack install -g \"pnpm@${PNPM_VERSION}\" > /dev/null"
changed "pnpm enabled"
fi

# install pm2

run_task "Install PM2"

if command -v pm2 > /dev/null 2>&1; then
ok "pm2 already installed"
else
run_as_target_user 'export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; npm install -g pm2 > /dev/null'
changed "pm2 installed"
fi

# install chromium

run_task "Install Chromium"

if command -v chromium-browser > /dev/null 2>&1 || command -v chromium > /dev/null 2>&1; then
ok "chromium already installed"
else
CHROMIUM_PACKAGE=""

for candidate in chromium-browser chromium; do
if apt-cache show "$candidate" > /dev/null 2>&1; then
CHROMIUM_PACKAGE="$candidate"
break
fi
done

if [ -z "$CHROMIUM_PACKAGE" ]; then
failed "chromium package is not available"
fi

CHROMIUM_RUNTIME_PKGS=(
"${CHROMIUM_PACKAGE}"
ca-certificates
fonts-freefont-ttf
libnss3
libfreetype6
libharfbuzz0b
libstdc++6
)

sudo apt install -y "${CHROMIUM_RUNTIME_PKGS[@]}" > /dev/null

changed "chromium installed"
fi

# install dependencies

run_task "Install dependencies"

if [ -d "node_modules" ]; then
skipped "dependencies already installed"
else
pnpm install --frozen-lockfile > /dev/null
changed "dependencies installed"
fi

# build worker

run_task "Build worker"

if [ -d "apps/worker/dist" ]; then
skipped "worker already built"
else
pnpm turbo run build --filter=@repo/worker... > /dev/null
changed "worker built"
fi

# start worker

run_task "Start worker"

if pm2 list | grep -q "worker"; then
ok "worker already running"
else
pnpm pm2:start:worker > /dev/null
pm2 save > /dev/null
pm2 startup > /dev/null
changed "worker started"
fi

echo ""
echo "done"
