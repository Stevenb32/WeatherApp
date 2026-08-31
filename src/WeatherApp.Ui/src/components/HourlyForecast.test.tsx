import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { HourlyForecastEntry } from "../types/weather.ts";
import HourlyForecast from "./HourlyForecast.tsx";

const longCondition = "Patchy rain nearby with occasional heavy showers and gusty winds later in the hour";

const hourlyForecastFixture: HourlyForecastEntry[] = Array.from({ length: 24 }, (_, index) => ({
  time: new Date(Date.UTC(2026, 7, 28, 12 + index)).toISOString(),
  temperature: 60.5 + index,
  condition: index === 12 ? longCondition : `Condition ${String(index + 1).padStart(2, "0")}`,
  precipitationChance: index,
}));

describe("HourlyForecast", () => {
  it("renders all 24 entries exactly once and preserves the supplied order", () => {
    render(<HourlyForecast hourly={hourlyForecastFixture} unitSystem="imperial" timeZoneId="America/New_York" />);

    const list = screen.getByRole("list");
    const entries = within(list).getAllByRole("listitem");

    expect(entries).toHaveLength(24);
    expect(entries.map((entry) => entry.querySelector("time")?.getAttribute("datetime"))).toEqual(
      hourlyForecastFixture.map((hour) => hour.time),
    );
  });

  it("renders representative first, middle, and last entries with every required field", () => {
    render(<HourlyForecast hourly={hourlyForecastFixture} unitSystem="imperial" timeZoneId="America/New_York" />);

    const entries = screen.getAllByRole("listitem");
    const firstEntry = within(entries[0]);
    const middleEntry = within(entries[12]);
    const lastEntry = within(entries[23]);

    expect(firstEntry.getByText("08:00")).toBeVisible();
    expect(firstEntry.getByText("60.5")).toBeVisible();
    expect(firstEntry.getByText("°F")).toBeVisible();
    expect(firstEntry.getByText("Condition 01")).toBeVisible();
    expect(firstEntry.getByText("Precipitation chance: 0%")).toBeVisible();

    expect(middleEntry.getByText("20:00")).toBeVisible();
    expect(middleEntry.getByText("72.5")).toBeVisible();
    expect(middleEntry.getByText("°F")).toBeVisible();
    expect(middleEntry.getByText(longCondition)).toBeVisible();
    expect(middleEntry.getByText("Precipitation chance: 12%")).toBeVisible();

    expect(lastEntry.getByText("07:00")).toBeVisible();
    expect(lastEntry.getByText("83.5")).toBeVisible();
    expect(lastEntry.getByText("°F")).toBeVisible();
    expect(lastEntry.getByText("Condition 24")).toBeVisible();
    expect(lastEntry.getByText("Precipitation chance: 23%")).toBeVisible();
  });

  it("formats each hour in the supplied location time zone using a 24-hour clock", () => {
    const firstHour = [hourlyForecastFixture[0]];
    const { rerender } = render(<HourlyForecast hourly={firstHour} unitSystem="imperial" timeZoneId="America/New_York" />);

    const time = screen.getByText("08:00");

    expect(time).toHaveAttribute("datetime", "2026-08-28T12:00:00.000Z");

    rerender(<HourlyForecast hourly={firstHour} unitSystem="imperial" timeZoneId="Europe/London" />);

    expect(screen.getByText("13:00")).toBeVisible();
    expect(screen.queryByText("08:00")).not.toBeInTheDocument();
  });

  it("uses the selected temperature unit without converting the supplied value", () => {
    const metricHour: HourlyForecastEntry = {
      ...hourlyForecastFixture[0],
      temperature: 21.25,
    };

    render(<HourlyForecast hourly={[metricHour]} unitSystem="metric" timeZoneId="America/New_York" />);

    expect(screen.getByText("21.25")).toBeVisible();
    expect(screen.getByText("°C")).toBeVisible();
    expect(screen.queryByText("°F")).not.toBeInTheDocument();
  });

  it("exposes a named section, semantic list, and focusable named scroll region", async () => {
    const user = userEvent.setup();

    render(<HourlyForecast hourly={hourlyForecastFixture} unitSystem="imperial" timeZoneId="America/New_York" />);

    const section = screen.getByRole("region", { name: "Next 24 hours" });
    const scrollRegion = screen.getByRole("region", {
      name: "Next 24 hours hourly forecast",
    });

    expect(within(section).getByRole("heading", { level: 2, name: "Next 24 hours" })).toBeVisible();
    expect(within(section).getByRole("list")).toBeInTheDocument();
    expect(scrollRegion).toHaveAttribute("tabindex", "0");

    await user.tab();

    expect(scrollRegion).toHaveFocus();
  });
});
