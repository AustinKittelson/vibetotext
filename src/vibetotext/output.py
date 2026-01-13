"""Output handling - auto-paste at cursor."""

import subprocess
import time
import os
import pyperclip


def has_accessibility_permission():
    """Check if we have Accessibility permission."""
    try:
        from ApplicationServices import AXIsProcessTrusted
        trusted = AXIsProcessTrusted()
        print(f"[DEBUG] AXIsProcessTrusted() = {trusted}")
        return trusted
    except ImportError as e:
        print(f"[DEBUG] Failed to import ApplicationServices: {e}")
        return False


def request_accessibility_permission():
    """Prompt user for Accessibility permission."""
    try:
        from ApplicationServices import AXIsProcessTrustedWithOptions
        from Foundation import NSDictionary

        # This will show the system prompt
        options = NSDictionary.dictionaryWithObject_forKey_(
            True,
            "AXTrustedCheckOptionPrompt"
        )
        trusted = AXIsProcessTrustedWithOptions(options)
        print(f"[DEBUG] AXIsProcessTrustedWithOptions() = {trusted}")
        return trusted
    except Exception as e:
        print(f"[DEBUG] Failed to request permission: {e}")
        return False


def get_running_app_info():
    """Get info about current process for debugging."""
    try:
        import sys
        print(f"[DEBUG] Python executable: {sys.executable}")
        print(f"[DEBUG] PID: {os.getpid()}")
        print(f"[DEBUG] __file__: {__file__}")

        # Get the actual app that needs permission
        from AppKit import NSRunningApplication, NSWorkspace
        current_app = NSRunningApplication.currentApplication()
        print(f"[DEBUG] Bundle ID: {current_app.bundleIdentifier()}")
        print(f"[DEBUG] Localized Name: {current_app.localizedName()}")
        print(f"[DEBUG] Bundle URL: {current_app.bundleURL()}")
        print(f"[DEBUG] Executable URL: {current_app.executableURL()}")
    except Exception as e:
        print(f"[DEBUG] Failed to get app info: {e}")


def simulate_paste():
    """Simulate Cmd+V using CGEventPost (fast, native)."""
    try:
        from Quartz import (
            CGEventCreateKeyboardEvent,
            CGEventPost,
            kCGHIDEventTap,
            CGEventSetFlags,
            kCGEventFlagMaskCommand,
        )

        print("[DEBUG] Using CGEventPost to paste...")

        # Key code for 'v' is 9
        v_keycode = 9

        # Create key down event with Command modifier
        key_down = CGEventCreateKeyboardEvent(None, v_keycode, True)
        CGEventSetFlags(key_down, kCGEventFlagMaskCommand)

        # Create key up event with Command modifier
        key_up = CGEventCreateKeyboardEvent(None, v_keycode, False)
        CGEventSetFlags(key_up, kCGEventFlagMaskCommand)

        # Post events
        CGEventPost(kCGHIDEventTap, key_down)
        CGEventPost(kCGHIDEventTap, key_up)

        print("[DEBUG] CGEventPost paste successful")
        return True
    except Exception as e:
        print(f"[DEBUG] CGEventPost failed: {e}, falling back to AppleScript")
        # Fallback to AppleScript
        try:
            result = subprocess.run(
                ['osascript', '-e', 'tell application "System Events" to keystroke "v" using command down'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except Exception as e2:
            print(f"[DEBUG] AppleScript fallback also failed: {e2}")
            return False


def paste_at_cursor(text: str):
    """
    Copy text to clipboard and auto-paste at cursor.
    Falls back to clipboard-only if no Accessibility permission.
    """
    # Copy to clipboard first
    pyperclip.copy(text)
    print(f"[DEBUG] Copied {len(text)} chars to clipboard")

    # Debug: show what app we are
    get_running_app_info()

    # Check permission
    if has_accessibility_permission():
        print("[DEBUG] Have accessibility permission, attempting auto-paste...")
        time.sleep(0.1)  # Wait for hotkey modifiers to be fully released

        if simulate_paste():
            print("[DEBUG] Auto-paste attempted")
            return
        else:
            print("[DEBUG] Auto-paste failed, falling back to sound")
    else:
        print("[DEBUG] No accessibility permission")
        # Try to request it (shows system dialog)
        request_accessibility_permission()

    # Fallback: play sound to signal manual paste needed
    print("[DEBUG] Playing sound for manual paste")
    subprocess.run(["afplay", "/System/Library/Sounds/Pop.aiff"], check=False)
