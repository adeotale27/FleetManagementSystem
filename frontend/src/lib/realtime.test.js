import { DATA_CHANGE_EVENT, startDataSync } from "./realtime";

describe("tenant data synchronization", () => {
  const originalBroadcastChannel = global.BroadcastChannel;
  let channels;

  class TestBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.listeners = new Set();
      this.messages = [];
      channels.push(this);
    }

    addEventListener(_type, listener) { this.listeners.add(listener); }
    removeEventListener(_type, listener) { this.listeners.delete(listener); }
    postMessage(message) { this.messages.push(message); }
    close() {}
    receive(message) {
      this.listeners.forEach((listener) => listener({ data: message }));
    }
  }

  beforeEach(() => {
    jest.useFakeTimers();
    channels = [];
    global.BroadcastChannel = TestBroadcastChannel;
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    if (originalBroadcastChannel === undefined) delete global.BroadcastChannel;
    else global.BroadcastChannel = originalBroadcastChannel;
  });

  it("refreshes active tabs when another device advances the tenant revision", async () => {
    let revision = 4;
    const getRevision = jest.fn(async () => revision);
    const onRefresh = jest.fn();
    window.addEventListener(DATA_CHANGE_EVENT, onRefresh);
    const stop = startDataSync("tenant-realtime-test", getRevision);

    await Promise.resolve();
    await Promise.resolve();
    expect(onRefresh).not.toHaveBeenCalled();

    revision = 5;
    jest.advanceTimersByTime(2000);
    await Promise.resolve();
    await Promise.resolve();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(channels[0].messages).toEqual([{ revision: 5 }]);

    channels[0].receive({ revision: 6 });
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(channels[0].messages).toEqual([{ revision: 5 }]);

    stop();
    window.removeEventListener(DATA_CHANGE_EVENT, onRefresh);
  });

  it("reports when the first live-update check succeeds", async () => {
    const onStatus = jest.fn();
    const stop = startDataSync("tenant-initial-status-test", async () => 1, onStatus);

    await Promise.resolve();
    await Promise.resolve();
    expect(onStatus).toHaveBeenCalledWith(null);

    stop();
  });
});
