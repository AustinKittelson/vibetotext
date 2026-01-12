# Auto-Paste on macOS - Implementation Plan

## Problem Statement

After transcription completes, we want to automatically paste the text at the user's cursor position without requiring them to press Cmd+V manually. macOS security makes this challenging, but apps like Wispr Flow, Raycast, and TextExpander have solved it.

---

## Current Implementation

```python
# output.py - just copies to clipboard
pyperclip.copy(text)
subprocess.run(["afplay", "/System/Library/Sounds/Pop.aiff"])  # Sound notification
```

User must manually Cmd+V to paste.

---

## Approaches (Ranked by Likelihood of Success)

### Approach 1: PyObjC CGEventPost (Most Promising)

**How it works:** Use Quartz CGEventPost to simulate Cmd+V keypress at the system level.

**Why it should work:** This is how most successful apps do it. Requires Accessibility permission but once granted, works universally.

**Implementation:**
```python
from Quartz import (
    CGEventCreateKeyboardEvent,
    CGEventPost,
    kCGHIDEventTap,
    CGEventSetFlags,
    kCGEventFlagMaskCommand
)
import time

def paste_at_cursor(text: str):
    import pyperclip
    pyperclip.copy(text)

    time.sleep(0.05)  # Small delay for clipboard to sync

    # Key code for 'V' is 9
    V_KEY = 9

    # Create key down event
    event_down = CGEventCreateKeyboardEvent(None, V_KEY, True)
    CGEventSetFlags(event_down, kCGEventFlagMaskCommand)

    # Create key up event
    event_up = CGEventCreateKeyboardEvent(None, V_KEY, False)
    CGEventSetFlags(event_up, kCGEventFlagMaskCommand)

    # Post events
    CGEventPost(kCGHIDEventTap, event_down)
    CGEventPost(kCGHIDEventTap, event_up)
```

**Requirements:**
- System Preferences > Security & Privacy > Privacy > Accessibility
- App must be added to allowed list
- For dev: Terminal.app needs Accessibility permission

**Pros:**
- Works in any application
- Native macOS API
- Fast and reliable once permissions granted

**Cons:**
- Requires user to grant Accessibility permission
- Permission prompt can be confusing for users

---

### Approach 2: AppleScript via osascript

**How it works:** Use AppleScript to tell System Events to keystroke Cmd+V.

**Implementation:**
```python
import subprocess

def paste_at_cursor(text: str):
    import pyperclip
    pyperclip.copy(text)

    script = '''
    tell application "System Events"
        keystroke "v" using command down
    end tell
    '''
    subprocess.run(["osascript", "-e", script], check=False)
```

**Requirements:**
- System Preferences > Security & Privacy > Privacy > Automation
- Terminal (or app) needs permission to control System Events

**Pros:**
- Simple implementation
- Well-documented

**Cons:**
- Requires Automation permission (separate from Accessibility)
- Can be slower than CGEventPost
- Some apps block AppleScript control

---

### Approach 3: PyAutoGUI

**How it works:** Cross-platform library that wraps native APIs.

**Implementation:**
```python
import pyautogui
import pyperclip

def paste_at_cursor(text: str):
    pyperclip.copy(text)
    pyautogui.hotkey('command', 'v')
```

**Requirements:**
- `pip install pyautogui`
- Accessibility permission (uses CGEventPost under the hood on macOS)

**Pros:**
- Simple API
- Cross-platform if needed later

**Cons:**
- Extra dependency
- Just a wrapper around CGEventPost anyway

---

### Approach 4: pynput Keyboard Controller

**How it works:** Use pynput (already a dependency) to simulate keypress.

**Implementation:**
```python
from pynput.keyboard import Key, Controller
import pyperclip

def paste_at_cursor(text: str):
    pyperclip.copy(text)

    keyboard = Controller()
    keyboard.press(Key.cmd)
    keyboard.press('v')
    keyboard.release('v')
    keyboard.release(Key.cmd)
```

**Requirements:**
- Already have pynput installed
- Accessibility permission

**Pros:**
- No new dependencies
- Already using pynput for hotkey detection

**Cons:**
- Still needs Accessibility permission
- May have timing issues

---

### Approach 5: Accessibility API (AXUIElement) - Direct Text Insertion

**How it works:** Use Accessibility API to find focused text field and insert text directly.

