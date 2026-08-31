#!/usr/bin/env python3
"""
BLE-MIDI Receive Bridge for Linux
Listens for BLE notifications via D-Bus and forwards to WebSocket.
The web app sends via Web MIDI (which works) and receives via this bridge.

Usage:
    1. bluetoothctl connect E4:2F:84:30:B1:58
    2. python ble_midi_bridge.py --address E4:2F:84:30:B1:58
    3. Open web app
"""

import asyncio
import json
import argparse
import sys
from dbus_fast.aio import MessageBus
from dbus_fast import BusType

try:
    import websockets
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "--break-system-packages"])
    import websockets

CHARACTERISTIC_UUID = "7772e5db-3868-4112-a1a9-f2669d106bf3"
BLUEZ_SERVICE = "org.bluez"
WS_HOST = "localhost"
WS_PORT = 8765

connected_websockets = set()
bus = None


async def broadcast(message: str):
    if connected_websockets:
        await asyncio.gather(
            *[ws.send(message) for ws in connected_websockets],
            return_exceptions=True
        )


async def find_characteristic(address: str):
    obj_manager_introspect = await bus.introspect(BLUEZ_SERVICE, '/')
    obj_manager = bus.get_proxy_object(BLUEZ_SERVICE, '/', obj_manager_introspect)
    om_iface = obj_manager.get_interface('org.freedesktop.DBus.ObjectManager')
    objects = await om_iface.call_get_managed_objects()

    device_path = None
    for path, interfaces in objects.items():
        if 'org.bluez.Device1' in interfaces:
            props = interfaces['org.bluez.Device1']
            addr = props.get('Address', {})
            addr_val = addr.value if hasattr(addr, 'value') else str(addr)
            if addr_val.upper() == address.upper():
                device_path = path
                print(f"[DBus] Device: {path}")
                break

    if not device_path:
        return None, None

    char_path = None
    for path, interfaces in objects.items():
        if 'org.bluez.GattCharacteristic1' in interfaces and path.startswith(device_path):
            props = interfaces['org.bluez.GattCharacteristic1']
            uuid = props.get('UUID', {})
            uuid_val = uuid.value if hasattr(uuid, 'value') else str(uuid)
            if uuid_val.lower() == CHARACTERISTIC_UUID.lower():
                char_path = path
                print(f"[DBus] Characteristic: {path}")
                break

    return device_path, char_path


async def ws_handler(websocket):
    connected_websockets.add(websocket)
    print(f"[WS] Client connected: {websocket.remote_address}")
    await websocket.send(json.dumps({"type": "status", "status": "connected"}))
    try:
        async for raw in websocket:
            pass  # receive-only bridge, ignore incoming messages
    except websockets.exceptions.ConnectionClosedOK:
        pass
    finally:
        connected_websockets.discard(websocket)
        print(f"[WS] Client disconnected: {websocket.remote_address}")


async def main(address: str):
    global bus

    print(f"[Bridge] Connecting to BlueZ D-Bus...")
    bus = await MessageBus(bus_type=BusType.SYSTEM).connect()

    device_path, char_path = await find_characteristic(address)
    if not char_path:
        print(f"\nERROR: Device {address} not found or not connected.")
        print(f"Run: bluetoothctl connect {address}")
        sys.exit(1)

    # Subscribe to PropertiesChanged on the characteristic
    introspect = await bus.introspect(BLUEZ_SERVICE, char_path)
    proxy = bus.get_proxy_object(BLUEZ_SERVICE, char_path, introspect)
    props_iface = proxy.get_interface('org.freedesktop.DBus.Properties')

    def on_props_changed(iface, changed, invalidated):
        if iface == 'org.bluez.GattCharacteristic1' and 'Value' in changed:
            value = changed['Value']
            # value is a Variant wrapping an array of bytes
            actual = value.value if hasattr(value, 'value') else value
            raw = bytes(b.value if hasattr(b, 'value') else int(b) for b in actual)
            hex_data = raw.hex().upper()
            print(f"  BLE → WS: {hex_data[:80]}{'...' if len(hex_data) > 80 else ''}")
            msg = json.dumps({"type": "midi_data", "data": hex_data})
            loop = asyncio.get_event_loop()
            loop.call_soon_threadsafe(lambda: asyncio.ensure_future(broadcast(msg)))

    props_iface.on_properties_changed(on_props_changed)

    # Enable notifications
    char_introspect = await bus.introspect(BLUEZ_SERVICE, char_path)
    char_proxy = bus.get_proxy_object(BLUEZ_SERVICE, char_path, char_introspect)
    char_iface = char_proxy.get_interface('org.bluez.GattCharacteristic1')
    try:
        await char_iface.call_start_notify()
        print(f"[DBus] Notifications enabled.")
    except Exception as e:
        if "Already notifying" in str(e):
            print(f"[DBus] Already notifying — OK.")
        else:
            print(f"[DBus] StartNotify error: {e}")

    print(f"\n[Bridge] Receive-only bridge ready on ws://{WS_HOST}:{WS_PORT}")
    print(f"[Bridge] Web app sends via Web MIDI, receives via this bridge.")
    print(f"[Bridge] Open your web app and press Connect.\n")

    async with websockets.serve(ws_handler, WS_HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--address", required=True)
    args = parser.parse_args()
    try:
        asyncio.run(main(args.address))
    except KeyboardInterrupt:
        print("\n[Bridge] Stopped.")
