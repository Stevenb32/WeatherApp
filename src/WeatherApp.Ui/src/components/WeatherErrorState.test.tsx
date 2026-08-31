import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WeatherErrorCategory } from "../services/weatherApi.ts";
import WeatherErrorState from "./WeatherErrorState.tsx";

const errorCases: ReadonlyArray<{
  category: WeatherErrorCategory;
  heading: string;
  guidance: string;
  statusCode: string;
}> = [
  {
    category: "location-not-found",
    heading: "Location not found",
    guidance: "We couldn’t find that location. Check the city name and search again, or retry.",
    statusCode: "404",
  },
  {
    category: "provider-unavailable",
    heading: "Weather is temporarily unavailable",
    guidance: "The weather service is temporarily unavailable. Please try again.",
    statusCode: "503",
  },
  {
    category: "provider-timeout",
    heading: "Weather took too long",
    guidance: "The weather took too long to load. Please try again.",
    statusCode: "504",
  },
  {
    category: "unexpected-failure",
    heading: "Weather couldn’t be loaded",
    guidance: "Something went wrong while loading the weather. Please try again.",
    statusCode: "500",
  },
];

describe("WeatherErrorState", () => {
  it.each(errorCases)("renders safe, accessible content for $category", ({ category, heading, guidance, statusCode }) => {
    render(<WeatherErrorState category={category} onRetry={vi.fn()} />);

    const alert = screen.getByRole("alert");

    expect(within(alert).getByRole("heading", { level: 2, name: heading })).toBeVisible();
    expect(within(alert).getByText(guidance)).toBeVisible();
    expect(alert).not.toHaveTextContent(category);
    expect(alert).not.toHaveTextContent(statusCode);
    expect(alert).not.toHaveTextContent("WeatherAPI");
    expect(alert).not.toHaveTextContent("Provider-specific failure details.");
    expect(alert).not.toHaveTextContent("Unable to retrieve weather data.");
  });

  it("exposes a keyboard-accessible Retry button that invokes its callback", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<WeatherErrorState category="unexpected-failure" onRetry={onRetry} />);

    const retryButton = screen.getByRole("button", { name: "Retry" });

    expect(retryButton).toHaveAttribute("type", "button");

    await user.tab();

    expect(retryButton).toHaveFocus();

    await user.keyboard("{Enter}");

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