**Implementation:**
```python
from ApplicationServices import (
    AXUIElementCreateSystemWide,
    AXUIElementCopyAttributeValue,
    AXUIElementSetAttributeValue
)
from Quartz import kAXFocusedUIElementAttribute, kAXValueAttribute

def paste_at_cursor(text: str):
    system_wide = AXUIElementCreateSystemWide()

    # Get focused element
    err, focused = AXUIElementCopyAttributeValue(
        system_wide,
        kAXFocusedUIElementAttribute,
        None
    )

    if err == 0 and focused:
        # Get current value
        err, current_value = AXUIElementCopyAttributeValue(
            focused,
            kAXValueAttribute,
            None
        )

        # Set new value (append text)
        if current_value:
            new_value = current_value + text
        else:
            new_value = text

        AXUIElementSetAttributeValue(focused, kAXValueAttribute, new_value)
```

**Requirements:**
- Accessibility permission
- Target app must support AX API

**Pros:**
- Doesn't simulate keypresses
- Can insert at specific positions

**Cons:**
- Complex implementation
- Not all apps support it (Electron apps often don't)
- Doesn't work with non-text-field targets

---

## Recommended Implementation Order

1. **Try Approach 1 (CGEventPost) first** - Most reliable, same as professional apps
2. **Fall back to Approach 4 (pynput)** - Already have the dependency
3. **Fall back to current behavior** - Just copy to clipboard + sound

---

## Permission Handling

### Checking if permission is granted:
```python
from ApplicationServices import AXIsProcessTrusted

def has_accessibility_permission():
    return AXIsProcessTrusted()
```

### Prompting for permission:
```python
from ApplicationServices import AXIsProcessTrustedWithOptions
from Foundation import NSDictionary

def request_accessibility_permission():
    options = NSDictionary.dictionaryWithObject_forKey_(
        True,
        "AXTrustedCheckOptionPrompt"
    )
    return AXIsProcessTrustedWithOptions(options)
```

---

## Implementation Plan

### Phase 1: CGEventPost Implementation

**File:** `output.py`

```python
"""Output handling - auto-paste at cursor."""

import subprocess
import time
import pyperclip

def has_accessibility_permission():
    """Check if we have Accessibility permission."""
    try:
        from ApplicationServices import AXIsProcessTrusted
        return AXIsProcessTrusted()
    except ImportError:
        return False

def simulate_paste():
    """Simulate Cmd+V using CGEventPost."""
    from Quartz import (
        CGEventCreateKeyboardEvent,
        CGEventPost,
        kCGHIDEventTap,
        CGEventSetFlags,
        kCGEventFlagMaskCommand
    )

    V_KEY = 9  # Virtual key code for 'V'

    # Key down with Command
    event_down = CGEventCreateKeyboardEvent(None, V_KEY, True)
    CGEventSetFlags(event_down, kCGEventFlagMaskCommand)

    # Key up
    event_up = CGEventCreateKeyboardEvent(None, V_KEY, False)
    CGEventSetFlags(event_up, kCGEventFlagMaskCommand)

    # Post events
    CGEventPost(kCGHIDEventTap, event_down)
    time.sleep(0.01)
    CGEventPost(kCGHIDEventTap, event_up)

def paste_at_cursor(text: str):
    """
    Copy text to clipboard and auto-paste at cursor.
    Falls back to clipboard-only if no Accessibility permission.
    """
    pyperclip.copy(text)

    if has_accessibility_permission():
        time.sleep(0.05)  # Let clipboard sync
        simulate_paste()
    else:
        # No permission - play sound to signal manual paste needed
        subprocess.run(["afplay", "/System/Library/Sounds/Pop.aiff"], check=False)
```

### Phase 2: Permission Request on First Run

Add to `cli.py` startup:

```python
def check_permissions():
    """Check and request necessary permissions on first run."""
    from vibetotext.output import has_accessibility_permission

    if not has_accessibility_permission():
        print("Note: Grant Accessibility permission for auto-paste.")
        print("System Preferences > Security & Privacy > Privacy > Accessibility")
        print("Add Terminal (or this app) to the list.")
        print("Without it, you'll need to Cmd+V manually after transcription.\n")
```

---

## Testing

1. Run without Accessibility permission - should copy + play sound
2. Grant Accessibility permission to Terminal
3. Run again - should auto-paste
4. Test in various apps: VS Code, Chrome, Notes, Terminal

---

## Known Issues to Handle

1. **Timing**: Some apps need longer delay between clipboard copy and paste
2. **Focus**: If app loses focus during transcription, paste goes to wrong place
3. **Electron apps**: May need extra delay due to IPC
4. **Protected fields**: Password fields may block paste

---

## Apps That Successfully Auto-Paste (for reference)

- **Wispr Flow** - Uses CGEventPost, requests Accessibility on first run
- **Raycast** - Same approach
- **TextExpander** - Uses Accessibility API
- **Alfred** - AppleScript + CGEventPost hybrid
- **Keyboard Maestro** - Low-level event injection

All require Accessibility permission. This is the standard approach.
