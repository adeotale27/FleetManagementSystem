import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import BookingFinance from "./BookingFinance";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

jest.mock("../lib/api", () => ({
  api: { get: jest.fn() },
  errMsg: () => "Request failed",
}));

describe("BookingFinance", () => {
  let container;
  let root;

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [{ id: "site-1", name: "North" }] });
      return Promise.resolve({ data: {
        from_date: "2026-09-01", to_date: "2026-09-27",
        totals: {
          recorded_bhada: "100.00", recorded_hamali: "10.00",
          collected_bhada: "25.00", outstanding_bhada: "75.00",
          trip_expenses: "5.00", pending_reconciliation: 1,
        },
        sites: [{
          site: { id: "site-1", name: "North" }, total_trips: 1, total_lrs: 1,
          collected_bhada: "25.00", outstanding_bhada: "75.00", trip_expenses: "5.00",
        }],
        receivables: { by_receiver: { rows: [] }, by_goods: { rows: [] } },
      } });
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("renders site booking financial data from the booking dashboard API", async () => {
    await act(async () => {
      root.render(<MemoryRouter><BookingFinance /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("Booking Finance");
    expect(container.textContent).toContain("Bhada recorded");
    expect(container.textContent).toContain("Collectible outstanding");
    expect(api.get).toHaveBeenCalledWith("/sites/system-dashboard", expect.objectContaining({
      params: expect.objectContaining({ from_date: expect.any(String), to_date: expect.any(String) }),
    }));
  });
});
