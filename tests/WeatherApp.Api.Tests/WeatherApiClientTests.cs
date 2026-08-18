using Microsoft.Extensions.Options;
using WeatherApp.Api.WeatherApi;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;
using Xunit;

namespace WeatherApp.Api.Tests;

public sealed class WeatherApiClientTests
{
    [Fact]
    public async Task GetForecastAsync_WhenProviderReturnsSuccess_ReturnsDeserializedForecast()
    {
        using var server = WireMockServer.Start();

        server
            .Given(
                Request.Create()
                    .WithPath("/v1/forecast.json")
                    .UsingGet()
                    .WithParam("key", "test-api-key")
                    .WithParam("q", "Tampa")
                    .WithParam("days", "3"))
            .RespondWith(
                Response.Create()
                    .WithStatusCode(200)
                    .WithHeader("Content-Type", "application/json")
                    .WithBody(
                        """
                        {
                          "location": {
                            "name": "Tampa",
                            "region": "Florida",
                            "country": "United States of America",
                            "tz_id": "America/New_York"
                          },
                          "current": {
                            "temp_c": 31.0,
                            "temp_f": 87.8,
                            "condition": {
                              "text": "Partly cloudy",
                              "icon": "//cdn.weatherapi.com/icon.png",
                              "code": 1003
                            },
                            "humidity": 70,
                            "wind_mph": 8.1,
                            "wind_kph": 13.0,
                            "wind_dir": "E"
                          },
                          "forecast": {
                            "forecastday": [
                              {
                                "date": "2026-08-18",
                                "date_epoch": 1787011200,
                                "day": {
                                  "maxtemp_c": 33.0,
                                  "maxtemp_f": 91.4,
                                  "mintemp_c": 25.0,
                                  "mintemp_f": 77.0,
                                  "condition": {
                                    "text": "Partly cloudy",
                                    "icon": "//cdn.weatherapi.com/icon.png",
                                    "code": 1003
                                  },
                                  "daily_chance_of_rain": 40,
                                  "daily_chance_of_snow": 0
                                },
                                "hour": [
                                  {
                                    "time_epoch": 1787040000,
                                    "time": "2026-08-18 08:00",
                                    "temp_c": 27.0,
                                    "temp_f": 80.6,
                                    "condition": {
                                      "text": "Sunny",
                                      "icon": "//cdn.weatherapi.com/icon.png",
                                      "code": 1000
                                    },
                                    "chance_of_rain": 10,
                                    "chance_of_snow": 0
                                  }
                                ]
                              }
                            ]
                          }
                        }
                        """));

        using var httpClient = new HttpClient
        {
            BaseAddress = new Uri($"{server.Urls[0]}/v1/")
        };

        var options = Options.Create(
            new WeatherApiOptions
            {
                BaseUrl = $"{server.Urls[0]}/v1/",
                ApiKey = "test-api-key"
            });

        var client = new WeatherApiClient(httpClient, options);

        var result = await client.GetForecastAsync("Tampa");

        Assert.Equal("Tampa", result.Location.Name);
        Assert.Equal(31.0, result.Current.TemperatureC);
        Assert.Equal("Partly cloudy", result.Current.Condition.Text);

        var forecastDay = Assert.Single(result.Forecast.ForecastDays);

        Assert.Equal("2026-08-18", forecastDay.Date);
        Assert.Equal(33.0, forecastDay.Day.MaxTemperatureC);

        var hour = Assert.Single(forecastDay.Hours);

        Assert.Equal("2026-08-18 08:00", hour.Time);
        Assert.Equal(27.0, hour.TemperatureC);
    }
}