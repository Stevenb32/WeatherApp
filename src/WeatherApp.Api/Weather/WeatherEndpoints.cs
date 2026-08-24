using System.Net;
using WeatherApp.Api.WeatherApi;

namespace WeatherApp.Api.Weather;

public static class WeatherEndpoints
{
    public static IEndpointRouteBuilder MapWeatherEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/weather", GetWeatherAsync);

        return endpoints;
    }

    private static async Task<IResult> GetWeatherAsync(
        string? location,
        string? units,
        WeatherApiClient weatherApiClient,
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

        try
        {
            var providerResponse = await weatherApiClient.GetForecastAsync(
                location,
                cancellationToken);

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