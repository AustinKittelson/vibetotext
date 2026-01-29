#!/bin/bash

# VibeToText Stream Startup Script

BASE="/Users/dylan/Desktop/projects/vibetotext"

echo "Starting VibeToText..."
cd "$BASE" && source .venv/bin/activate && python -m vibetotext &

echo ""
echo "Waiting for VibeToText to initialize..."
sleep 3

echo "VibeToText startup complete!"
