using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Options;
using WeatherApp.Api.Weather;
using WeatherApp.Api.WeatherApi;

var builder = WebApplication.CreateBuilder(args);

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
        options => options.Timeout > TimeSpan.Zero,
        "WeatherApi:Timeout must be greater than zero.")
    .ValidateOnStart();

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

app.UseHttpsRedirection();

app.MapGet("/health", () => Results.Ok());

app.MapWeatherEndpoints();

app.Run();

public partial class Program { }