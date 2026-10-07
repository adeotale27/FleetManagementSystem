import { act } from "react";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { api } from "../lib/api";
import { registerBookingTestHarness } from "./Booking.testUtils";

jest.mock("../lib/api", () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  errMsg: (error) => error?.response?.data?.detail || "Request failed",
}));

describe("simple booking workflow", () => {
  const { container, site, trip, flushMicrotasks, getByLabelText, getByRole, clickButton,
    createLedgerRow, mockBookingApi, renderBooking, clearBooking, setInput } = registerBookingTestHarness();

  describe("trip lifecycle", () => {
  it("closes only the selected trip and leaves other trips open", async () => {
    let firstTrip = { ...trip, id: "trip-1", trip_ref: "NGP-TRIP-01", lr_count: 4 };
    const secondTrip = { ...trip, id: "trip-2", trip_ref: "NGP-TRIP-02" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [firstTrip, secondTrip], total: 2 } });
      }
      if (path === `/sites/${site.id}/trips/${firstTrip.id}/lrs`) {
        return Promise.resolve({ data: { rows: [], total: 0 } });
      }
      return Promise.resolve({ data: firstTrip });
    });
    api.post.mockImplementation((path) => {
      firstTrip = { ...firstTrip, status: "closed" };
      return Promise.resolve({ data: firstTrip });
    });

    await renderBooking("dashboard", "owner");
    await waitFor(() => expect(container.querySelector("button.card")).not.toBeNull());
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes(firstTrip.trip_ref)).click();
      await flushMicrotasks();
    });
    await waitFor(() => expect(Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes("Close Trip") && !button.disabled)).not.toBeUndefined());
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) =>
        button.textContent.includes("Close Trip")).click();
      await flushMicrotasks();
    });
    expect(screen.getByRole("dialog", { name: /Check trip money before closing/ })).not.toBeNull();
    expect(screen.getByText("✓ Close trip")).not.toBeNull();
    await act(async () => {
      screen.getByRole("button", { name: "✓ Close trip" }).click();
      await flushMicrotasks();
    });
    await clearBooking();
    await renderBooking("dashboard", "owner");
    await act(flushMicrotasks);

    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips/${firstTrip.id}/close`, {});
    const firstCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(firstTrip.trip_ref));
    const secondCard = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent.includes(secondTrip.trip_ref));
    expect(firstCard.textContent).toContain("Closed");
    expect(firstCard.textContent).toContain("4 receipts");
    expect(secondCard.textContent).toContain("Open");
  });

  it("filters dashboard trips by reference, vehicle, driver, date and status", async () => {
    const first = { ...trip, trip_ref: "NGP-OPEN-01", truck_no: "MH31AA1111", driver_name: "Ramesh" };
    const second = { ...trip, id: "trip-2", trip_ref: "NGP-CLOSED-02", status: "closed",
      truck_no: "MH31BB2222", driver_name: "Suresh" };
    mockBookingApi({ trips: [first, second] });
    await renderBooking("dashboard");

    await waitFor(() => expect(screen.getByRole("button", { name: /NGP-OPEN-01/ })).not.toBeNull());
    fireEvent.change(screen.getByLabelText("Filter trips by status"), { target: { value: "closed" } });
    expect(screen.queryByRole("button", { name: /NGP-OPEN-01/ })).toBeNull();
    expect(screen.getByRole("button", { name: /NGP-CLOSED-02/ })).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search trips"), { target: { value: "MH31AA1111" } });
    expect(container.textContent).toContain("No trips match these filters.");
    fireEvent.change(screen.getByLabelText("Filter trips by status"), { target: { value: "all" } });
    expect(screen.getByRole("button", { name: /NGP-OPEN-01/ })).not.toBeNull();
    fireEvent.change(screen.getByLabelText("Search trips"), { target: { value: "Ramesh" } });
    expect(screen.getByRole("button", { name: /NGP-OPEN-01/ })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /NGP-CLOSED-02/ })).toBeNull();
  });

  it("shows daily trip, receipt, and outstanding totals with a clear next action", async () => {
    const openTrip = { ...trip, id: "trip-open", trip_ref: "NGP-OPEN-01", status: "open" };
    const closedTrip = { ...trip, id: "trip-closed", trip_ref: "NGP-CLOSED-02", status: "closed" };
    const rows = [
      createLedgerRow({ id: "lr-active", rent: "100", hamali: "0", receipt_fee: "2",
        paid_total: "30", outstanding: "72", payment_status: "partial" }),
      createLedgerRow({ id: "lr-voided", voided: true, rent: "500", outstanding: "502" }),
    ];
    mockBookingApi({ trips: [openTrip, closedTrip], ledgerRows: rows });
    await renderBooking("dashboard");

    const summary = await screen.findByRole("region", { name: "Today's work summary" });
    await waitFor(() => {
      expect(within(summary).getAllByText("1", { selector: "strong" })).toHaveLength(2);
      expect(within(summary).getByText("₹72")).not.toBeNull();
    });
    expect(summary.textContent).toContain("Trips to finish");
    expect(summary.textContent).toContain("Receipts created");
    expect(summary.textContent).toContain("Add receipt");

    await clickButton("Add receipt", summary);
    expect(await screen.findByLabelText("Receiver name in English")).not.toBeNull();
    expect(localStorage.getItem("booking_trip_id")).toBe(openTrip.id);
  });

  it("shows daily trip, receipt, and outstanding totals with a clear next action", async () => {
    const openTrip = { ...trip, id: "trip-open", trip_ref: "NGP-OPEN-01", status: "open" };
    const closedTrip = { ...trip, id: "trip-closed", trip_ref: "NGP-CLOSED-02", status: "closed" };
    const rows = [
      createLedgerRow({ id: "lr-active", rent: "100", hamali: "0", receipt_fee: "2",
        paid_total: "30", outstanding: "72", payment_status: "partial" }),
      createLedgerRow({ id: "lr-voided", voided: true, rent: "500", outstanding: "502" }),
    ];
    mockBookingApi({ trips: [openTrip, closedTrip], ledgerRows: rows });
    await renderBooking("dashboard");

    const summary = await screen.findByRole("region", { name: "Today's work summary" });
    await waitFor(() => {
      expect(within(summary).getAllByText("1", { selector: "strong" })).toHaveLength(2);
      expect(within(summary).getByText("₹72")).not.toBeNull();
    });
    expect(summary.textContent).toContain("Trips to finish");
    expect(summary.textContent).toContain("Receipts created");
    expect(summary.textContent).toContain("Add receipt");

    await clickButton("Add receipt", summary);
    expect(await screen.findByLabelText("Receiver name in English")).not.toBeNull();
    expect(localStorage.getItem("booking_trip_id")).toBe(openTrip.id);
  });

  it("shows a receipt and balance summary before confirming trip closure", async () => {
    const receipts = [{
      id: "lr-1", lr_ref: "NGP-LR-01", receiver_name: "Suresh",
      rent: "100", hamali: "10", receipt_fee: "2", total_rent: "112",
      paid_total: "40", outstanding: "62", payment_status: "partial",
      goods_rows: [{ type: "Cement", quantity: 1 }],
    }];
    mockBookingApi({ trips: [trip], receipts });
    await renderBooking("dashboard", "owner");
    await waitFor(() => expect(screen.getByRole("button", { name: /NGP29092026-01/ })).not.toBeNull());
    await clickButton("NGP29092026-01");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close Trip" }).disabled).toBe(false));
    await clickButton("Close Trip");

    const summary = screen.getByRole("dialog", { name: /Check trip money before closing/ });
    expect(within(summary).getByText("₹112")).not.toBeNull();
    expect(within(summary).getByText("₹40")).not.toBeNull();
    expect(within(summary).getByText("₹62")).not.toBeNull();
    expect(summary.textContent).toContain("Total amount");
    expect(summary.textContent).toContain("✓ Already received");
    expect(summary.textContent).toContain("! Still to collect");
    expect(api.post).not.toHaveBeenCalled();

    await clickButton("✓ Close trip", summary);
    expect(api.post).toHaveBeenCalledWith(`/sites/${site.id}/trips/${trip.id}/close`, {});
  });

  it("includes every paginated receipt and excludes voided receipts from trip closeout totals", async () => {
    const activeReceipts = Array.from({ length: 101 }, (_, index) => ({
      id: `lr-${index}`, lr_ref: `NGP-LR-${index}`, rent: "100", hamali: "0",
      receipt_fee: "2", total_rent: "102", paid_total: "40", outstanding: "62",
      payment_status: "partial",
    }));
    const voidedReceipt = { id: "lr-void", lr_ref: "NGP-LR-VOID", voided: true,
      rent: "100", total_rent: "102", paid_total: "0", outstanding: "102" };
    const allReceipts = [...activeReceipts, voidedReceipt];
    api.get.mockImplementation((path, config = {}) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [trip], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        const offset = config.params?.offset || 0;
        return Promise.resolve({
          data: { rows: allReceipts.slice(offset, offset + 100), total: allReceipts.length },
        });
      }
      return Promise.resolve({ data: trip });
    });
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    await renderBooking("receipts", "owner");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close Trip" }).disabled).toBe(false));
    await clickButton("Close Trip");

    const summary = screen.getByRole("dialog", { name: /Check trip money before closing/ });
    expect(within(summary).getByText("101")).not.toBeNull();
    expect(within(summary).getByText("₹10,302")).not.toBeNull();
    expect(within(summary).getByText("₹4,040")).not.toBeNull();
    expect(within(summary).getByText("₹6,262")).not.toBeNull();
    expect(summary.textContent).toContain("1 voided receipt is excluded.");
    expect(api.get.mock.calls.some(([path, config]) =>
      path.endsWith("/lrs") && config?.params?.offset === 100)).toBe(true);
  }, 15000);

  it("blocks trip closure after a later receipt page fails and allows retry", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `lr-${index}`, lr_ref: `NGP-LR-${index}`, rent: "100",
      total_rent: "102", paid_total: "40", outstanding: "62", payment_status: "partial",
    }));
    const finalReceipt = {
      id: "lr-final", lr_ref: "NGP-LR-FINAL", rent: "100", total_rent: "102",
      paid_total: "40", outstanding: "62", payment_status: "partial",
    };
    let laterPageAttempts = 0;
    api.get.mockImplementation((path, config = {}) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) {
        return Promise.resolve({ data: { rows: [trip], total: 1 } });
      }
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) {
        if (config.params?.offset === 100) {
          laterPageAttempts += 1;
          if (laterPageAttempts === 1) {
            return Promise.reject({ response: { data: { detail: "Could not load the final page." } } });
          }
          return Promise.resolve({ data: { rows: [finalReceipt], total: 101 } });
        }
        return Promise.resolve({ data: { rows: firstPage, total: 101 } });
      }
      return Promise.resolve({ data: trip });
    });
    localStorage.setItem("booking_site_id", site.id);
    localStorage.setItem("booking_trip_id", trip.id);
    await renderBooking("receipts", "owner");

    await waitFor(() => expect(screen.getByText(/Could not load the full receipt summary/)).not.toBeNull());
    expect(screen.getByRole("button", { name: "Close Trip" }).disabled).toBe(true);
    expect(screen.queryByRole("dialog", { name: /Check trip money before closing/ })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();

    await clickButton("Retry receipt summary");
    await waitFor(() => expect(screen.getByRole("button", { name: "Close Trip" }).disabled).toBe(false));
    await clickButton("Close Trip");
    const summary = screen.getByRole("dialog", { name: /Check trip money before closing/ });
    expect(within(summary).getByText("101")).not.toBeNull();
    expect(within(summary).getByText("₹10,302")).not.toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  }, 15000);

  it("lets a manager add vehicle and driver details to a closed trip", async () => {
    const closedTrip = { ...trip, status: "closed" };
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [closedTrip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: closedTrip });
    });
    api.patch.mockResolvedValue({ data: {
      ...closedTrip, truck_no: "MH 31 AB 1234", driver_name: "Ramesh",
    } });
    await renderBooking("dashboard");
    await act(async () => {
      container.querySelector("button.card").click();
      await flushMicrotasks();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });

    expect(container.textContent).not.toContain("Delete trip");
    expect(container.querySelector('[aria-label="Edit trip vehicle number"]')).not.toBeNull();
    await act(async () => {
      setInput('[aria-label="Edit trip vehicle number"]', "MH 31 AB 1234");
      setInput('[aria-label="Edit trip driver name"]', "Ramesh");
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Save trip details")).click();
      await flushMicrotasks();
    });
    expect(api.patch).toHaveBeenCalledWith(`/sites/${site.id}/trips/${trip.id}`, {
      truck_no: "MH 31 AB 1234", driver_name: "Ramesh",
    });
    expect(container.textContent).toContain("MH 31 AB 1234");
    expect(container.textContent).toContain("Ramesh");
    expect(container.textContent).not.toContain("Delete trip");
  });

  it("lets only the owner delete or archive a trip from trip editing", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.delete.mockResolvedValue({ data: { deleted: true, archived: true, id: trip.id } });
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });

    await renderBooking("dashboard", "owner");
    await act(async () => {
      container.querySelector("button.card").click();
      await flushMicrotasks();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });
    expect(container.textContent).toContain("Delete trip");
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Delete trip")).click();
      await flushMicrotasks();
    });

    expect(confirm).toHaveBeenCalled();
    expect(api.delete).toHaveBeenCalledWith(`/sites/${site.id}/trips/${trip.id}`);
    expect(localStorage.getItem("booking_trip_id")).toBeNull();
    expect(container.textContent).toContain("Its void receipts and financial history were preserved.");
    confirm.mockRestore();
  });

  it("does not expose owner-only trip deletion to a site manager", async () => {
    mockBookingApi({ trips: [trip] });
    await renderBooking("dashboard");
    await waitFor(() => expect(screen.getByRole("button", { name: /NGP29092026-01/ })).not.toBeNull());
    await clickButton("NGP29092026-01");
    await clickButton("Edit trip details");

    expect(screen.queryByRole("button", { name: /Delete trip/ })).toBeNull();
    expect(container.textContent).not.toContain("Archive trip");
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("shows the server reason when trip deletion is blocked", async () => {
    const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
    api.get.mockImplementation((path) => {
      if (path === "/sites") return Promise.resolve({ data: [site] });
      if (path === `/sites/${site.id}/trips`) return Promise.resolve({ data: { rows: [trip], total: 1 } });
      if (path === `/sites/${site.id}/trips/${trip.id}/lrs`) return Promise.resolve({ data: { rows: [], total: 0 } });
      return Promise.resolve({ data: trip });
    });
    api.delete.mockRejectedValue({
      response: { status: 409, data: { detail: "Void every receipt first." } },
    });

    await renderBooking("dashboard", "owner");
    await act(async () => {
      container.querySelector("button.card").click();
      await flushMicrotasks();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Edit trip details")).click();
    });
    await act(async () => {
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent.includes("Delete trip")).click();
      await flushMicrotasks();
    });

    expect(container.querySelector('[role="alert"]').textContent).toContain("Void every receipt first.");
    expect(localStorage.getItem("booking_trip_id")).toBe(trip.id);
    confirm.mockRestore();
  });
  });
});
