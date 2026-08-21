using FluentAssertions;
using WeatherApp.Api.Weather;
using WeatherApp.Api.WeatherApi;

namespace WeatherApp.Api.Tests;

public sealed class WeatherApiForecastMapperTests
{
    [Fact]
    public void Map_WhenImperialUnitsAreRequested_MapsLocationAndCurrentWeather()
    {
        var providerResponse = new WeatherApiForecastResponse
        {
            Location = new WeatherApiLocation
            {
                Name = "Tampa",
                Region = "Florida",
                Country = "United States of America",
                TimeZoneId = "America/New_York"
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
            }
        };

        var result = WeatherApiForecastMapper.Map(providerResponse, WeatherUnitSystem.Imperial);

        result.UnitSystem.Should().Be(WeatherUnitSystem.Imperial);

        result.Location.Should().BeEquivalentTo(
            new WeatherLocation
            {
                Name = "Tampa",
                Region = "Florida",
                Country = "United States of America",
                TimeZoneId = "America/New_York"
            });

        result.Current.Should().BeEquivalentTo(
            new CurrentWeather
            {
                Temperature = 87.8,
                Condition = "Partly cloudy",
                Humidity = 70,
                WindSpeed = 8.1,
                WindDirection = "E"
            });
    }

    [Fact]
    public void Map_WhenMetricUnitsAreRequested_MapsMetricCurrentWeather()
    {
        var providerResponse = new WeatherApiForecastResponse
        {
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
            }
        };

        var result = WeatherApiForecastMapper.Map(providerResponse, WeatherUnitSystem.Metric);

        result.UnitSystem.Should().Be(WeatherUnitSystem.Metric);

