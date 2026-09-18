const test = require("node:test");
const assert = require("node:assert/strict");

test("Ride stores multiple ordered scenarios and allows duplicate endpoints", async () => {
  const {
    rides,
    activeRide,
    createRide,
    insertRideStep,
    moveRideStep,
    removeRideStep,
    executionSteps,
  } = await import("../src/ui/run-plan.mjs");

  const col = {
    requests: [
      { id: "login", type: "http", url: "/login" },
      { id: "me", type: "http", url: "/me" },
    ],
  };

  const first = activeRide(col);
  insertRideStep(col, first.id, "login");
  const firstMe = insertRideStep(col, first.id, "me");
  insertRideStep(col, first.id, "me");

  assert.deepEqual(
    executionSteps(col).map(({ request }) => request.id),
    ["login", "me", "me"],
  );

  moveRideStep(col, first.id, firstMe.id, -1);
  assert.deepEqual(
    executionSteps(col).map(({ request }) => request.id),
    ["me", "login", "me"],
  );

  const second = createRide(col, "Create and verify");
  insertRideStep(col, second.id, "login");
  assert.equal(rides(col).length, 2);
  assert.equal(activeRide(col).name, "Create and verify");

  removeRideStep(col, second.id, second.steps[0].id);
  assert.equal(executionSteps(col).length, 0);
});

test("legacy runPlan migrates enabled HTTP requests into the first Ride", async () => {
  const { rides, executionSteps } = await import("../src/ui/run-plan.mjs");
  const col = {
    requests: [
      { id: "a", type: "http", url: "/a" },
      { id: "b", type: "http", url: "/b" },
      { id: "ws", type: "websocket", url: "ws://localhost" },
    ],
    runPlan: [
      { id: "a", enabled: true },
      { id: "b", enabled: false },
      { id: "ws", enabled: true },
    ],
    stopOnFailure: false,
  };

  const [ride] = rides(col);
  assert.equal(ride.stopOnFailure, false);
  assert.deepEqual(
    executionSteps(col).map(({ request }) => request.id),
    ["a"],
  );
  assert.equal("runPlan" in col, false);
  assert.equal("stopOnFailure" in col, false);
});

test("Ride drops steps whose requests no longer exist", async () => {
  const { activeRide, insertRideStep, executionSteps } = await import("../src/ui/run-plan.mjs");
  const col = { requests: [{ id: "a", url: "/a" }] };
  const ride = activeRide(col);
  insertRideStep(col, ride.id, "a");
  col.requests = [];
  assert.deepEqual(executionSteps(col), []);
  assert.equal(activeRide(col).steps.length, 0);
});
