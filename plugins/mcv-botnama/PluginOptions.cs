#nullable enable

using System;
using System.IO;
using System.Text;
using Newtonsoft.Json;

namespace MCV.Botnama.Plugin;

internal sealed class PluginOptions
{
    internal const string FileName = "botnama-mcv.json";

    public bool Enabled { get; set; } = true;
    public string Endpoint { get; set; } = "http://localhost:2101/api/hooks/mcv/comments";
    public string AccessToken { get; set; } = string.Empty;
    public bool IncludeNgUsers { get; set; }
    public bool IncludeInitialComments { get; set; }
    public bool EnableRequestCreation { get; set; } = true;
    public int TimeoutSeconds { get; set; } = 10;
    public int MaxRetryCount { get; set; } = 3;
    public int RetryDelaySeconds { get; set; } = 3;

    public static PluginOptions CreateDefault() => new();

    public static PluginOptions Load(string path)
    {
        try
        {
            if (!File.Exists(path))
            {
                return CreateDefault();
            }
            var json = File.ReadAllText(path, Encoding.UTF8);
            var options = JsonConvert.DeserializeObject<PluginOptions>(json);
            return options ?? CreateDefault();
        }
        catch
        {
            return CreateDefault();
        }
    }

    public void Save(string path)
    {
        var dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrWhiteSpace(dir))
        {
            Directory.CreateDirectory(dir);
        }
        var json = JsonConvert.SerializeObject(this, Formatting.Indented);
        File.WriteAllText(path, json, Encoding.UTF8);
    }

    public PluginOptions Clone() => new()
    {
        Enabled = Enabled,
        Endpoint = Endpoint,
        AccessToken = AccessToken,
        IncludeNgUsers = IncludeNgUsers,
        IncludeInitialComments = IncludeInitialComments,
        EnableRequestCreation = EnableRequestCreation,
        TimeoutSeconds = TimeoutSeconds,
        MaxRetryCount = MaxRetryCount,
        RetryDelaySeconds = RetryDelaySeconds,
    };

    public void Normalize()
    {
        Endpoint = (Endpoint ?? string.Empty).Trim();
        TimeoutSeconds = Clamp(TimeoutSeconds, 5, 120);
        MaxRetryCount = Clamp(MaxRetryCount, 1, 10);
        RetryDelaySeconds = Clamp(RetryDelaySeconds, 1, 30);
    }

    private static int Clamp(int value, int min, int max)
    {
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }
}
