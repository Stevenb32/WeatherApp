using System.Net;
using FluentAssertions;
using Microsoft.Extensions.Options;
using WeatherApp.Api.WeatherApi;
using WireMock.RequestBuilders;
using WireMock.ResponseBuilders;
using WireMock.Server;

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

    result.Location.Name.Should().Be("Tampa");
    result.Current.TemperatureC.Should().Be(31.0);
    result.Current.Condition.Text.Should().Be("Partly cloudy");

    var forecastDay = result.Forecast.ForecastDays
        .Should()
        .ContainSingle()
        .Which;

    forecastDay.Date.Should().Be("2026-08-18");
    forecastDay.Day.MaxTemperatureC.Should().Be(33.0);

    var hour = forecastDay.Hours
        .Should()
        .ContainSingle()
        .Which;

    hour.Time.Should().Be("2026-08-18 08:00");
    hour.TemperatureC.Should().Be(27.0);
  }

  [Fact]
  public async Task GetForecastAsync_WhenLocationIsUnknown_ThrowsProviderExceptionWithCode1006()
  {
    using var server = WireMockServer.Start();

    server
        .Given(
            Request.Create()
                .WithPath("/v1/forecast.json")
                .UsingGet()
                .WithParam("key", "test-api-key")
                .WithParam("q", "NotARealPlace")
                .WithParam("days", "3"))
        .RespondWith(
            Response.Create()
                .WithStatusCode(400)
                .WithHeader("Content-Type", "application/json")
                .WithBody(
                    """
                    {
                      "error": {
                        "code": 1006,
                        "message": "No location found matching parameter 'q'"
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

    Func<Task> act = () => client.GetForecastAsync("NotARealPlace");

    var exception = await act
        .Should()
        .ThrowAsync<WeatherApiException>();

    exception.Which.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    exception.Which.ProviderErrorCode.Should().Be(1006);
    exception.Which.Message.Should()
        .Be("No location found matching parameter 'q'");
  }

  [Fact]
  public async Task GetForecastAsync_WhenProviderReturnsServerError_ThrowsProviderException()
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
                .WithStatusCode(500));

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

    Func<Task> act = () => client.GetForecastAsync("Tampa");

    var exception = await act
        .Should()
        .ThrowAsync<WeatherApiException>();

    exception.Which.StatusCode
        .Should()
        .Be(HttpStatusCode.InternalServerError);

    exception.Which.ProviderErrorCode
        .Should()
        .BeNull();

    exception.Which.Message
        .Should()
        .Be("WeatherAPI request failed with status code 500.");
  }

}