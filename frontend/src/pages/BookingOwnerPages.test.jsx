import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../lib/api";
import BookingAudit from "./BookingAudit";
import BookingFinance from "./BookingFinance";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
  errMsg: () => "Request failed",
}));

const site = { id: "site-1", name: "Mama Garage" };
const finance = {
  site,
  totals: {
    grand_total: "110.00", recorded_bhada: "100.00", recorded_hamali: "10.00",
    collected_bhada: "0.00", outstanding_bhada: "100.00",
    collectible_outstanding_bhada: "100.00", receipt_count: 1,
    unpaid_receipts: 1, pending_orders: 0,
  },
  basis: "Booking totals",
  receiver_balances: [{
    receiver_label: "Suresh", receiver_name: "Suresh", receipt_count: 1,
    bhada: "100.00", collected: "0.00", outstanding: "100.00",
  }],
  rows: [{
    id: "lr-1", site_id: site.id, trip_id: "trip-1", lr_ref: "NGP-LR-01",
    trip_ref: "NGP29092026-01", receipt_date: "2026-09-29",
    receiver_name: "Suresh", goods: "Cement", rent: "100.00",
    hamali: "10.00", total: "110.00", paid: "0.00", outstanding: "100.00",
    payment_status: "unpaid", reconciled: true, promised_date: "", followup_note: "",
  }],
};

describe("owner-only booking pages", () => {
  let container;
  let root;

  beforeEach(() => {
    localStorage.clear();
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/booking-finance`) return Promise.resolve({ data: finance });
      if (path === `/sites/${site.id}/audit`) return Promise.resolve({ data: { rows: [{
        id: "event-1", action: "lr.unvoided", target_type: "lr",
        actor_name: "Business Owner", actor_role: "owner",
        created_at: "2026-09-29T12:00:00Z", reason: "Restored by mistake",
        old_values: { voided: true }, new_values: { voided: false },
      }] } });
      return Promise.resolve({ data: {} });
    });
    api.post.mockResolvedValue({ data: { status: "paid" } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  const render = async (Page, role = "owner") => {
    await act(async () => {
      root.render(<Page user={{ role }} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  it("groups Finance by receiver and settles a receipt's pending Bhada", async () => {
    await render(BookingFinance);
    expect(container.textContent).toContain("Bhada by receiver");
    expect(container.textContent).toContain("Suresh");
    expect(container.textContent).toContain("₹100");
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.trim() === "Settle").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(api.post).toHaveBeenCalledWith(
      `/sites/${site.id}/trips/trip-1/lrs/lr-1/settlement`,
      expect.objectContaining({ received: true, idempotency_key: expect.any(String) }),
    );
    expect(container.textContent).toContain("Payment recorded");
  });

  it("shows concise restore audit history and requests only recent events", async () => {
    await render(BookingAudit);
    expect(container.textContent).toContain("Booking Audit");
    expect(container.textContent).toContain("Receipt restored");
    expect(container.textContent).toContain("Business Owner");
    expect(container.textContent).toContain("Restored by mistake");
    expect(api.get).toHaveBeenCalledWith(`/sites/${site.id}/audit`, {
      params: { limit: 25, offset: 0 },
    });
  });

  it("does not render owner finance or audit data for managers", async () => {
    await render(BookingFinance, "site_manager");
    expect(container.textContent).toContain("Booking Finance is available to the business owner only.");
    expect(container.textContent).not.toContain("Bhada by receiver");

    await act(async () => {
      root.render(<BookingAudit user={{ role: "site_manager" }} />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain("Booking Audit is available to the business owner only.");
    expect(container.textContent).not.toContain("Recent activity");
  });
});
