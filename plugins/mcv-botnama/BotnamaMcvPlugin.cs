#nullable enable

using System;
using System.Collections.Concurrent;
using System.ComponentModel.Composition;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Newtonsoft.Json;
using Plugin;
using PluginCommon;
using SitePlugin;

namespace MCV.Botnama.Plugin;

[Export(typeof(IPlugin))]
public sealed class BotnamaMcvPlugin : IPlugin, IDisposable
{
    private const int QueueCapacity = 200;
    private static readonly JsonSerializerSettings SerializerSettings = new()
    {
        NullValueHandling = NullValueHandling.Ignore,
    };

    private static bool _visualStylesInitialized;

    private readonly BlockingCollection<McvCommentEnvelope> _queue =
        new(new ConcurrentQueue<McvCommentEnvelope>(), QueueCapacity);

    private CancellationTokenSource? _cts;
    private Task? _workerTask;
    private HttpClient? _httpClient;
    private string? _settingsPath;
    private string? _logPath;
    private volatile PluginOptions _options = PluginOptions.CreateDefault();

    public string Name => "Botnama Bridge";
    public string Description => "Botnamaサーバーへコメントを転送します";

    public IPluginHost Host { get; set; } = null!;

    public void OnMessageReceived(ISiteMessage message, IMessageMetadata messageMetadata)
    {
        if (!_options.Enabled) return;
        if (message is null || messageMetadata is null) return;
        if (messageMetadata.IsNgUser && !_options.IncludeNgUsers) return;
        if (messageMetadata.IsInitialComment && !_options.IncludeInitialComments) return;

        var (extractedName, commentBody) = Tools.GetData(message);
        if (string.IsNullOrWhiteSpace(commentBody)) return;

        var userName = ResolveUserName(messageMetadata, extractedName);
        var envelope = McvCommentEnvelope.Create(message, messageMetadata, commentBody, userName, _options);

        if (!_queue.TryAdd(envelope))
        {
            Log("送信キューが満杯のためコメントを破棄しました。");
        }
    }

