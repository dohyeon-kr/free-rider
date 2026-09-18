function isHttpRequest(request) {
  return !request?.type || request.type === "http";
}

let fallbackId = 0;
function id(prefix) {
  return globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now().toString(36)}-${fallbackId++}`;
}

function newRide(name) {
  return {
    id: id("ride"),
    name,
    steps: [],
    stopOnFailure: true,
  };
}

function validRequestIds(col) {
  return new Set((col.requests || []).filter(isHttpRequest).map((request) => request.id));
}

export function rides(col) {
  col.requests ||= [];
  const valid = validRequestIds(col);

  if (!Array.isArray(col.rides)) {
    const legacy = Array.isArray(col.runPlan) ? col.runPlan : [];
    const ride = newRide("Ride 1");
    ride.stopOnFailure =
      col.stopOnFailure === undefined ? true : !!col.stopOnFailure;
    ride.steps = legacy
      .filter((item) => item?.enabled && valid.has(item.id))
      .map((item) => ({ id: id("step"), requestId: item.id }));
    col.rides = [ride];
    delete col.runPlan;
    delete col.stopOnFailure;
  }

  if (!col.rides.length) col.rides.push(newRide("Ride 1"));

  const usedRideIds = new Set();
  col.rides.forEach((ride, index) => {
    if (!ride.id || usedRideIds.has(ride.id)) ride.id = id("ride");
    usedRideIds.add(ride.id);
    ride.name = String(ride.name || `Ride ${index + 1}`);
    ride.stopOnFailure = ride.stopOnFailure !== false;
    if (!Array.isArray(ride.steps)) ride.steps = [];

    const usedStepIds = new Set();
    ride.steps = ride.steps
      .map((step) =>
        typeof step === "string"
          ? { id: id("step"), requestId: step }
          : { ...step },
      )
      .filter((step) => valid.has(step.requestId))
      .map((step) => {
        if (!step.id || usedStepIds.has(step.id)) step.id = id("step");
        usedStepIds.add(step.id);
        return step;
      });
  });

  if (!col.rides.some((ride) => ride.id === col.activeRideId))
    col.activeRideId = col.rides[0].id;

  return col.rides;
}

export function activeRide(col) {
  const list = rides(col);
  return list.find((ride) => ride.id === col.activeRideId) || list[0];
}

export function createRide(col, name = "") {
  const list = rides(col);
  const ride = newRide(String(name || `Ride ${list.length + 1}`).trim());
  list.push(ride);
  col.activeRideId = ride.id;
  return ride;
}

export function renameRide(col, rideId, name) {
  const ride = rides(col).find((item) => item.id === rideId);
  if (!ride) return null;
  const next = String(name || "").trim();
  if (!next) throw Error("Ride 이름을 입력하세요.");
  ride.name = next;
  return ride;
}

export function removeRide(col, rideId) {
  const list = rides(col);
  const index = list.findIndex((ride) => ride.id === rideId);
  if (index < 0) return false;
  list.splice(index, 1);
  if (!list.length) list.push(newRide("Ride 1"));
  if (!list.some((ride) => ride.id === col.activeRideId))
    col.activeRideId = list[Math.min(index, list.length - 1)].id;
  return true;
}

export function selectRide(col, rideId) {
  const ride = rides(col).find((item) => item.id === rideId);
  if (!ride) return null;
  col.activeRideId = ride.id;
  return ride;
}

export function insertRideStep(col, rideId, requestId, index = null) {
  const ride = rides(col).find((item) => item.id === rideId);
  if (!ride) throw Error("Ride를 찾을 수 없습니다.");
  const request = col.requests.find(
    (item) => item.id === requestId && isHttpRequest(item),
  );
  if (!request) throw Error("HTTP 엔드포인트를 찾을 수 없습니다.");
  const step = { id: id("step"), requestId };
  const target =
    index === null
      ? ride.steps.length
      : Math.max(0, Math.min(Number(index), ride.steps.length));
  ride.steps.splice(target, 0, step);
  return step;
}

export function removeRideStep(col, rideId, stepId) {
  const ride = rides(col).find((item) => item.id === rideId);
  if (!ride) return false;
  const index = ride.steps.findIndex((step) => step.id === stepId);
  if (index < 0) return false;
  ride.steps.splice(index, 1);
  return true;
}

export function moveRideStep(col, rideId, stepId, offset) {
  const ride = rides(col).find((item) => item.id === rideId);
  if (!ride) return false;
  const index = ride.steps.findIndex((step) => step.id === stepId);
  const target = index + Number(offset || 0);
  if (index < 0 || target < 0 || target >= ride.steps.length) return false;
  [ride.steps[index], ride.steps[target]] = [ride.steps[target], ride.steps[index]];
  return true;
}

export function executionSteps(col, rideId = null) {
  const ride = rideId
    ? rides(col).find((item) => item.id === rideId)
    : activeRide(col);
  if (!ride) return [];
  return ride.steps
    .map((step) => ({
      stepId: step.id,
      request: col.requests.find((request) => request.id === step.requestId),
    }))
    .filter(({ request }) => isHttpRequest(request))
    .map(({ stepId, request }) => ({
      stepId,
      request: structuredClone(request),
    }));
}
