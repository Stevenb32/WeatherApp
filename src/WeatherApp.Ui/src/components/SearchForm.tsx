import { useId, useState, type ChangeEvent, type FormEvent, type RefObject } from "react";

interface SearchFormProps {
  cityInputRef: RefObject<HTMLInputElement | null>;
  isSubmitting: boolean;
  onSearch: (location: string) => void;
}

function SearchForm({ cityInputRef, isSubmitting, onSearch }: SearchFormProps) {
  const [city, setCity] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const cityInputId = useId();
  const validationMessageId = `${cityInputId}-error`;

  function handleCityChange(event: ChangeEvent<HTMLInputElement>) {
    setCity(event.target.value);

    if (validationMessage !== null) {
      setValidationMessage(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedLocation = city.trim();

    if (trimmedLocation.length === 0) {
      setValidationMessage("Enter a city.");
      cityInputRef.current?.focus();
      return;
    }

    setValidationMessage(null);
    onSearch(trimmedLocation);
  }

  return (
    <form className="w-full" onSubmit={handleSubmit}>
      <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor={cityInputId}>
        City
      </label>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          ref={cityInputRef}
          id={cityInputId}
          name="city"
          type="text"
          autoComplete="address-level2"
          value={city}
          onChange={handleCityChange}
          aria-describedby={validationMessage === null ? undefined : validationMessageId}
          aria-invalid={validationMessage !== null}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-500 bg-white px-4 py-2.5 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-600 focus:ring-2 focus:ring-sky-600 focus:ring-offset-2 aria-invalid:border-rose-600 aria-invalid:focus:border-rose-600 aria-invalid:focus:ring-rose-600 motion-reduce:transition-none"
        />

        <button
          type="submit"
          aria-disabled={isSubmitting}
          className="min-h-11 rounded-lg bg-sky-700 px-6 py-2.5 font-semibold text-white shadow-sm transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-sky-700 motion-reduce:transition-none"
        >
          Search
        </button>
      </div>

      {validationMessage !== null && (
        <p id={validationMessageId} className="mt-2 text-sm font-medium text-rose-700">
          {validationMessage}
        </p>
      )}
    </form>
  );
}

export default SearchForm;