    public void OnLoaded()
    {
        if (!_visualStylesInitialized)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            _visualStylesInitialized = true;
        }
        try
        {
            ApplyOptions(PluginOptions.Load(GetSettingsPath()));
        }
        catch (Exception ex)
        {
            Log("設定の読み込みに失敗しました。デフォルト設定を適用します。", ex);
            ApplyOptions(PluginOptions.CreateDefault());
        }
        StartWorker();
    }
    public void OnClosing()
    {
        Dispose();
    }

    public void ShowSettingView()
    {
        using var form = new SettingsForm(_options.Clone());
        if (form.ShowDialog() == System.Windows.Forms.DialogResult.OK)
        {
            ApplyOptions(form.Result);
        }
    }

    public void OnTopmostChanged(bool isTopmost)
    {
        // Not required.
    }

    public void Dispose()
    {
        StopWorker();
        _queue.CompleteAdding();
        _queue.Dispose();
        _httpClient?.Dispose();
    }

    private void StartWorker()
    {
        StopWorker();
        _cts = new CancellationTokenSource();
        _workerTask = Task.Run(() => ProcessQueueAsync(_cts.Token));
    }

    private void StopWorker()
    {
        _cts?.Cancel();
        if (_workerTask != null)
        {
            try
            {
                _workerTask.Wait(TimeSpan.FromSeconds(2));
            }
            catch
            {
                // ignore
            }
        }
        _workerTask = null;
        _cts?.Dispose();
        _cts = null;
        while (_queue.TryTake(out _, 0)) { }
    }

    private async Task ProcessQueueAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            McvCommentEnvelope envelope;
            try
            {
                envelope = _queue.Take(token);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (InvalidOperationException)
            {
                break;
            }

            try
            {
                await SendAsync(envelope, token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                Log(
                    $"コメント送信に失敗しました (attempt={envelope.Attempt + 1}/{_options.MaxRetryCount}).",
                    ex,
                    includeException: true);
                if (envelope.Attempt + 1 >= _options.MaxRetryCount)
                {
                    continue;
                }
                envelope.Attempt++;
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(_options.RetryDelaySeconds), token).ConfigureAwait(false);
                    _queue.Add(envelope, token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private async Task SendAsync(McvCommentEnvelope envelope, CancellationToken token)
    {
        var options = _options;
        if (string.IsNullOrWhiteSpace(options.Endpoint))
        {
            throw new InvalidOperationException("エンドポイントURLが設定されていません。");
        }
        var client = _httpClient ?? throw new InvalidOperationException("HTTPクライアントが初期化されていません。");
        var payload = envelope.ToPayload();
        var json = JsonConvert.SerializeObject(payload, SerializerSettings);
        using var request = new HttpRequestMessage(HttpMethod.Post, options.Endpoint)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        if (!string.IsNullOrWhiteSpace(options.AccessToken))
        {
            request.Headers.TryAddWithoutValidation("X-Botnama-MCV-Token", options.AccessToken);
        }
        using var response = await client.SendAsync(request, token).ConfigureAwait(false);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            throw new InvalidOperationException(
                $"HTTP {(int)response.StatusCode} {response.ReasonPhrase} : {body}");
        }
    }

    private static string? ResolveUserName(IMessageMetadata metadata, string? fallback)
    {
        if (metadata?.User != null)
        {
            var nickname = metadata.User.Nickname;
            if (!string.IsNullOrWhiteSpace(nickname))
            {
                return nickname;
            }
        }
        return string.IsNullOrWhiteSpace(fallback) ? null : fallback;
    }

    private void ApplyOptions(PluginOptions updated)
    {
        updated.Normalize();
        _options = updated.Clone();
        updated.Save(GetSettingsPath());
        _httpClient?.Dispose();
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(_options.TimeoutSeconds),
        };
        Log($"設定を更新しました。エンドポイント={_options.Endpoint}");
    }

    private string GetSettingsDirectory()
    {
        var path = Host?.SettingsDirPath;
        if (string.IsNullOrWhiteSpace(path))
        {
            path = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Botnama");
        }
        Directory.CreateDirectory(path!);
        return path!;
    }

    private string GetSettingsPath()
    {
        if (_settingsPath is { Length: > 0 })
        {
            return _settingsPath;
        }
        var path = Path.Combine(GetSettingsDirectory(), PluginOptions.FileName);
        _settingsPath = path;
        return path;
    }

    private string GetLogPath()
    {
        if (_logPath is { Length: > 0 })
        {
            return _logPath;
        }
        var path = Path.Combine(GetSettingsDirectory(), "botnama-mcv.log");
        _logPath = path;
        return path;
    }

    private void Log(string message, Exception? ex = null, bool includeException = false)
    {
        try
        {
            var line = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}";
            if (includeException && ex != null)
            {
                line += $" :: {ex}";
            }
            File.AppendAllText(GetLogPath(), line + Environment.NewLine, Encoding.UTF8);
        }
        catch
        {
            // ignore logging errors
        }
    }

    private sealed class McvCommentEnvelope
    {
        private McvCommentEnvelope(
            string id,
            string siteType,
            string comment,
            string raw,
            string? roomId,
            string? userId,
            string? userName,
            long timestamp,
            object metadata,
            bool includeNgUsers,
            bool includeInitialComments,
            bool allowRequestCreation)
        {
            Id = id;
            SiteType = siteType;
            Comment = comment;
            Raw = raw;
            RoomId = roomId;
            UserId = userId;
            UserName = userName;
            Timestamp = timestamp;
            Metadata = metadata;
            IncludeNgUsers = includeNgUsers;
            IncludeInitialComments = includeInitialComments;
            AllowRequestCreation = allowRequestCreation;
        }

        public string Id { get; }
        public string SiteType { get; }
        public string Comment { get; }
        public string Raw { get; }
        public string? RoomId { get; }
        public string? UserId { get; }
        public string? UserName { get; }
        public long Timestamp { get; }
        public object Metadata { get; }
        public bool IncludeNgUsers { get; }
        public bool IncludeInitialComments { get; }
        public bool AllowRequestCreation { get; }
        public int Attempt { get; set; }

        public static McvCommentEnvelope Create(
            ISiteMessage message,
            IMessageMetadata metadata,
            string comment,
            string? userName,
            PluginOptions options)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var siteGuid = metadata.SiteContextGuid;
            var metadataPayload = new
            {
                metadata.IsNgUser,
                metadata.IsSiteNgUser,
                metadata.IsFirstComment,
                metadata.IsInitialComment,
                metadata.Is184,
            };
            return new McvCommentEnvelope(
                Guid.NewGuid().ToString("N"),
                message.SiteType.ToString(),
                comment.Trim(),
                string.IsNullOrWhiteSpace(message.Raw) ? comment : message.Raw,
                siteGuid == Guid.Empty ? null : siteGuid.ToString(),
                metadata.User?.UserId,
                userName,
                timestamp,
                metadataPayload,
                options.IncludeNgUsers,
                options.IncludeInitialComments,
                options.EnableRequestCreation);
        }

        public object ToPayload() => new
        {
            messageId = Id,
            siteType = SiteType,
            roomId = RoomId,
            userId = UserId,
            userName = UserName,
            comment = Comment,
            raw = Raw,
            timestamp = Timestamp,
            metadata = Metadata,
            includeNgUsers = IncludeNgUsers,
            includeInitialComments = IncludeInitialComments,
            allowRequestCreation = AllowRequestCreation,
        };
    }
}
