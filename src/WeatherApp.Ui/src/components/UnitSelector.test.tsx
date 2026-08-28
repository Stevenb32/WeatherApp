import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import UnitSelector from "./UnitSelector.tsx";

describe("UnitSelector", () => {
  it("renders an accessible group with visible unit symbols", () => {
    render(<UnitSelector units="imperial" isDisabled={false} onChange={vi.fn()} />);

    const unitGroup = screen.getByRole("group", {
      name: "Temperature units",
    });

    expect(within(unitGroup).getByText("°F")).toBeVisible();
    expect(within(unitGroup).getByText("°C")).toBeVisible();
    expect(
      within(unitGroup).getByRole("radio", {
        name: "Fahrenheit (imperial units)",
      }),
    ).toBeInTheDocument();
    expect(
      within(unitGroup).getByRole("radio", {
        name: "Celsius (metric units)",
      }),
    ).toBeInTheDocument();
  });

  it("shows imperial as selected when controlled with imperial units", () => {
    render(<UnitSelector units="imperial" isDisabled={false} onChange={vi.fn()} />);

    expect(
      screen.getByRole("radio", {
        name: "Fahrenheit (imperial units)",
      }),
    ).toBeChecked();
    expect(screen.getByRole("radio", { name: "Celsius (metric units)" })).not.toBeChecked();
  });

  it("reports metric selection to its parent", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<UnitSelector units="imperial" isDisabled={false} onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Celsius (metric units)" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("metric");
  });

  it("reflects a new controlled value after its parent rerenders", () => {
    const onChange = vi.fn();
    const { rerender } = render(<UnitSelector units="imperial" isDisabled={false} onChange={onChange} />);

    rerender(<UnitSelector units="metric" isDisabled={false} onChange={onChange} />);

    expect(
      screen.getByRole("radio", {
        name: "Fahrenheit (imperial units)",
      }),
    ).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Celsius (metric units)" })).toBeChecked();
  });

  it("prevents unit changes while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<UnitSelector units="imperial" isDisabled onChange={onChange} />);

    const imperialRadio = screen.getByRole("radio", {
      name: "Fahrenheit (imperial units)",
    });
    const metricRadio = screen.getByRole("radio", {
      name: "Celsius (metric units)",
    });

    expect(imperialRadio).toBeDisabled();
    expect(metricRadio).toBeDisabled();

    await user.click(metricRadio);

    expect(onChange).not.toHaveBeenCalled();
  });
});
