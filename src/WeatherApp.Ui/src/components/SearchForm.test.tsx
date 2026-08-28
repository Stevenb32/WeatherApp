import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchForm from "./SearchForm.tsx";

describe("SearchForm", () => {
  it("submits a valid city with the Search button", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting={false} onSearch={onSearch} />);

    await user.type(screen.getByLabelText("City"), "Tampa");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("Tampa");
  });

  it("submits a valid city with Enter", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting={false} onSearch={onSearch} />);

    await user.type(screen.getByLabelText("City"), "Boston{Enter}");

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("Boston");
  });

  it("trims leading and trailing whitespace before submitting", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting={false} onSearch={onSearch} />);

    await user.type(screen.getByLabelText("City"), "   St. John's   ");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(onSearch).toHaveBeenCalledOnce();
    expect(onSearch).toHaveBeenCalledWith("St. John's");
  });

  it.each([
    ["blank", ""],
    ["whitespace-only", "   "],
  ])("rejects %s input", async (_description, value) => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting={false} onSearch={onSearch} />);

    const cityInput = screen.getByLabelText("City");

    if (value.length > 0) {
      await user.type(cityInput, value);
    }

    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(screen.getByText("Enter a city.")).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("associates invalid feedback and returns focus to the city input", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting={false} onSearch={onSearch} />);

    const cityInput = screen.getByLabelText("City");

    await user.click(screen.getByRole("button", { name: "Search" }));

    const validationMessage = screen.getByText("Enter a city.");

    expect(cityInput).toHaveAttribute("aria-invalid", "true");
    expect(cityInput).toHaveAttribute("aria-describedby", validationMessage.id);
    expect(cityInput).toHaveAccessibleDescription("Enter a city.");
    expect(cityInput).toHaveFocus();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("prevents submission while a request is pending", async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchForm isSubmitting onSearch={onSearch} />);

    await user.type(screen.getByLabelText("City"), "Tampa");

    const searchButton = screen.getByRole("button", { name: "Search" });

    expect(searchButton).toBeDisabled();

    await user.click(searchButton);

    expect(onSearch).not.toHaveBeenCalled();
  });
});
