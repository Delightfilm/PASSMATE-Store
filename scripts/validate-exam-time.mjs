import assert from "node:assert/strict";
import { timeLeftSeconds } from "../lib/exam-time.ts";

const endAt = "2026-10-01T00:01:00.000Z";
assert.equal(timeLeftSeconds(endAt, Date.parse(endAt) - 1), 1);
assert.equal(timeLeftSeconds(endAt, Date.parse(endAt)), 0);
assert.equal(timeLeftSeconds(endAt, Date.parse(endAt) + 1), 0);
assert.equal(timeLeftSeconds(null), null);
assert.equal(timeLeftSeconds("invalid date"), 0);
console.log("exam timer boundary checks passed");
