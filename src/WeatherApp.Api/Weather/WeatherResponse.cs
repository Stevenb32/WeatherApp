namespace WeatherApp.Api.Weather;

public sealed class WeatherResponse
{
    public WeatherLocation Location { get; init; } = new();

    public WeatherUnitSystem UnitSystem { get; init; }

    public CurrentWeather Current { get; init; } = new();

    public IReadOnlyList<HourlyForecastEntry> Hourly { get; init; } = [];

    public IReadOnlyList<DailyForecastEntry> Daily { get; init; } = [];
}

public sealed class WeatherLocation
{
    public string Name { get; init; } = string.Empty;

    public string Region { get; init; } = string.Empty;

    public string Country { get; init; } = string.Empty;

    public string TimeZoneId { get; init; } = string.Empty;
}

public sealed class CurrentWeather
{
    public double Temperature { get; init; }

    public string Condition { get; init; } = string.Empty;

    public int Humidity { get; init; }

    public double WindSpeed { get; init; }

    public string WindDirection { get; init; } = string.Empty;
}

public sealed class HourlyForecastEntry
{
    public DateTimeOffset Time { get; init; }

    public double Temperature { get; init; }

    public string Condition { get; init; } = string.Empty;

    public int PrecipitationChance { get; init; }
}

public sealed class DailyForecastEntry
{
    public DateOnly Date { get; init; }

    public double MinimumTemperature { get; init; }

    public double MaximumTemperature { get; init; }

    public string Condition { get; init; } = string.Empty;

    public int PrecipitationChance { get; init; }
}