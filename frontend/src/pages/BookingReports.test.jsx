import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import BookingReports from "./BookingReports";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn() },
  errMsg: () => "Request failed",
}));

describe("BookingReports", () => {
  let container;
  let root;

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [{ id: "site-1", name: "North" }] });
      return Promise.resolve({ data: { rows: [{
        id: "lr-1", site_id: "site-1", site_name: "North", trip_ref: "N-1",
        lr_ref: "N-LR-1", receiver_name: "Receiver", goods_type: "Grain",
        operating_date: "2026-09-27", total_quantity: 2, rent: "120.00",
        hamali: "10.00", paid_total: "20.00", outstanding: "100.00",
        payment_status: "partial",
      }], total: 1 } });
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

  it("loads site booking LRs from the distinct owner report API", async () => {
    await act(async () => {
      root.render(<MemoryRouter><BookingReports /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain("N-LR-1");
    expect(container.textContent).toContain("₹120");
    expect(api.get).toHaveBeenCalledWith("/sites/system-reports/lrs", expect.objectContaining({
      params: expect.objectContaining({ limit: 50, offset: 0, from_date: expect.any(String), to_date: expect.any(String) }),
    }));
  });
});
