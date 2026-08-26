using System.Net;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using WeatherApp.Api.WeatherApi;

namespace WeatherApp.Api.Weather;

public static class WeatherEndpoints
{
    public static IEndpointRouteBuilder MapWeatherEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints
            .MapGet("/api/weather", GetWeatherAsync)
            .RequireRateLimiting("weather");

        return endpoints;
    }

    private static async Task<IResult> GetWeatherAsync(
        string? location,
        string? units,
        WeatherApiClient weatherApiClient,
        IMemoryCache memoryCache,
        IOptions<WeatherApiOptions> weatherApiOptions,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(location))
        {
            return Results.Problem(
                title: "Invalid location",
                detail: "A location must be provided.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        WeatherUnitSystem unitSystem;

        if (units is null)
        {
            unitSystem = WeatherUnitSystem.Imperial;
        }
        else if (
            string.Equals(
                units,
                "imperial",
                StringComparison.OrdinalIgnoreCase))
        {
            unitSystem = WeatherUnitSystem.Imperial;
        }
        else if (
            string.Equals(
                units,
                "metric",
                StringComparison.OrdinalIgnoreCase))
        {
            unitSystem = WeatherUnitSystem.Metric;
        }
        else
        {
            return Results.Problem(
                title: "Invalid units",
                detail: "Units must be either imperial or metric.",
                statusCode: StatusCodes.Status400BadRequest);
        }

        var normalizedLocation = location.Trim();

        var cacheKey =
            $"weather:forecast:days=3:{normalizedLocation.ToUpperInvariant()}";

        try
        {
            if (
                !memoryCache.TryGetValue<WeatherApiForecastResponse>(
                    cacheKey,
                    out var providerResponse) ||
                    providerResponse is null)
            {
                providerResponse = await weatherApiClient.GetForecastAsync(
                    normalizedLocation,
                    cancellationToken);

                memoryCache.Set(
                    cacheKey,
                    providerResponse,
                    new MemoryCacheEntryOptions
                    {
                        AbsoluteExpirationRelativeToNow =
                            weatherApiOptions.Value.CacheDuration
                    });
            }

            var weatherResponse = WeatherApiForecastMapper.Map(
                providerResponse,
                unitSystem);

            return Results.Ok(weatherResponse);
        }
        catch (TaskCanceledException exception)
            when (
                !cancellationToken.IsCancellationRequested &&
                exception.InnerException is TimeoutException)
        {
            return Results.Problem(
                title: "Weather provider timeout",
                detail: "The weather provider did not respond in time.",
                statusCode: StatusCodes.Status504GatewayTimeout);
        }
        catch (WeatherApiException exception)
            when (exception.ProviderErrorCode == 1006)
        {
            return Results.Problem(
                title: "Location not found",
                detail: "The requested location could not be found.",
                statusCode: StatusCodes.Status404NotFound);
        }
        catch (WeatherApiException exception)
            when (
                exception.StatusCode is
                    HttpStatusCode.RequestTimeout or
                    HttpStatusCode.GatewayTimeout)
        {
            return Results.Problem(
                title: "Weather provider timeout",
                detail: "The weather provider did not respond in time.",
                statusCode: StatusCodes.Status504GatewayTimeout);
        }
        catch (WeatherApiException)
        {
            return Results.Problem(
                title: "Weather provider unavailable",
                detail:
                    "Weather data is temporarily unavailable. " +
                    "Please try again later.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (HttpRequestException)
        {
            return Results.Problem(
                title: "Weather provider unavailable",
                detail:
                    "Weather data is temporarily unavailable. " +
                    "Please try again later.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }
}