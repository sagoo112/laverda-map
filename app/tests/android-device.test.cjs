const test = require("node:test");
const assert = require("node:assert/strict");
const { selectExpoDeviceName } = require("../scripts/resolve-android-device.cjs");

const phone = {
  pid: "fixture-serial-123",
  name: "Pixel_8_Pro",
  isAuthorized: true,
  isBooted: true,
};

test("Expo receives the device name rather than the adb serial", () => {
  assert.equal(selectExpoDeviceName([phone], phone.pid), "Pixel_8_Pro");
});

test("an explicit serial selects the matching phone among multiple models", () => {
  const other = { ...phone, pid: "another-serial", name: "Pixel_9" };
  assert.equal(selectExpoDeviceName([other, phone], phone.pid), phone.name);
});

test("Expo names are preserved for physical devices and running emulators", () => {
  const emulator = { ...phone, pid: "emulator-5554", name: "Pixel_8_API_36" };
  assert.equal(selectExpoDeviceName([emulator], emulator.pid), emulator.name);
  assert.equal(
    selectExpoDeviceName([{ ...phone, name: "Name with spaces" }], phone.pid),
    "Name with spaces",
  );
});

test("a disconnected, offline or unauthorized selection cannot switch targets", () => {
  assert.throws(() => selectExpoDeviceName([], phone.pid), /disconnected/);
  for (const state of [{ isAuthorized: false }, { isBooted: false }]) {
    assert.throws(
      () => selectExpoDeviceName([{ ...phone, ...state }], phone.pid),
      /offline or unauthorized/,
    );
  }
});

test("duplicate Expo names fail instead of installing on another device", () => {
  const duplicate = { ...phone, pid: "another-phone" };
  assert.throws(
    () => selectExpoDeviceName([duplicate, phone], phone.pid),
    /multiple devices with the same name/,
  );
});

test("missing names and invalid device input are rejected", () => {
  assert.throws(() => selectExpoDeviceName(null, phone.pid), /Invalid/);
  assert.throws(() => selectExpoDeviceName([phone], ""), /Invalid/);
  assert.throws(
    () => selectExpoDeviceName([{ ...phone, name: "" }], phone.pid),
    /could not determine/,
  );
});
