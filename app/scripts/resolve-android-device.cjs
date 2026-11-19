// Expo --device accepts a name; adb -s accepts the hardware serial.
// Use the installed CLI's own inventory so physical devices and AVD names agree.
const path = require("node:path");

function selectExpoDeviceName(devices, serial) {
  if (!Array.isArray(devices) || typeof serial !== "string" || !serial) {
    throw new Error("Invalid Android device selection.");
  }
  const selected = devices.find((device) => device.pid === serial);
  if (!selected || !selected.isAuthorized || !selected.isBooted) {
    throw new Error(
      "Selected Android device is disconnected, offline or unauthorized. Reconnect/unlock it and retry.",
    );
  }
  if (typeof selected.name !== "string" || !selected.name.trim()) {
    throw new Error("Expo could not determine the selected Android device name.");
  }
  if (devices.filter((device) => device.name === selected.name).length !== 1) {
    throw new Error(
      "Expo sees multiple devices with the same name. Disconnect the other matching device/emulator before building.",
    );
  }
  return selected.name;
}

async function resolveExpoDeviceName(serial) {
  const expoRoot = path.dirname(require.resolve("expo/package.json"));
  const cliRoot = path.dirname(require.resolve("@expo/cli/package.json", { paths: [expoRoot] }));
  const { getDevicesAsync } = require(
    path.join(cliRoot, "build/src/start/platforms/android/getDevices.js"),
  );
  return selectExpoDeviceName(await getDevicesAsync(), serial);
}

module.exports = { selectExpoDeviceName, resolveExpoDeviceName };

if (require.main === module) {
  resolveExpoDeviceName(process.argv[2])
    .then((name) => console.log(JSON.stringify({ name })))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
