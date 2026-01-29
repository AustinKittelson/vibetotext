#!/usr/bin/env python3
"""Standalone UI process for the floating waveform indicator."""

import json
import os
import sys

# PyObjC imports
from AppKit import (
    NSApplication, NSApp, NSPanel, NSView, NSColor, NSBezierPath,
    NSBackingStoreBuffered, NSMakeRect, NSFloatingWindowLevel,
    NSWindowStyleMaskBorderless, NSWindowCollectionBehaviorCanJoinAllSpaces,
    NSWindowCollectionBehaviorStationary, NSTimer, NSRunLoop,
    NSDefaultRunLoopMode
)
from Foundation import NSObject
from Quartz import kCGMaximumWindowLevelKey, CGWindowLevelForKey
import objc

IPC_FILE = sys.argv[1] if len(sys.argv) > 1 else "/tmp/vibetotext_ui_ipc.json"


class WaveformView(NSView):
    """Custom view that draws the waveform."""

    def initWithFrame_(self, frame):
        self = objc.super(WaveformView, self).initWithFrame_(frame)
        if self:
            self.levels = [0.0] * 25  # 25 bars
            self.recording = False
        return self

    def setLevels_recording_(self, levels, recording):
        self.levels = list(levels)  # Make a copy
        self.recording = recording
        self.setNeedsDisplay_(True)

    def drawRect_(self, rect):
        # Draw rounded background
        NSColor.colorWithCalibratedRed_green_blue_alpha_(0.1, 0.1, 0.1, 0.95).set()
        corner_radius = min(4, rect.size.height / 5)
        path = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(rect, corner_radius, corner_radius)
        path.fill()

        width = rect.size.width
        height = rect.size.height
        num_bars = 25
        # Scale bars to fill ~90% of container width
        padding = width * 0.05  # 5% padding on each side
        usable_width = width - (padding * 2)
        # Calculate bar width and spacing to fill the usable width
        bar_spacing = usable_width * 0.02  # 2% of usable width for spacing
        total_spacing = bar_spacing * (num_bars - 1)
        bar_width = (usable_width - total_spacing) / num_bars
        start_x = padding
        center_y = height / 2

        if self.recording:
            # Pink color for recording
            NSColor.colorWithCalibratedRed_green_blue_alpha_(1.0, 0.4, 0.6, 1.0).set()
            for i in range(num_bars):
                level = self.levels[i] if i < len(self.levels) else 0.0
                x = start_x + i * (bar_width + bar_spacing)
                # Bar height based on level - scaled to show waveform detail without clipping
                min_height = max(2, height * 0.1)
                bar_height = max(min_height, level * height * 0.35)
                bar_height = min(bar_height, height * 0.85)
                y = center_y - bar_height / 2
                bar_path = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
                    NSMakeRect(x, y, bar_width, bar_height), 1, 1
                )
                bar_path.fill()
        else:
            # Gray color for idle - flat line
            NSColor.colorWithCalibratedRed_green_blue_alpha_(0.35, 0.35, 0.35, 1.0).set()
            min_height = max(2, height * 0.1)
            for i in range(num_bars):
                x = start_x + i * (bar_width + bar_spacing)
                bar_path = NSBezierPath.bezierPathWithRoundedRect_xRadius_yRadius_(
                    NSMakeRect(x, center_y - min_height / 2, bar_width, min_height), 1, 1
                )
                bar_path.fill()


