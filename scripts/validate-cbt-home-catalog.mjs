import fs from "node:fs";
import { validateSnapshot } from "../lib/cbt-home-catalog-schema.mjs";
const file = new URL("../data/cbt-home-catalog.generated.json", import.meta.url);
if (!fs.existsSync(file)) throw new Error("Home catalog missing. Run npm run catalog:snapshot explicitly and commit the generated JSON.");
const catalog = validateSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
console.log(`Home catalog valid: ${catalog.releaseId}; ${catalog.qualifications.length} qualifications (local JSON only)`);
