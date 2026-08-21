using System.Globalization;
using WeatherApp.Api.Weather;

namespace WeatherApp.Api.WeatherApi;

public static class WeatherApiForecastMapper
{
    public static WeatherResponse Map(WeatherApiForecastResponse providerResponse, WeatherUnitSystem unitSystem)
    {
        var useImperialUnits = unitSystem == WeatherUnitSystem.Imperial;

        var hourlyForecast = providerResponse.Forecast.ForecastDays
            .SelectMany(forecastDay => forecastDay.Hours)
            .Where(hour => hour.TimeEpoch > providerResponse.Location.LocalTimeEpoch)
            .OrderBy(hour => hour.TimeEpoch)
            .Take(24)
            .Select(hour => new HourlyForecastEntry
                {
                    Time = DateTimeOffset.FromUnixTimeSeconds(hour.TimeEpoch),
                    Temperature = useImperialUnits
                        ? hour.TemperatureF
                        : hour.TemperatureC,
                    Condition = hour.Condition.Text,
                    PrecipitationChance = Math.Max(hour.ChanceOfRain, hour.ChanceOfSnow)
                })
            .ToList();

        var dailyForecast = providerResponse.Forecast.ForecastDays
            .OrderBy(forecastDay => forecastDay.Date)
            .Take(3)
            .Select(forecastDay => new DailyForecastEntry
                {
                    Date = DateOnly.ParseExact(
                        forecastDay.Date,
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture),
                    MinimumTemperature = useImperialUnits
                        ? forecastDay.Day.MinTemperatureF
                        : forecastDay.Day.MinTemperatureC,
                    MaximumTemperature = useImperialUnits
                        ? forecastDay.Day.MaxTemperatureF
                        : forecastDay.Day.MaxTemperatureC,
                    Condition = forecastDay.Day.Condition.Text,
                    PrecipitationChance = Math.Max(forecastDay.Day.ChanceOfRain, forecastDay.Day.ChanceOfSnow)
                })
            .ToList();

        return new WeatherResponse
        {
            UnitSystem = unitSystem,
            Location = new WeatherLocation
            {
                Name = providerResponse.Location.Name,
                Region = providerResponse.Location.Region,
                Country = providerResponse.Location.Country,
                TimeZoneId = providerResponse.Location.TimeZoneId
            },
            Current = new CurrentWeather
            {
                Temperature = useImperialUnits
                    ? providerResponse.Current.TemperatureF
                    : providerResponse.Current.TemperatureC,
                Condition = providerResponse.Current.Condition.Text,
                Humidity = providerResponse.Current.Humidity,
                WindSpeed = useImperialUnits
                    ? providerResponse.Current.WindMph
                    : providerResponse.Current.WindKph,
                WindDirection = providerResponse.Current.WindDirection
            },
            Hourly = hourlyForecast,
            Daily = dailyForecast
        };
    }
}