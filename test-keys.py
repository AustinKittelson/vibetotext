#!/usr/bin/env python3
"""Test what keys pynput detects on Windows."""

import sys
print("Testing pynput key detection...")
print("Press Ctrl+Shift together, then press 'q' to quit")
print("=" * 50)

try:
    from pynput import keyboard
except ImportError:
    print("ERROR: pynput not installed!")
    sys.exit(1)

pressed_keys = set()

def on_press(key):
    try:
        # Try to get the key name
        if hasattr(key, 'char') and key.char:
            key_name = key.char.lower()
        else:
            key_name = key.name.lower() if hasattr(key, 'name') else str(key)

        if key_name not in pressed_keys:
            pressed_keys.add(key_name)
            print(f"✓ Pressed: {key_name} (currently holding: {pressed_keys})")

        # Check if ctrl+shift is pressed
        if {'ctrl', 'shift'}.issubset(pressed_keys) or {'ctrl_l', 'shift'}.issubset(pressed_keys):
            print(">>> DETECTED CTRL+SHIFT COMBO! <<<")
    except Exception as e:
        print(f"Error in on_press: {e}")

def on_release(key):
    try:
        # Try to get the key name
        if hasattr(key, 'char') and key.char:
            key_name = key.char.lower()
            if key_name == 'q':
                print("\nQuitting...")
                return False
        else:
            key_name = key.name.lower() if hasattr(key, 'name') else str(key)

        pressed_keys.discard(key_name)
        print(f"✗ Released: {key_name} (still holding: {pressed_keys})")
    except Exception as e:
        print(f"Error in on_release: {e}")

try:
    listener = keyboard.Listener(on_press=on_press, on_release=on_release)
    listener.start()
    print("Listener started successfully!")
    listener.join()
except Exception as e:
    print(f"ERROR: Failed to start listener: {e}")
    sys.exit(1)
