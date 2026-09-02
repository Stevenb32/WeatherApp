using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using WeatherApp.Api.RateLimiting;
using WeatherApp.Api.Weather;
using WeatherApp.Api.WeatherApi;

var builder = WebApplication.CreateBuilder(args);

const string e2eEnvironmentName = "E2E";
const string e2eWeatherApiBaseUrl = "http://127.0.0.1:9090/v1/";

var isE2eEnvironment =
    builder.Environment.IsEnvironment(e2eEnvironmentName);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(
        new JsonStringEnumConverter(
            JsonNamingPolicy.CamelCase,
            allowIntegerValues: false));
});

builder.Services
    .AddOptions<WeatherApiOptions>()
    .Bind(builder.Configuration.GetSection(WeatherApiOptions.SectionName))
    .Validate(
        options => Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out var uri)
                   && (uri.Scheme == Uri.UriSchemeHttp ||
                       uri.Scheme == Uri.UriSchemeHttps),
        "WeatherApi:BaseUrl must be a valid HTTP or HTTPS URL.")
    .Validate(
        options => !string.IsNullOrWhiteSpace(options.ApiKey),
        "WeatherApi:ApiKey is required.")
    .Validate(
        options =>
            !isE2eEnvironment ||
            string.Equals(
                options.BaseUrl,
                e2eWeatherApiBaseUrl,
                StringComparison.Ordinal),
        $"WeatherApi:BaseUrl must be {e2eWeatherApiBaseUrl} " +
        $"when ASPNETCORE_ENVIRONMENT is {e2eEnvironmentName}.")
    .Validate(
        options => options.Timeout > TimeSpan.Zero,
        "WeatherApi:Timeout must be greater than zero.")
    .Validate(
        options => options.CacheDuration > TimeSpan.Zero,
        "WeatherApi:CacheDuration must be greater than zero.")
    .ValidateOnStart();

builder.Services
    .AddOptions<WeatherRateLimitOptions>()
    .Bind(
        builder.Configuration.GetSection(
            WeatherRateLimitOptions.SectionName))
    .Validate(
        options => options.PermitLimit > 0,
        "WeatherRateLimit:PermitLimit must be greater than zero.")
    .Validate(
        options => options.Window > TimeSpan.Zero,
        "WeatherRateLimit:Window must be greater than zero.")
    .ValidateOnStart();

builder.Services.AddMemoryCache();

builder.Services.AddRateLimiter(options =>
{
    var weatherRateLimitOptions = builder.Configuration
        .GetRequiredSection(WeatherRateLimitOptions.SectionName)
        .Get<WeatherRateLimitOptions>()
        ?? throw new InvalidOperationException(
            "WeatherRateLimit configuration is required.");

    options.RejectionStatusCode =
        StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter(
        policyName: "weather",
        fixedWindowOptions =>
        {
            fixedWindowOptions.PermitLimit =
                weatherRateLimitOptions.PermitLimit;

            fixedWindowOptions.Window =
                weatherRateLimitOptions.Window;

            fixedWindowOptions.QueueLimit = 0;

            fixedWindowOptions.QueueProcessingOrder =
                QueueProcessingOrder.OldestFirst;

            fixedWindowOptions.AutoReplenishment = true;
        });
});

builder.Services.AddHttpClient<WeatherApiClient>(
    (serviceProvider, httpClient) =>
    {
        var options = serviceProvider
            .GetRequiredService<IOptions<WeatherApiOptions>>()
            .Value;

        httpClient.BaseAddress = new Uri(options.BaseUrl);

        httpClient.Timeout = options.Timeout;
    });

var app = builder.Build();

if (!isE2eEnvironment)
{
    app.UseHttpsRedirection();
}

app.UseRateLimiter();

app.MapGet("/health", () => Results.Ok());

app.MapWeatherEndpoints();

app.Run();

public partial class Program { }