        result.Current.Should().BeEquivalentTo(
            new CurrentWeather
            {
                Temperature = 31.0,
                Condition = "Partly cloudy",
                Humidity = 70,
                WindSpeed = 13.0,
                WindDirection = "E"
            });
    }

    [Fact]
    public void Map_WhenHourlyDataSpansMultipleDays_ReturnsNext24FutureHoursInOrder()
    {
        var currentLocationTime = new DateTimeOffset(
            2026,
            8,
            20,
            20,
            0,
            0,
            TimeSpan.FromHours(-4));

        var nextDayStart = new DateTimeOffset(
            2026,
            8,
            21,
            0,
            0,
            0,
            TimeSpan.FromHours(-4));

        var providerHours = Enumerable
            .Range(-1, 28)
            .Select(offset =>
            {
                var time = currentLocationTime.AddHours(offset);

                return new WeatherApiHour
                {
                    TimeEpoch = time.ToUnixTimeSeconds(),
                    Time = time.ToString("yyyy-MM-dd HH:mm"),
                    TemperatureC = 20.0 + offset,
                    TemperatureF = 70.0 + offset,
                    Condition = new WeatherApiCondition
                    {
                        Text = $"Condition {offset}"
                    },
                    ChanceOfRain = offset == 1 ? 20 : 10,
                    ChanceOfSnow = offset == 1 ? 35 : 0
                };
            })
            .OrderByDescending(hour => hour.TimeEpoch)
            .ToList();

        var providerResponse = new WeatherApiForecastResponse
        {
            Location = new WeatherApiLocation
            {
                LocalTimeEpoch = currentLocationTime.ToUnixTimeSeconds()
            },
            Forecast = new WeatherApiForecast
            {
                ForecastDays =
                [
                    new WeatherApiForecastDay
                {
                    Date = "2026-08-21",
                    Hours = providerHours
                        .Where(hour =>
                            hour.TimeEpoch >= nextDayStart.ToUnixTimeSeconds())
                        .ToList()
                },
                new WeatherApiForecastDay
                {
                    Date = "2026-08-20",
                    Hours = providerHours
                        .Where(hour =>
                            hour.TimeEpoch < nextDayStart.ToUnixTimeSeconds())
                        .ToList()
                }
                ]
            }
        };

        var result = WeatherApiForecastMapper.Map(providerResponse, WeatherUnitSystem.Imperial);

        result.Hourly.Should().HaveCount(24);

        result.Hourly
            .Select(hour => hour.Time)
            .Should()
            .BeInAscendingOrder();

        result.Hourly.First().Should().BeEquivalentTo(
            new HourlyForecastEntry
            {
                Time = currentLocationTime
                    .AddHours(1)
                    .ToUniversalTime(),
                Temperature = 71.0,
                Condition = "Condition 1",
                PrecipitationChance = 35
            });

        result.Hourly.Last().Time.Should().Be(
            currentLocationTime
                .AddHours(24)
                .ToUniversalTime());
    }

    [Fact]
    public void Map_WhenDailyDataIsUnordered_ReturnsThreeForecastDaysInDateOrder()
    {
        var providerResponse = new WeatherApiForecastResponse
        {
            Forecast = new WeatherApiForecast
            {
                ForecastDays =
                [
                    CreateForecastDay(
                        date: "2026-08-23",
                        minimumC: 23.0,
                        maximumC: 30.0,
                        minimumF: 73.4,
                        maximumF: 86.0,
                        condition: "Snow",
                        chanceOfRain: 10,
                        chanceOfSnow: 70),
                    CreateForecastDay(
                        date: "2026-08-21",
                        minimumC: 25.0,
                        maximumC: 33.0,
                        minimumF: 77.0,
                        maximumF: 91.4,
                        condition: "Sunny",
                        chanceOfRain: 40,
                        chanceOfSnow: 0),
                    CreateForecastDay(
                        date: "2026-08-24",
                        minimumC: 22.0,
                        maximumC: 29.0,
                        minimumF: 71.6,
                        maximumF: 84.2,
                        condition: "Cloudy",
                        chanceOfRain: 20,
                        chanceOfSnow: 0),
                    CreateForecastDay(
                        date: "2026-08-22",
                        minimumC: 24.0,
                        maximumC: 32.0,
                        minimumF: 75.2,
                        maximumF: 89.6,
                        condition: "Rain",
                        chanceOfRain: 60,
                        chanceOfSnow: 0)
                ]
            }
        };

        var result = WeatherApiForecastMapper.Map(providerResponse, WeatherUnitSystem.Metric);

        result.Daily.Should().HaveCount(3);

        var expected = new[]
        {
            new DailyForecastEntry
            {
                Date = new DateOnly(2026, 8, 21),
                MinimumTemperature = 25.0,
                MaximumTemperature = 33.0,
                Condition = "Sunny",
                PrecipitationChance = 40
            },
            new DailyForecastEntry
            {
                Date = new DateOnly(2026, 8, 22),
                MinimumTemperature = 24.0,
                MaximumTemperature = 32.0,
                Condition = "Rain",
                PrecipitationChance = 60
            },
            new DailyForecastEntry
            {
                Date = new DateOnly(2026, 8, 23),
                MinimumTemperature = 23.0,
                MaximumTemperature = 30.0,
                Condition = "Snow",
                PrecipitationChance = 70
            }
        };

        result.Daily.Should().BeEquivalentTo(expected, options => options.WithStrictOrdering());
    }

    private static WeatherApiForecastDay CreateForecastDay(
        string date,
        double minimumC,
        double maximumC,
        double minimumF,
        double maximumF,
        string condition,
        int chanceOfRain,
        int chanceOfSnow)
    {
        return new WeatherApiForecastDay
        {
            Date = date,
            Day = new WeatherApiDay
            {
                MinTemperatureC = minimumC,
                MaxTemperatureC = maximumC,
                MinTemperatureF = minimumF,
                MaxTemperatureF = maximumF,
                Condition = new WeatherApiCondition
                {
                    Text = condition
                },
                ChanceOfRain = chanceOfRain,
                ChanceOfSnow = chanceOfSnow
            }
        };
    }

}