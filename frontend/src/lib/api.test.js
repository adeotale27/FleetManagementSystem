jest.mock("../components/ui", () => ({
  scheduleMutationSuccess: jest.fn(),
  toast: jest.fn(),
}));
jest.mock("axios", () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: {
          handlers: [],
          use(fulfilled, rejected) {
            this.handlers.push({ fulfilled, rejected });
          },
        },
      },
    })),
  },
}));

import { api, errMsg } from "./api";
import { scheduleMutationSuccess, toast } from "../components/ui";

describe("API mutation notices", () => {
  const responseInterceptor = api.interceptors.response.handlers[0];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("schedules one shared success fallback for writes, but not reads or login", () => {
    responseInterceptor.fulfilled({ config: { method: "post", url: "/trips" } });
    responseInterceptor.fulfilled({ config: { method: "get", url: "/trips" } });
    responseInterceptor.fulfilled({ config: { method: "post", url: "/auth/login" } });

    expect(scheduleMutationSuccess).toHaveBeenCalledTimes(1);
    expect(scheduleMutationSuccess).toHaveBeenCalledWith("Trip created");
    expect(toast).not.toHaveBeenCalled();
  });

  it.each([
    ["post", "/sites/site-1/trips/trip-1/lrs", "LR created"],
    ["post", "/sites/site-1/trips/trip-1/expenses", "Expense saved"],
    ["patch", "/sites/site-1/trips/trip-1?source=console", "Trip updated"],
    ["patch", "/sites/site-1", "Site updated"],
    ["post", "/custom/action", "Changes saved successfully."],
  ])("derives a success label for %s %s", (method, url, label) => {
    responseInterceptor.fulfilled({ config: { method, url } });

    expect(scheduleMutationSuccess).toHaveBeenCalledWith(label);
  });

  it("shows a global error toast for each failed write", async () => {
    const error = {
      config: { method: "put", url: "/trips/1" },
      response: { status: 400, data: { detail: "Trip date is required" } },
    };
    await expect(responseInterceptor.rejected(error)).rejects.toBe(error);
    expect(toast).toHaveBeenCalledWith("Trip date is required", "err", { apiError: true });
  });

  it("keeps validation messages useful and makes 5xx text safe and referenceable", () => {
    expect(errMsg({
      response: {
        status: 422,
        data: { detail: [{ loc: ["body", "owner", "name"], msg: "Field required", input: "private" }] },
      },
    })).toBe("owner.name: Field required");
    expect(errMsg({
      response: { status: 500, data: { detail: "database secret", reference_id: "abc123" } },
    })).toBe("The server couldn't complete this request. Please try again. Reference: abc123");
  });
});
