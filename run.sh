#!/bin/bash

# Function to kill browsers based on the platform
kill_browsers() {
	echo "Checking for open browser processes..."

	case "$(uname -s)" in
	Linux*)
		echo "Killing browser processes on Linux..."
		pkill -i chrome
		pkill -i brave
		pkill -i opera
		pkill -i firefox
		;;
	Darwin*)
		echo "Killing browser processes on macOS..."
		pkill -i "chromium"
		pkill -i "brave"
		pkill -i "opera"
		pkill -i "firefox"
		;;
	CYGWIN* | MINGW* | MSYS*)
		echo "Killing browser processes on Windows..."
		taskkill /F /IM chrome.exe /T
		taskkill /F /IM brave.exe /T
		taskkill /F /IM opera.exe /T
		taskkill /F /IM firefox.exe /T
		;;
	*)
		echo "Unsupported platform!"
		exit 1
		;;
	esac
}

# Compile TypeScript and run the resulting JavaScript
run_script() {
	echo "Compiling TypeScript and running the script..."
	npx tsc && node dist/index.js

	if [ $? -ne 0 ]; then
		echo "Failed to compile or run the script."
		exit 1
	fi
}

# Main script execution
kill_browsers
run_script
