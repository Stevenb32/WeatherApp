using System.Text.Json.Serialization;

namespace WeatherApp.Api.WeatherApi;

public sealed class WeatherApiForecastResponse
{
    [JsonPropertyName("location")]
    public WeatherApiLocation Location { get; set; } = new();

    [JsonPropertyName("current")]
    public WeatherApiCurrent Current { get; set; } = new();

    [JsonPropertyName("forecast")]
    public WeatherApiForecast Forecast { get; set; } = new();
}

public sealed class WeatherApiLocation
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("region")]
    public string Region { get; set; } = string.Empty;

    [JsonPropertyName("country")]
    public string Country { get; set; } = string.Empty;

    [JsonPropertyName("tz_id")]
    public string TimeZoneId { get; set; } = string.Empty;
}

public sealed class WeatherApiCurrent
{
    [JsonPropertyName("temp_c")]
    public double TemperatureC { get; set; }

    [JsonPropertyName("temp_f")]
    public double TemperatureF { get; set; }

    [JsonPropertyName("condition")]
    public WeatherApiCondition Condition { get; set; } = new();

    [JsonPropertyName("humidity")]
    public int Humidity { get; set; }

    [JsonPropertyName("wind_mph")]
    public double WindMph { get; set; }

    [JsonPropertyName("wind_kph")]
    public double WindKph { get; set; }

    [JsonPropertyName("wind_dir")]
    public string WindDirection { get; set; } = string.Empty;
}

public sealed class WeatherApiCondition
{
    [JsonPropertyName("text")]
    public string Text { get; set; } = string.Empty;

    [JsonPropertyName("icon")]
    public string Icon { get; set; } = string.Empty;

    [JsonPropertyName("code")]
    public int Code { get; set; }
}

public sealed class WeatherApiForecast
{
    [JsonPropertyName("forecastday")]
    public List<WeatherApiForecastDay> ForecastDays { get; set; } = [];
}

public sealed class WeatherApiForecastDay
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;

    [JsonPropertyName("date_epoch")]
    public long DateEpoch { get; set; }

    [JsonPropertyName("day")]
    public WeatherApiDay Day { get; set; } = new();

    [JsonPropertyName("hour")]
    public List<WeatherApiHour> Hours { get; set; } = [];
}

public sealed class WeatherApiDay
{
    [JsonPropertyName("maxtemp_c")]
    public double MaxTemperatureC { get; set; }

    [JsonPropertyName("maxtemp_f")]
    public double MaxTemperatureF { get; set; }

    [JsonPropertyName("mintemp_c")]
    public double MinTemperatureC { get; set; }

    [JsonPropertyName("mintemp_f")]
    public double MinTemperatureF { get; set; }

    [JsonPropertyName("condition")]
    public WeatherApiCondition Condition { get; set; } = new();

    [JsonPropertyName("daily_chance_of_rain")]
    public int ChanceOfRain { get; set; }

    [JsonPropertyName("daily_chance_of_snow")]
    public int ChanceOfSnow { get; set; }
}

public sealed class WeatherApiHour
{
    [JsonPropertyName("time_epoch")]
    public long TimeEpoch { get; set; }

    [JsonPropertyName("time")]
    public string Time { get; set; } = string.Empty;

    [JsonPropertyName("temp_c")]
    public double TemperatureC { get; set; }

    [JsonPropertyName("temp_f")]
    public double TemperatureF { get; set; }

    [JsonPropertyName("condition")]
    public WeatherApiCondition Condition { get; set; } = new();

    [JsonPropertyName("chance_of_rain")]
    public int ChanceOfRain { get; set; }

    [JsonPropertyName("chance_of_snow")]
    public int ChanceOfSnow { get; set; }
}