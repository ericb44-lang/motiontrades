// Swap absolute /public paths (logo, photos, favicon) for embedded data URLs so the file stands alone.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const out = "preview/dist/index.html";
let html = readFileSync(out, "utf8");
const dataUrl = (path) => {
  const type = path.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${type};base64,${readFileSync(`public${path}`).toString("base64")}`;
};
const assets = [
  "/brand/motiontrades-logo.png",
  "/brand/about-me.jpg",
  ...readdirSync("public/brand/shots").map((f) => `/brand/shots/${f}`),
];
for (const a of assets) html = html.replaceAll(a, dataUrl(a));
html = html.replace("</head>", `<link rel="icon" type="image/png" href="${dataUrl("/favicon.png")}"></head>`);
writeFileSync(out, html);
console.log(`Inlined ${assets.length} images and the favicon →`, out);
