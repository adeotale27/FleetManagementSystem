import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import BookingReports from "./BookingReports";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  errMsg: () => "Request failed",
}));

const reportLR = {
  id: "lr-1", site_id: "site-1", trip_id: "trip-1", site_name: "North", trip_ref: "N-1",
  lr_ref: "N-LR-1", sender_name: "Sender", sender_phone: "111",
  receiver_name: "Receiver", receiver_label: "Receiver", receiver_phone: "222",
  receiver_identifier: "", goods_type: "Grain", operating_date: "2026-09-27",
  total_quantity: 2, containers: [{ type: "Box", quantity: 2 }],
  rent: "120.00", hamali: "10.00", paid_total: "20.00",
  outstanding: "100.00", payment_status: "partial", reconciled: false,
};
const trip = {
  id: "trip-1", trip_ref: "N-1", operating_date: "2026-09-27",
  truck_no: "TRUCK-1", driver_name: "Driver One", status: "open",
};

describe("BookingReports", () => {
  let container;
  let root;

  beforeEach(() => {
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [{ id: "site-1", name: "North" }] });
      if (path === "/sites/system-reports/lrs") {
        return Promise.resolve({ data: { rows: [reportLR], total: 1 } });
      }
      if (path === "/sites/site-1/trips/trip-1") return Promise.resolve({ data: trip });
      if (path === "/sites/site-1/trips/trip-1/lrs") {
        return Promise.resolve({ data: { rows: [reportLR], total: 1 } });
      }
      return Promise.resolve({ data: {} });
    });
    api.patch.mockImplementation((_path, body) => Promise.resolve({ data: {
      ...reportLR, ...body, receiver_label: body.receiver_name || reportLR.receiver_label,
      rent: body.rent ?? reportLR.rent,
      hamali: body.hamali ?? reportLR.hamali,
      total_quantity: body.containers?.reduce((sum, line) => sum + line.quantity, 0) ?? reportLR.total_quantity,
      paid_total: "20.00", outstanding: "130.00", payment_status: "partial",
    } }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const renderReport = async () => {
    await act(async () => {
      root.render(<MemoryRouter><BookingReports /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  const openLedger = async () => {
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Open ledger").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("loads site booking LRs from the distinct owner report API", async () => {
    await renderReport();

    expect(container.textContent).toContain("N-LR-1");
    expect(container.textContent).toContain("₹120");
    expect(api.get).toHaveBeenCalledWith("/sites/system-reports/lrs", expect.objectContaining({
      params: expect.objectContaining({
        limit: 50, offset: 0, from_date: expect.any(String), to_date: expect.any(String),
      }),
    }));
  });

  it("shows an empty report with zero matching records for a new business", async () => {
    api.get.mockImplementation((path) => path === "/sites"
      ? Promise.resolve({ data: [] })
      : Promise.resolve({ data: { rows: [], total: 0 } }));

    await renderReport();

    expect(container.textContent).toContain("0 matching LRs");
    expect(container.textContent).toContain("No booking LRs match these filters.");
  });

  it("opens the selected booking and loads its trip plus full trip-scoped LR ledger", async () => {
    await renderReport();
    await openLedger();

    expect(api.get).toHaveBeenCalledWith("/sites/site-1/trips/trip-1");
    expect(api.get).toHaveBeenCalledWith("/sites/site-1/trips/trip-1/lrs", {
      params: { limit: 100, offset: 0 },
    });
    expect(container.textContent).toContain("Booking ledger · N-1");
    expect(container.textContent).toContain("TRUCK-1");
    expect(container.textContent).toContain("Sender");
    expect(container.querySelector('[aria-label="N-LR-1 sender_name"]')).toBeNull();
    expect(Array.from(container.querySelectorAll("button"))
      .some((button) => button.textContent === "Edit row")).toBe(true);
  });

  it("edits the trip ledger and displays backend-recalculated finance", async () => {
    await renderReport();
    await openLedger();
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Edit row").click();
    });

    const goods = container.querySelector('[aria-label="N-LR-1 goods_type"]');
    const bhada = container.querySelector('[aria-label="N-LR-1 rent"]');
    const senderPhone = container.querySelector('[aria-label="N-LR-1 sender_phone"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(goods, "Rice");
      goods.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(bhada, "150.00");
      bhada.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(senderPhone, "333");
      senderPhone.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      window.dispatchEvent(new Event("fms:refresh"));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[aria-label="N-LR-1 goods_type"]').value).toBe("Rice");
    expect(container.textContent).toContain("Your unsaved changes were kept");

    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Save row").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(api.patch).toHaveBeenCalledWith(
      "/sites/site-1/trips/trip-1/lrs/lr-1",
      expect.objectContaining({
        sender_phone: "333",
        goods_type: "Rice",
        rent: "150.00",
        idempotency_key: expect.any(String),
      }),
    );
    expect(container.textContent).toContain("Rice");
    expect(container.textContent).toContain("₹130");
    expect(container.textContent).toContain("booking finance uses the updated LR");
  });

  it("keeps collected payments read-only in the trip ledger", async () => {
    await renderReport();
    await openLedger();
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Edit row").click();
    });

    expect(container.querySelector('[aria-label="N-LR-1 paid_total"]')).toBeNull();
    expect(container.textContent).toContain("₹20");
  });
});
