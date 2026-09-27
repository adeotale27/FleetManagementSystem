import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { useFetch, useMaster } from "../lib/hooks";
import Trips from "./Trips";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("../lib/hooks", () => ({
  useFetch: jest.fn(),
  useMaster: jest.fn(),
  opts: (rows, labelKey = "name", valueKey = "id") =>
    (rows || []).map((row) => ({ value: row[valueKey], label: row[labelKey] })),
}));

describe("Trips LR tab", () => {
  let container;
  let root;

  beforeEach(() => {
    useFetch.mockImplementation((path) => ({
      data: path === "/lr-stats" ? null : [],
      loading: false,
      error: null,
      reload: jest.fn(),
    }));
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

  it("does not fetch trip-only masters or settings", () => {
    act(() => root.render(
      <MemoryRouter
        initialEntries={["/trips?tab=lrs"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Trips />
      </MemoryRouter>,
    ));

    expect(useMaster).toHaveBeenNthCalledWith(1, null);
    expect(useMaster).toHaveBeenNthCalledWith(2, null);
    expect(useMaster).toHaveBeenCalledTimes(2);
    expect(useFetch).not.toHaveBeenCalledWith("/settings");
    expect(useFetch).toHaveBeenCalledWith("/lrs", expect.any(Object));
    expect(useFetch).toHaveBeenCalledWith("/lr-stats", { days: 30 });
  });
});