class AppDelegate(NSObject):
    def init(self):
        self = objc.super(AppDelegate, self).init()
        if self:
            self.levels = [0.0] * 25  # Match WaveformView
            self.recording = False
            self.last_mtime = 0
            self.panel = None
            self.waveform_view = None
            # Animation state
            self.base_width = 140
            self.base_height = 20
            self.current_scale = 1.0
            self.target_scale = 1.0
            self.scale_velocity = 0.0
            # Position anchors (right edge x, bottom y in screen coords)
            self.anchor_right = 0
            self.anchor_bottom = 0
        return self

    def applicationDidFinishLaunching_(self, notification):
        # Create floating panel
        width = 140
        height = 20

        self.panel = NSPanel.alloc().initWithContentRect_styleMask_backing_defer_(
            NSMakeRect(100, 100, width, height),
            NSWindowStyleMaskBorderless,
            NSBackingStoreBuffered,
            False
        )

        # Set as floating panel - VERY HIGH level
        self.panel.setLevel_(CGWindowLevelForKey(kCGMaximumWindowLevelKey))
        self.panel.setFloatingPanel_(True)
        self.panel.setHidesOnDeactivate_(False)
        self.panel.setCanHide_(False)

        # Visible on all spaces, stationary (not affected by Expose)
        self.panel.setCollectionBehavior_(
            NSWindowCollectionBehaviorCanJoinAllSpaces |
            NSWindowCollectionBehaviorStationary
        )

        # Transparent background, non-opaque
        self.panel.setOpaque_(False)
        self.panel.setBackgroundColor_(NSColor.clearColor())

        # Create waveform view
        self.waveform_view = WaveformView.alloc().initWithFrame_(
            NSMakeRect(0, 0, width, height)
        )
        self.panel.setContentView_(self.waveform_view)

        # Show the panel
        self.panel.orderFrontRegardless()

        # Start update timer
        self.timer = NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            0.033,  # ~30fps
            self,
            "update:",
            None,
            True
        )

    def update_(self, timer):
        # Read IPC file every tick (don't rely on mtime which has low resolution)
        try:
            if os.path.exists(IPC_FILE):
                with open(IPC_FILE, "r") as f:
                    data = json.load(f)

                if data.get("stop"):
                    NSApp.terminate_(None)
                    return

                was_recording = self.recording
                self.recording = data.get("recording", False)

                # Position when recording starts
                if self.recording and not was_recording:
                    screen_x = data.get("screen_x", 0)
                    screen_y = data.get("screen_y", 0)
                    screen_w = data.get("screen_w", 1920)
                    # Reset scale for new recording
                    self.current_scale = 1.0
                    self.target_scale = 1.0
                    self.scale_velocity = 0.0
                    width = self.base_width
                    height = self.base_height
                    # Position with right edge at 74% of screen width
                    right_edge_x = screen_x + int(screen_w * 0.74)
                    new_x = right_edge_x - width
                    # Position 20px from bottom of screen
                    new_y = screen_y + 20
                    # Store anchors for animation (right edge and bottom stay fixed)
                    self.anchor_right = right_edge_x
                    self.anchor_bottom = new_y

                    # Position and bring to front
                    self.panel.setFrame_display_(
                        NSMakeRect(new_x, new_y, width, height), True
                    )
                    self.panel.orderFrontRegardless()

                # Update frequency band levels - use directly for responsiveness
                if "levels" in data and self.recording:
                    self.levels = list(data["levels"])
                elif not self.recording:
                    self.levels = [0.0] * 25

                # Animate window size based on recording state (hotkey press/release)
                if self.recording:
                    # Grow when recording (hotkey held)
                    self.target_scale = 3.0
                else:
                    # Shrink when not recording (hotkey released)
                    self.target_scale = 1.0

                # Always animate (even when not recording, to shrink back)
                if True:

                    # Smooth animation with spring-like physics
                    scale_diff = self.target_scale - self.current_scale

                    # Spring constants for smooth easing
                    if abs(scale_diff) > 0.01:
                        # Acceleration towards target with damping
                        spring_strength = 0.15  # How fast it accelerates
                        damping = 0.7  # How much velocity is preserved

                        self.scale_velocity = self.scale_velocity * damping + scale_diff * spring_strength
                        self.current_scale += self.scale_velocity

                        # Clamp to valid range
                        self.current_scale = max(1.0, min(3.0, self.current_scale))

                        # Update window frame - grow left and up from anchored right/bottom
                        new_width = int(self.base_width * self.current_scale)
                        new_height = int(self.base_height * self.current_scale)
                        new_x = self.anchor_right - new_width
                        new_y = self.anchor_bottom  # Bottom stays fixed in macOS coords

                        self.panel.setFrame_display_(
                            NSMakeRect(new_x, new_y, new_width, new_height), True
                        )
                        self.waveform_view.setFrame_(NSMakeRect(0, 0, new_width, new_height))
                    elif abs(scale_diff) <= 0.01 and abs(self.scale_velocity) > 0.001:
                        # Settle at target
                        self.scale_velocity *= 0.5
                        if abs(self.scale_velocity) < 0.001:
                            self.scale_velocity = 0
                            self.current_scale = self.target_scale

                # Update view
                self.waveform_view.setLevels_recording_(list(self.levels), self.recording)
        except Exception as e:
            pass


def main():
    app = NSApplication.sharedApplication()
    delegate = AppDelegate.alloc().init()
    app.setDelegate_(delegate)
    app.setActivationPolicy_(2)  # NSApplicationActivationPolicyAccessory - no dock icon
    app.run()


if __name__ == "__main__":
    main()
