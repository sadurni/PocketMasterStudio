# Linux BLE‑MIDI receive bridge

On Linux, browsers can **send** MIDI to the pedal over BLE‑MIDI but usually don't **receive**
the device's notifications (so the editor can't read presets / sync). This small Python bridge
(`ble_midi_bridge.py`, from [vahr76/PocketEdit](https://github.com/vahr76/PocketEdit)) fixes that:
it subscribes to the pedal's BLE characteristic via BlueZ (D‑Bus) and forwards each notification to
the editor over a local WebSocket (`ws://localhost:8765`).

The editor already knows about it: on Connect it silently tries that WebSocket
(`connectReceiveBridge()`), so **no separate Linux page is needed** — the normal
`html/PocketEdit_multi_import_export.html` works on Windows, Mac **and** Linux. If the bridge isn't
running (Windows/Mac), nothing happens and normal Web MIDI receive is used.

## Requirements

- Python 3, and: `pip install dbus-fast websockets`
  (on newer distros you may need `pip install --break-system-packages dbus-fast websockets`).
- BlueZ (standard on most Linux desktops).

## Use

1. Pair/connect the pedal at the OS level and note its BLE address:
   ```bash
   bluetoothctl connect E4:2F:84:30:B1:58        # your pedal's address
   ```
2. Start the bridge with that address:
   ```bash
   python linux/ble_midi_bridge.py --address E4:2F:84:30:B1:58
   ```
   It prints `Receive-only bridge ready on ws://localhost:8765`.
3. Open `html/PocketEdit_multi_import_export.html` in your browser and press **Connect**
   (Web MIDI). The log shows `📡 Receive bridge connected (Linux BLE-MIDI workaround active)`.

## Notes

- **Receive‑only** and bound to **localhost** — it never exposes anything to the network and
  never writes to the device (writes still go out through the browser's Web MIDI).
- It targets the pedal's characteristic `7772e5db-3868-4112-a1a9-f2669d106bf3`.
- Credit: the bridge script and the Linux approach are from vahr76's PocketEdit fork.
