import fs from "node:fs";

const contract = JSON.parse(
  fs.readFileSync(new URL("../config/order-state.json", import.meta.url), "utf8")
);

function validateMachine(name, machine) {
  const states = new Set(machine.states);

  if (!states.has(machine.initial)) {
    throw new Error(`${name}: initial state is not declared`);
  }

  for (const terminal of machine.terminal) {
    if (!states.has(terminal)) {
      throw new Error(`${name}: unknown terminal state ${terminal}`);
    }
  }

  for (const state of machine.states) {
    const targets = machine.transitions[state];
    if (!Array.isArray(targets)) {
      throw new Error(`${name}: transition list missing for ${state}`);
    }

    if (targets.includes(state)) {
      throw new Error(`${name}: self transitions must be treated as idempotent no-ops, not explicit edges (${state})`);
    }

    for (const target of targets) {
      if (!states.has(target)) {
        throw new Error(`${name}: ${state} points to unknown state ${target}`);
      }
    }
  }

  for (const terminal of machine.terminal) {
    if (machine.transitions[terminal].length !== 0) {
      throw new Error(`${name}: terminal state ${terminal} has outgoing transitions`);
    }
  }
}

validateMachine("order", contract.order);
validateMachine("fulfillment", contract.fulfillment);

const order = contract.order.transitions;
const fulfillment = contract.fulfillment.transitions;

const requiredOrderEdges = [
  ["pending", "payment_pending"],
  ["payment_pending", "paid"],
  ["payment_pending", "failed"],
  ["failed", "payment_pending"],
  ["paid", "refunded"]
];

for (const [from, to] of requiredOrderEdges) {
  if (!order[from].includes(to)) {
    throw new Error(`order: required transition missing: ${from} -> ${to}`);
  }
}

const requiredFulfillmentEdges = [
  ["not_started", "queued"],
  ["queued", "issuing"],
  ["issuing", "ready"],
  ["issuing", "failed"],
  ["failed", "queued"],
  ["ready", "revoked"]
];

for (const [from, to] of requiredFulfillmentEdges) {
  if (!fulfillment[from].includes(to)) {
    throw new Error(
      `fulfillment: required transition missing: ${from} -> ${to}`
    );
  }
}

if (order.paid.includes("cancelled")) {
  throw new Error("order: a paid order must be refunded, not cancelled");
}

console.log("PASSMATE order state contract OK");
