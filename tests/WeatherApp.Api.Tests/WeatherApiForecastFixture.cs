using System.Globalization;
using WeatherApp.Api.WeatherApi;

namespace WeatherApp.Api.Tests;

public static class WeatherApiForecastFixture
{
    public static WeatherApiForecastResponse Create()
    {
        var firstDayStart = new DateTimeOffset(
            2026,
            8,
            20,
            0,
            0,
            0,
            TimeSpan.FromHours(-4));

        var currentLocalTime = firstDayStart.AddHours(20);

        return new WeatherApiForecastResponse
        {
            Location = new WeatherApiLocation
            {
                Name = "Tampa",
                Region = "Florida",
                Country = "United States of America",
                TimeZoneId = "America/New_York",
                LocalTimeEpoch = currentLocalTime.ToUnixTimeSeconds()
            },

            Current = new WeatherApiCurrent
            {
                TemperatureC = 31.0,
                TemperatureF = 87.8,

                Condition = new WeatherApiCondition
                {
                    Text = "Partly cloudy"
                },

                Humidity = 70,
                WindMph = 8.1,
                WindKph = 13.0,
                WindDirection = "E"
            },

            Forecast = new WeatherApiForecast
            {
                ForecastDays = Enumerable
                    .Range(0, 3)
                    .Select(dayOffset =>
                        CreateForecastDay(firstDayStart.AddDays(dayOffset)))
                    .ToList()
            }
        };
    }

    private static WeatherApiForecastDay CreateForecastDay(DateTimeOffset dayStart)
    {
        return new WeatherApiForecastDay
        {
            Date = dayStart.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),

            DateEpoch = dayStart.ToUnixTimeSeconds(),

            Day = new WeatherApiDay
            {
                MinTemperatureC = 25.0,
                MinTemperatureF = 77.0,

                MaxTemperatureC = 33.0,
                MaxTemperatureF = 91.4,

                Condition = new WeatherApiCondition
                {
                    Text = "Partly cloudy"
                },

                ChanceOfRain = 40,
                ChanceOfSnow = 0
            },

            Hours = Enumerable
                .Range(0, 24)
                .Select(hourOffset =>
                    CreateForecastHour(dayStart.AddHours(hourOffset)))
                .ToList()
        };
    }

    private static WeatherApiHour CreateForecastHour(DateTimeOffset hourTime)
    {
        return new WeatherApiHour
        {
            TimeEpoch = hourTime.ToUnixTimeSeconds(),

            Time = hourTime.ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),

            TemperatureC = 27.0,
            TemperatureF = 80.6,

            Condition = new WeatherApiCondition
            {
                Text = "Sunny"
            },

            ChanceOfRain = 10,
            ChanceOfSnow = 0
        };
    }
}