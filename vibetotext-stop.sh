#!/bin/bash

# VibeToText Stream Teardown Script

echo "Stopping VibeToText..."
pkill -9 -f "vibetotext" 2>/dev/null

sleep 1

echo "VibeToText teardown complete!"
