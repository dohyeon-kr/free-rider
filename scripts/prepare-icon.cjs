const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const chunksDir = path.join(root, "build", "icon-source");
const sourcePath = path.join(root, "build", "icon-source.png");
const iconsetPath = path.join(root, "build", "icon.iconset");
const outputPath = path.join(root, "build", "icon.icns");
const expectedSha256 = "c5b83315df05cbf6f4565846fa2ab4a7a286b6cf7b549e97ad863761b84ceb55";

const chunks = fs.readdirSync(chunksDir)
  .filter((name) => name.endsWith(".b64"))
  .sort()
  .map((name) => fs.readFileSync(path.join(chunksDir, name), "utf8").trim());

const png = Buffer.from(chunks.join(""), "base64");
const sha256 = createHash("sha256").update(png).digest("hex");

if (sha256 !== expectedSha256) {
  throw new Error(`App icon source checksum mismatch: ${sha256}`);
}
if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
  throw new Error("App icon source is not a PNG");
}
if (process.platform !== "darwin") {
  throw new Error("macOS is required to generate build/icon.icns");
}

fs.writeFileSync(sourcePath, png);
fs.rmSync(iconsetPath, { recursive: true, force: true });
fs.rmSync(outputPath, { force: true });
fs.mkdirSync(iconsetPath, { recursive: true });

const sizes = [
  [16, "icon_16x16.png"],
  [32, "icon_16x16@2x.png"],
  [32, "icon_32x32.png"],
  [64, "icon_32x32@2x.png"],
  [128, "icon_128x128.png"],
  [256, "icon_128x128@2x.png"],
  [256, "icon_256x256.png"],
  [512, "icon_256x256@2x.png"],
  [512, "icon_512x512.png"],
  [1024, "icon_512x512@2x.png"],
];

for (const [size, filename] of sizes) {
  execFileSync("sips", ["-z", String(size), String(size), sourcePath, "--out", path.join(iconsetPath, filename)], {
    stdio: "ignore",
  });
}

execFileSync("iconutil", ["-c", "icns", iconsetPath, "-o", outputPath], { stdio: "inherit" });
fs.rmSync(iconsetPath, { recursive: true, force: true });
fs.rmSync(sourcePath, { force: true });
console.log(`Generated ${path.relative(root, outputPath)} from transparent rider artwork.`);
