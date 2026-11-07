// Swap absolute /public paths (logo, favicon) for embedded data URLs so the file stands alone.
import { readFileSync, writeFileSync } from "node:fs";
const out = "preview/dist/index.html";
let html = readFileSync(out, "utf8");
const logo = readFileSync("public/brand/motiontrades-logo.png").toString("base64");
const aboutMe = readFileSync("public/brand/about-me.jpg").toString("base64");
const icon = readFileSync("public/favicon.png").toString("base64");
html = html.replaceAll("/brand/motiontrades-logo.png", `data:image/png;base64,${logo}`);
html = html.replaceAll("/brand/about-me.jpg", `data:image/jpeg;base64,${aboutMe}`);
html = html.replace("</head>", `<link rel="icon" type="image/png" href="data:image/png;base64,${icon}"></head>`);
writeFileSync(out, html);
console.log("Inlined logo and favicon →", out);
