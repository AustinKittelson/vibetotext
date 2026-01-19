"""Output handling - auto-paste at cursor."""

import subprocess
import time
import os
import platform
import tempfile
import pyperclip

SYSTEM = platform.system()
LOG_FILE = os.path.join(tempfile.gettempdir(), "vibetotext_output_debug.log")


def log_debug(msg: str):
    """Write debug message to log file."""
    try:
        with open(LOG_FILE, "a") as f:
            f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
        print(f"[DEBUG] {msg}")
    except Exception:
        print(f"[DEBUG] {msg}")


def has_accessibility_permission():
    """Check if we have Accessibility permission."""
    try:
        from ApplicationServices import AXIsProcessTrusted
        trusted = AXIsProcessTrusted()
        log_debug(f"AXIsProcessTrusted() = {trusted}")
        return trusted
    except ImportError as e:
        log_debug(f"Failed to import ApplicationServices: {e}")
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
        log_debug(f"AXIsProcessTrustedWithOptions() = {trusted}")
        return trusted
    except Exception as e:
        log_debug(f"Failed to request permission: {e}")
        return False


def get_running_app_info():
    """Get info about current process for debugging."""
    try:
        import sys
        log_debug(f"Python executable: {sys.executable}")
        log_debug(f"PID: {os.getpid()}")
        log_debug(f"__file__: {__file__}")

        # Get the actual app that needs permission
        from AppKit import NSRunningApplication, NSWorkspace
        current_app = NSRunningApplication.currentApplication()
        log_debug(f"Bundle ID: {current_app.bundleIdentifier()}")
        log_debug(f"Localized Name: {current_app.localizedName()}")
        log_debug(f"Bundle URL: {current_app.bundleURL()}")
        log_debug(f"Executable URL: {current_app.executableURL()}")
    except Exception as e:
        log_debug(f"Failed to get app info: {e}")


def simulate_paste_windows():
    """Simulate Ctrl+V on Windows using pynput."""
    try:
        from pynput.keyboard import Controller, Key

        log_debug(" Using pynput to paste on Windows...")
        keyboard = Controller()

        # Small delay to ensure any held keys are released
        time.sleep(0.05)

        # Press Ctrl+V
        keyboard.press(Key.ctrl)
        keyboard.press('v')
        keyboard.release('v')
        keyboard.release(Key.ctrl)

        log_debug(" pynput paste successful")
        return True
    except Exception as e:
        log_debug(f" pynput paste failed: {e}")
        return False


def simulate_paste_macos():
    """Simulate Cmd+V on macOS using CGEventPost (fast, native)."""
    try:
        from Quartz import (
            CGEventCreateKeyboardEvent,
            CGEventPost,
            kCGHIDEventTap,
            CGEventSetFlags,
            kCGEventFlagMaskCommand,
        )

        log_debug(" Using CGEventPost to paste...")

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

        log_debug(" CGEventPost paste successful")
        return True
    except Exception as e:
        log_debug(f" CGEventPost failed: {e}, falling back to AppleScript")
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
            log_debug(f" AppleScript fallback also failed: {e2}")
            return False


def simulate_paste():
    """Simulate paste keystroke (Cmd+V on macOS, Ctrl+V on Windows)."""
    if SYSTEM == 'Windows':
        return simulate_paste_windows()
    elif SYSTEM == 'Darwin':
        return simulate_paste_macos()
    else:
        # Linux - try pynput
        return simulate_paste_windows()  # pynput works on Linux too


def play_notification_sound():
    """Play a notification sound to signal manual paste needed."""
    if SYSTEM == 'Darwin':
        subprocess.run(["afplay", "/System/Library/Sounds/Pop.aiff"], check=False)
    elif SYSTEM == 'Windows':
        try:
            import winsound
            winsound.MessageBeep(winsound.MB_OK)
        except Exception:
            pass  # Silently fail if winsound not available
    else:
        # Linux - try paplay or aplay
        try:
            subprocess.run(["paplay", "/usr/share/sounds/freedesktop/stereo/complete.oga"],
                         check=False, capture_output=True)
        except Exception:
            pass


def paste_at_cursor(text: str):
    """
    Copy text to clipboard and auto-paste at cursor.
    Falls back to clipboard-only if no Accessibility permission (macOS).
    """
    # Copy to clipboard first
    pyperclip.copy(text)
    log_debug(f" Copied {len(text)} chars to clipboard")

    if SYSTEM == 'Windows':
        # Windows doesn't need special permission checks
        log_debug(" Windows detected, attempting auto-paste...")
        time.sleep(0.1)  # Wait for hotkey modifiers to be fully released

        if simulate_paste():
            log_debug(" Auto-paste successful")
            return
        else:
            log_debug(" Auto-paste failed, text is in clipboard")
            play_notification_sound()

    elif SYSTEM == 'Darwin':
        # macOS needs Accessibility permission
        # Debug: show what app we are
        get_running_app_info()

        # Check permission
        if has_accessibility_permission():
            log_debug(" Have accessibility permission, attempting auto-paste...")
            time.sleep(0.1)  # Wait for hotkey modifiers to be fully released

            if simulate_paste():
                log_debug(" Auto-paste attempted")
                return
            else:
                log_debug(" Auto-paste failed, falling back to sound")
        else:
            log_debug(" No accessibility permission")
            # Try to request it (shows system dialog)
            request_accessibility_permission()

        # Fallback: play sound to signal manual paste needed
        log_debug(" Playing sound for manual paste")
        play_notification_sound()

    else:
        # Linux or other - try pynput approach
        log_debug(f" {SYSTEM} detected, attempting auto-paste...")
        time.sleep(0.1)

        if simulate_paste():
            log_debug(" Auto-paste successful")
            return
        else:
            log_debug(" Auto-paste failed, text is in clipboard")
            play_notification_sound()
