export const DATA_CHANGE_EVENT = "fms:refresh";
const SYNC_POLL_MS = 2000;

let tenantId = null;
let lastRevision = null;
let channel = null;

const publishLocalChange = () => {
  window.dispatchEvent(new Event(DATA_CHANGE_EVENT));
};

const receiveDataChange = (revision) => {
  const hasRevision = revision !== null && revision !== undefined && revision !== "";
  const nextRevision = hasRevision ? Number(revision) : Number.NaN;
  if (Number.isSafeInteger(nextRevision) && nextRevision >= 0) {
    if (lastRevision !== null && nextRevision <= lastRevision) return;
    lastRevision = nextRevision;
  }
  publishLocalChange();
};

export const publishDataChange = (revision, { notifySelf = true } = {}) => {
  const hasRevision = revision !== null && revision !== undefined && revision !== "";
  const nextRevision = hasRevision ? Number(revision) : Number.NaN;
  if (Number.isSafeInteger(nextRevision) && nextRevision >= 0) {
    if (lastRevision !== null && nextRevision <= lastRevision) return;
    lastRevision = nextRevision;
  }
  if (notifySelf) publishLocalChange();
  if (channel) {
    try {
      channel.postMessage({ revision: Number.isSafeInteger(nextRevision) ? nextRevision : null });
    } catch (error) {
      console.warn("Could not broadcast the live update to other tabs.", error);
    }
  } else if (tenantId) {
    try {
      localStorage.setItem(`fms:refresh:${tenantId}`, `${Date.now()}:${Math.random()}`);
    } catch (error) {
      console.warn("Could not broadcast the live update to other tabs.", error);
    }
  }
};

export const startDataSync = (businessId, getRevision, onError) => {
  const nextTenantId = businessId || "platform";
  if (tenantId !== nextTenantId) {
    channel?.close();
    channel = null;
    tenantId = nextTenantId;
    lastRevision = null;
  }

  let stopped = false;
  let inFlight = false;
  let timer = null;
  let wasUnavailable = false;

  const onChannelMessage = (event) => receiveDataChange(event.data?.revision);
  const onStorage = (event) => {
    if (event.key === `fms:refresh:${tenantId}`) receiveDataChange(null);
  };

  if (typeof BroadcastChannel !== "undefined") {
    channel?.close();
    channel = new BroadcastChannel(`fms-data-${tenantId}`);
    channel.addEventListener("message", onChannelMessage);
  } else {
    window.addEventListener("storage", onStorage);
  }

  const poll = async () => {
    if (stopped || inFlight || document.visibilityState === "hidden") return;
    inFlight = true;
    const wasChecking = lastRevision === null;
    try {
      const revision = Number(await getRevision());
      if (!Number.isSafeInteger(revision) || revision < 0) {
        throw new Error("The live update revision response was invalid.");
      }
      if (lastRevision !== null && revision > lastRevision) publishDataChange(revision);
      else if (lastRevision === null) lastRevision = revision;
      if (wasUnavailable || wasChecking) onError?.(null);
      wasUnavailable = false;
    } catch (error) {
      if (!wasUnavailable) onError?.(error);
      wasUnavailable = true;
    } finally {
      inFlight = false;
      if (!stopped) timer = window.setTimeout(poll, SYNC_POLL_MS);
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible" && !inFlight) {
      window.clearTimeout(timer);
      timer = window.setTimeout(poll, 0);
    }
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  poll();

  return () => {
    stopped = true;
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (channel) {
      channel.removeEventListener("message", onChannelMessage);
      channel.close();
      channel = null;
    }
    window.removeEventListener("storage", onStorage);
  };
};
