import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { api } from "../lib/api";
import { useFetch, useMaster } from "../lib/hooks";
import Trips from "./Trips";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/api", () => ({ api: { get: jest.fn() } }));
jest.mock("../lib/hooks", () => ({
  useFetch: jest.fn(),
  useMaster: jest.fn(),
  opts: (rows, labelKey = "name", valueKey = "id") =>
    (rows || []).map((row) => ({ value: row[valueKey], label: row[labelKey] })),
}));

describe("industrial Trips & LRs separation", () => {
  let container;
  let root;

  beforeEach(() => {
    useFetch.mockImplementation((path) => ({
      data: path === "/lr-stats" ? null : [],
      loading: false,
      error: null,
      reload: jest.fn(),
    }));
    api.get.mockClear();
    useMaster.mockReturnValue({ data: [] });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    jest.clearAllMocks();
  });

  it("does not request or display daily booking records", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Trips />
        </MemoryRouter>,
      );
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain("Site bookings");
    expect(useFetch).toHaveBeenCalledWith("/trips", expect.any(Object));
    expect(useFetch).not.toHaveBeenCalledWith("/sites", expect.anything());
  });
});
