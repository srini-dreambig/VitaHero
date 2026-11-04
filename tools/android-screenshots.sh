#!/usr/bin/env bash
# Takes the Play Store phone screenshots on a running emulator. Called by
# .github/workflows/android-screenshots.yml; needs PHONE and CODE (a Firebase
# test phone number and its fixed code) and the debug APK as $1.
#
# Play wants each side between 320 and 3840 px with the long side no more than
# twice the short one, so the screen is set to 1080x1920 rather than the
# emulator's 1080x2400.
set -euo pipefail

APK="$1"
OUT="${2:-screenshots/phone}"
PKG=kallam.healthcare
ACT="$PKG/$PKG.MainActivity"
mkdir -p "$OUT"

adb wait-for-device
adb shell wm size 1080x1920
adb shell wm density 420
adb install -r -g "$APK"
# -g grants the runtime permissions it can; notifications are asked for after
# sign-in, and a dialog over the first screenshot is no use.
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true

# A clean status bar: 9:41, full battery and signal, no notifications.
adb shell settings put global sysui_demo_allowed 1
demo() { adb shell am broadcast -a com.android.systemui.demo -e command "$@" > /dev/null; }
demo enter
demo clock -e hhmm 0941
demo battery -e level 100 -e plugged false
demo network -e wifi show -e level 4
demo network -e mobile show -e datatype none -e level 4
demo notifications -e visible false

# The CI emulator's launcher is slow enough to raise "Pixel Launcher isn't
# responding" over the app. Hide such dialogs, and dismiss any that still
# shows before each picture.
adb shell settings put global hide_error_dialogs 1
dialog_up() {
  adb shell dumpsys window | tr -d '\r' | grep -E "mCurrentFocus=.*(Application Not Responding|Application Error)" || true
}

tabs=(home kids camps rewards profile)
for i in 0 1 2 3 4; do
  adb logcat -c
  # Nothing of the launcher's is on screen in these pictures, so it can rest.
  adb shell am force-stop com.google.android.apps.nexuslauncher || true
  # The first launch signs in; the session is kept, so the others only open
  # their tab. The credentials go every time in case the first restore is slow.
  adb shell am start -S -W -n "$ACT" \
    --es vh_shot_phone "$PHONE" --es vh_shot_code "$CODE" --es vh_shot_tab "$i" > /dev/null
  if [ "$i" = 0 ]; then sleep 45; else sleep 15; fi
  # A picture of the launcher or the sign-in screen is worse than none.
  if [ -z "$(adb shell pidof "$PKG" | tr -d '\r')" ]; then
    echo "::error::VitaHero is not running (tab $i). It crashed or quit."
    adb logcat -d -s VH_SHOT:E AndroidRuntime:E | tail -60 || true
    exit 1
  fi
  for _ in 1 2 3; do
    [ -z "$(dialog_up)" ] && break
    echo "A system dialog is up (tab $i); closing it."
    adb shell input keyevent KEYCODE_BACK
    sleep 3
  done
  if [ -n "$(dialog_up)" ]; then
    echo "::error::A system dialog is still over the app (tab $i)."
    exit 1
  fi
  adb exec-out screencap -p > "$OUT/$((i + 1))-${tabs[$i]}.png"
done

demo exit
file "$OUT"/*.png
