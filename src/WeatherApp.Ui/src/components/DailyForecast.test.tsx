import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DailyForecastEntry } from "../types/weather.ts";
import DailyForecast from "./DailyForecast.tsx";

const longCondition = "Patchy rain nearby with occasional heavy showers and gusty winds throughout the afternoon";

const dailyForecastFixture: DailyForecastEntry[] = [
  {
    date: "2026-08-28",
    minimumTemperature: 71.5,
    maximumTemperature: 91.25,
    condition: "Sunny intervals",
    precipitationChance: 10,
  },
  {
    date: "2026-08-29",
    minimumTemperature: 69.75,
    maximumTemperature: 86.5,
    condition: "Light rain showers",
    precipitationChance: 45,
  },
  {
    date: "2026-08-30",
    minimumTemperature: 68.25,
    maximumTemperature: 82.75,
    condition: longCondition,
    precipitationChance: 70,
  },
];

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function expectedDate(date: string) {
  return dateFormatter.format(new Date(`${date}T00:00:00Z`));
}

describe("DailyForecast", () => {
  it("renders all three entries exactly once and preserves the supplied order", () => {
    render(<DailyForecast daily={dailyForecastFixture} unitSystem="imperial" />);

    const section = screen.getByRole("region", { name: "Three-day forecast" });
    const list = within(section).getByRole("list");
    const entries = within(list).getAllByRole("listitem");

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.querySelector("time")?.getAttribute("datetime"))).toEqual(
      dailyForecastFixture.map((day) => day.date),
    );
  });

  it("renders representative entries with every required field and imperial units", () => {
    render(<DailyForecast daily={dailyForecastFixture} unitSystem="imperial" />);

    const entries = screen.getAllByRole("listitem");
    const firstEntry = within(entries[0]);
    const middleEntry = within(entries[1]);
    const lastEntry = within(entries[2]);

    expect(firstEntry.getByText(expectedDate("2026-08-28"))).toBeVisible();
    expect(firstEntry.getByText("71.5")).toBeVisible();
    expect(firstEntry.getByText("91.25")).toBeVisible();
    expect(firstEntry.getAllByText("°F")).toHaveLength(2);
    expect(firstEntry.getByText("Sunny intervals")).toBeVisible();
    expect(firstEntry.getByText("10%")).toBeVisible();

    expect(middleEntry.getByText(expectedDate("2026-08-29"))).toBeVisible();
    expect(middleEntry.getByText("69.75")).toBeVisible();
    expect(middleEntry.getByText("86.5")).toBeVisible();
    expect(middleEntry.getByText("Light rain showers")).toBeVisible();
    expect(middleEntry.getByText("45%")).toBeVisible();

    expect(lastEntry.getByText(expectedDate("2026-08-30"))).toBeVisible();
    expect(lastEntry.getByText("68.25")).toBeVisible();
    expect(lastEntry.getByText("82.75")).toBeVisible();
    expect(lastEntry.getByText(longCondition)).toBeVisible();
    expect(lastEntry.getByText("70%")).toBeVisible();
  });

  it("uses metric labels without converting the supplied values", () => {
    const metricDay: DailyForecastEntry = {
      ...dailyForecastFixture[0],
      minimumTemperature: 21.25,
      maximumTemperature: 32.75,
    };

    render(<DailyForecast daily={[metricDay]} unitSystem="metric" />);

    expect(screen.getByText("21.25")).toBeVisible();
    expect(screen.getByText("32.75")).toBeVisible();
    expect(screen.getAllByText("°C")).toHaveLength(2);
    expect(screen.queryByText("°F")).not.toBeInTheDocument();
  });

  it("exposes a named section, heading, semantic list, and time elements", () => {
    render(<DailyForecast daily={dailyForecastFixture} unitSystem="imperial" />);

    const section = screen.getByRole("region", { name: "Three-day forecast" });

    expect(within(section).getByRole("heading", { level: 2, name: "Three-day forecast" })).toBeVisible();
    expect(within(section).getByRole("list")).toBeInTheDocument();
    expect(section.querySelectorAll("time")).toHaveLength(3);
  });
});
