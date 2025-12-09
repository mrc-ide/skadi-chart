// This script will get executed when running `npm run build` because vue-tsc
// outputs a declaration file that contains `declare module "skadi-chart"`
// (based off the file name) however our package is called
// @reside-ic/skadi-chart so we need to fix the name of the declared module

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const declarationFile = join(__dirname, "..", "dist", "skadi-chart.d.ts");

const declarationFileContents = readFileSync(declarationFile, "utf-8");

const newFileContents = declarationFileContents.replace(
  `declare module "skadi-chart"`,
  `declare module "@reside-ic/skadi-chart"`
);

writeFileSync(declarationFile, newFileContents);
