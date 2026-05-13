#!/bin/bash
# SETUP VNC SERVER
sudo apt install -y xfce4 xfce4-goodies tightvncserver
vnc_password="Penapenapena1!"
mkdir -p ~/.vnc
echo "$vnc_password" | vncpasswd -f >~/.vnc/passwd
chmod 600 ~/.vnc/passwd

if [ ! -f ~/.vnc/xstartup ]; then
	cat <<EOL >~/.vnc/xstartup
#!/bin/sh

xrdb "$HOME/.Xresources"
xsetroot -solid grey
#x-terminal-emulator -geometry 80x24+10+10 -ls -title "$VNCDESKTOP Desktop" &
#x-window-manager &
# Fix to make GNOME work
export XKL_XMODMAP_DISABLE=1
/etc/X11/Xsession
startxfce4  &

EOL
	chmod +x ~/.vnc/xstartup
fi

# Start VNC Server
tightvncserver :1

# Export display port
export DISPLAY=:1.0
xhost +local:

# Setup Node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# Load NVM into the current shell session
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS and ensure npm is available
nvm install --lts
nvm use --lts

CUSTOM_TMP_DIR="/home/ubuntu/tmp"
mkdir -p "$CUSTOM_TMP_DIR"
sudo chmod 700 "$CUSTOM_TMP_DIR"
export TMPDIR="$CUSTOM_TMP_DIR"

cat /proc/sys/fs/inotify/max_user_instances
echo 256 | sudo tee /proc/sys/fs/inotify/max_user_instances

ulimit -n 1048576

echo "ubuntu            soft    nofile          1048576" | sudo tee -a /etc/security/limits.conf
echo "ubuntu            hard    nofile          1048576" | sudo tee -a /etc/security/limits.conf

echo "Using TMPDIR: $TMPDIR"

cd /home/ubuntu/scraper-service

# Install npm dependencies
npm install
npm install --save-dev @types/semver @types/tar-fs @types/unbzip2-stream @types/ws
npx playwright install-deps
npx playwright install firefox
npm install pm2 tsc -g

# Decrypt the .env file
openssl aes-256-cbc -d -in .env.enc -out .env -k "penateam1"

# Build and start the application
npm run build

pm2 start npm -- run start --
pm2 logs npm
