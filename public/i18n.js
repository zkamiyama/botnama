export const translations = {
  en: {
    summary_items: "Remain",
    pending_items: (n) => `${n}`,
    queue_count: (n) => `List ${n}`,
    tab_list: "Queue",
    tab_debug: "Debug",
    tab_comments: "Comments",
    tab_system: "System",
    tab_rules: "Rules",
    locale_auto: "Auto",
    locale_ja: "日本語",
    locale_en: "English",
    rule_enable: "Enable max duration",
    rule_max: "Max duration (minutes)",
    rule_no_duplicate: "Block duplicate requests",
    rule_cooldown: "Cooldown after playback (minutes)",
    rule_cooldown_hint: "0 = cannot request again until queue is cleared",
    rule_poll_enable: "Enable continuation poll",
    rule_poll_interval: "Ask every (sec)",
    rule_poll_window: "Voting window (sec)",
    rule_poll_stop_delay: "Stop delay after rejection (sec)",
    poll_question_title: "Continue?",
    poll_question_body: "Continue? (Yes/No)",
    poll_result_title: "Poll Result",
    poll_result_body: "Yes: {yes}% No: {no}%",
    poll_vote_yes: "Yes",
    poll_vote_no: "No",
    rule_save: "Save",
    rule_saved: "Saved",
    rule_save_failed: "Save failed",
    copy_link: "Copy link",
    copy_title: "Copy title",
    copied_link: "Link copied",
    copied_title: "Title copied",
    status_overlay_connected: "Overlay on",
    status_overlay_disconnected: "Overlay off",
    status_downloading: (n) => `DL: ${n}`,
    status_autoplay: (on) => `Auto: ${on ? "On" : "Off"}`,
    status_intake: (on) => `Request: ${on ? "On" : "Off"}`,
    request_accepted_title: "Request received",
    request_ready_title: "Request ready",
    request_failed_title: "Request failed",
    request_rejected_title: "Request rejected",
    request_stop_title: "Playback stopped",
    request_autoplay_paused_title: "Autoplay paused",
    request_autoplay_resumed_title: "Autoplay resumed",
    request_intake_paused_title: "Requests closed",
    request_intake_resumed_title: "Requests opened",
    request_stop_full: ({ url }) => `Stopped playback: ${url ?? ""}`,
    request_accepted_full: ({ url }) => `Request accepted: ${url ?? ""}`,
    request_play_title: "Now playing",
    stat_uploaded: "Pub: ",
    stat_duration: "Dur: ",
    stat_views: "Views: ",
    stat_comments: "Comments: ",
    stat_uploader: "By ",
    stat_likes: "Like: ",
    stat_dislikes: "Dislike: ",
    stat_mylist: "MyList: ",
    stat_favorites: "Fav: ",
    stat_danmaku: "Danmaku: ",
    stat_fetched: "As of ",
    ctx_suspend: "Suspend selection",
    ctx_resume: "Resume selection",
    body_url_only: ({ url }) => url ?? "",
    body_with_reason: ({ reason, url }) => `${reason ?? ""} (${url ?? ""})`,
    btn_stop: "Stop",
    btn_auto: "AUTO",
    btn_intake: "Requests",
    btn_skip: "Skip",
    btn_refresh: "Refresh",
    btn_clear: "Clear all",
    btn_pause: "Pause",
    btn_resume: "Resume",
    seek_back: "-10s",
    seek_forward: "+10s",
    comment_label: "Debug Comment",
    comment_placeholder: "Enter a comment (URL registers a request)",
    user_label: "User (optional)",
    user_placeholder: "Anonymous",
    comment_submit: "Send",
    msg_comment_required: "Please enter a comment",
    msg_seek_fail: (msg) => `Seek failed: ${msg}`,
    msg_stop_fail: (msg) => `Stop failed: ${msg}`,
    msg_auto_fail: (msg) => `AUTO toggle failed: ${msg}`,
    msg_intake_fail: (msg) => `Request toggle failed: ${msg}`,
    msg_pause_fail: (msg) => `Pause toggle failed: ${msg}`,
    msg_stream_retry: "Live updates disconnected. Reconnecting...",
    msg_eventsource_fallback: "EventSource unsupported. Falling back to polling.",
    msg_selection_none: "Select at least one item",
    msg_suspend_done: (n) => `Suspended ${n} item(s)` ,
    msg_resume_done: (n) => `Resumed ${n} item(s)` ,
    msg_suspend_fail: (msg) => `Action failed: ${msg}` ,
    msg_comment_saved: "Comment saved",
    msg_request_registered: (id) => `Registered: ${id}`,
    msg_update_fail: (msg) => `Update failed: ${msg}` ,
    msg_send_fail: (msg) => `Send failed: ${msg}` ,
    msg_clear_fail: (msg) => `Clear failed: ${msg}` ,
    msg_skip_fail: (msg) => `Skip failed: ${msg}` ,
    msg_reorder_fail: (msg) => `Reorder failed: ${msg}` ,
    msg_parse_fail: "Failed to parse live update" ,
    msg_action_fail: ({ label, msg }) => `${label ?? "Action"} failed: ${msg ?? ""}` ,
    reason_duplicate_in_queue: ({ url }) => `Already requested: ${url ?? ""}`,
    reason_cooldown_wait: ({ minutes, url }) => minutes === 0
      ? `Please remove from queue before requesting again. (${url ?? ""})`
      : `You can request again in ${minutes} min. (${url ?? ""})`,
    confirm_delete_all: "Delete all items?",
    tooltip_suspend_origin: ({ reason }) => `Suspended (from: ${reason ?? ""})`,
    tooltip_suspend_plain: "Suspended",
    anonymous_user: "Anonymous",
    queue_empty: "Queue is empty",
    comments_empty: "No comments",
    comments_header_time: "Time",
    comments_header_user: "User",
    comments_header_body: "Body",
    queue_title_loading: "Loading title",
    system_in_use: "yt-dlp (in use)",
    system_latest: "yt-dlp latest",
    system_ejs: "yt-dlp-ejs",
    system_update_btn: "Update",
    system_refresh_ejs_btn: "Refresh",
    status_label_queued: "Queued",
    status_label_validating: "Validating",
    status_label_downloading: "Downloading",
    status_label_ready: "Ready",
    status_label_playing: "Playing",
    status_label_done: "Done",
    status_label_failed: "Failed",
    status_label_rejected: "Rejected",
    status_label_suspend: "Suspended",
  },
  ja: {
    summary_items: "残",
    pending_items: (n) => `${n}`,
    queue_count: (n) => `リスト ${n}件`,
    tab_list: "再生リスト",
    tab_debug: "デバッグ",
    tab_comments: "コメント",
    tab_system: "システム",
    tab_rules: "ルール",
    locale_auto: "自動",
    locale_ja: "日本語",
    locale_en: "英語",
    rule_enable: "動画長さ制限を有効にする",
    rule_max: "最大再生時間 (分)",
    rule_no_duplicate: "重複リクエストを禁止する",
    rule_cooldown: "再生後のクーリングタイム (分)",
    rule_cooldown_hint: "0分 = キューから削除しない限り再リクエスト不可",
    rule_poll_enable: "継続アンケートを有効にする",
    rule_poll_interval: "アンケート間隔 (秒)",
    rule_poll_window: "投票受付時間 (秒)",
    rule_poll_stop_delay: "否決後の停止遅延 (秒)",
    poll_question_title: "継続しますか？",
    poll_question_body: "継続しますか？ (いいよ/やめよ)",
    poll_result_title: "アンケート結果",
    poll_result_body: "いいよ: {yes}% やめよ: {no}%",
    poll_vote_yes: "いいよ",
    poll_vote_no: "やめよ",
    rule_save: "保存",
    rule_saved: "保存しました",
    rule_save_failed: "保存に失敗しました",
    copy_link: "リンクをコピー",
    copy_title: "タイトルをコピー",
    copied_link: "リンクをコピーしました",
    copied_title: "タイトルをコピーしました",
    status_overlay_connected: "Overlay接続中",
    status_overlay_disconnected: "Overlay未接続",
    status_downloading: (n) => `DL中: ${n}件`,
    status_autoplay: (on) => `自動再生: ${on ? "稼働中" : "停止中"}`,
    status_intake: (on) => `リクエスト: ${on ? "受付中" : "停止中"}`,
    request_accepted_title: "リクエストを受け付けました",
    request_ready_title: "リクエストを準備しました",
    request_failed_title: "リクエスト処理に失敗しました",
    request_rejected_title: "リクエストを拒否しました",
    request_stop_title: "再生を停止しました",
    request_autoplay_paused_title: "自動再生を停止しました",
    request_autoplay_resumed_title: "自動再生を再開しました",
    request_intake_paused_title: "リクエスト受付を停止しました",
    request_intake_resumed_title: "リクエスト受付を再開しました",
    request_stop_full: ({ url }) => `再生を停止しました: ${url ?? ""}`,
    request_accepted_full: ({ url }) => `リクエストを受け付けました: ${url ?? ""}`,
    request_play_title: "再生開始",
    stat_uploaded: "投稿: ",
    stat_duration: "時間: ",
    stat_views: "再生: ",
    stat_comments: "コメント: ",
    stat_uploader: "投稿者: ",
    stat_likes: "いいね: ",
    stat_dislikes: "バッド: ",
    stat_mylist: "マイリスト: ",
    stat_favorites: "お気に入り: ",
    stat_danmaku: "弾幕: ",
    stat_fetched: "取得: ",
    ctx_suspend: "選択を保留にする",
    ctx_resume: "選択の保留を解除",
    body_url_only: ({ url }) => url ?? "",
    body_with_reason: ({ reason, url }) => `${reason ?? ""} (${url ?? ""})`,
    btn_stop: "停止",
    btn_auto: "AUTO",
    btn_intake: "受付",
    btn_skip: "スキップ",
    btn_refresh: "更新",
    btn_clear: "全削除",
    btn_pause: "一時停止",
    btn_resume: "再開",
    seek_back: "-10秒",
    seek_forward: "+10秒",
    comment_label: "コメテスト",
    comment_placeholder: "コメントを入力（URLを含めるとリクエスト登録）",
    user_label: "投稿者名（任意）",
    user_placeholder: "匿名",
    comment_submit: "送信",
    msg_comment_required: "コメントを入力してください",
    msg_seek_fail: (msg) => `シークに失敗: ${msg}`,
    msg_stop_fail: (msg) => `停止に失敗: ${msg}`,
    msg_auto_fail: (msg) => `AUTO切替に失敗: ${msg}`,
    msg_intake_fail: (msg) => `受付切替に失敗: ${msg}`,
    msg_pause_fail: (msg) => `一時停止の切替に失敗: ${msg}`,
    msg_stream_retry: "ライブ更新ストリームから切断されました。再接続します...",
    msg_eventsource_fallback: "EventSource が未対応のため、ポーリングにフォールバックします",
    msg_selection_none: "対象を選択してください",
    msg_suspend_done: (n) => `${n}件を保留にしました` ,
    msg_resume_done: (n) => `${n}件の保留を解除しました` ,
    msg_suspend_fail: (msg) => `操作に失敗しました: ${msg}` ,
    msg_comment_saved: "コメントを保存しました",
    msg_request_registered: (id) => `登録しました: ${id}` ,
    msg_update_fail: (msg) => `更新に失敗しました: ${msg}` ,
    msg_send_fail: (msg) => `送信失敗: ${msg}` ,
    msg_clear_fail: (msg) => `全削除に失敗: ${msg}` ,
    msg_skip_fail: (msg) => `スキップに失敗: ${msg}` ,
    msg_reorder_fail: (msg) => `順番変更に失敗: ${msg}` ,
    msg_parse_fail: "ライブ更新データの解析に失敗しました" ,
    msg_action_fail: ({ label, msg }) => `${label ?? "操作"}に失敗しました: ${msg ?? ""}` ,
    reason_duplicate_in_queue: ({ url }) => `${url ?? ""} はすでにリクエスト済みです`,
    reason_cooldown_wait: ({ minutes, url }) => minutes === 0
      ? `キューから削除するまで再リクエストできません (${url ?? ""})`
      : `${minutes}分後に再度リクエストできます (${url ?? ""})`,
    confirm_delete_all: "再生リストをすべて削除しますか？",
    tooltip_suspend_origin: ({ reason }) => `保留中 (元: ${reason ?? ""})`,
    tooltip_suspend_plain: "保留中",
    anonymous_user: "匿名",
    queue_empty: "キューは空です",
    comments_empty: "コメントはありません",
    comments_header_time: "時刻",
    comments_header_user: "投稿者",
    comments_header_body: "本文",
    queue_title_loading: "タイトル取得中",
    system_in_use: "yt-dlp (使用中)",
    system_latest: "yt-dlp 最新リリース",
    system_ejs: "yt-dlp-ejs",
    system_update_btn: "アップデート",
    system_refresh_ejs_btn: "更新",
    status_label_queued: "待機中",
    status_label_validating: "検証中",
    status_label_downloading: "DL中",
    status_label_ready: "準備完了",
    status_label_playing: "再生中",
    status_label_done: "再生済",
    status_label_failed: "エラー",
    status_label_rejected: "拒否",
    status_label_suspend: "保留",
  },
};

let resolved = null;
let chosen = "auto";
const STORAGE_KEY = "botnama_locale";

const format = (template, params = {}) => {
  if (typeof template !== "string") return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => {
    const v = params?.[k];
    return v === undefined || v === null ? "" : String(v);
  });
};

export const setLocale = (loc) => {
  chosen = loc || "auto";
  if (chosen === "auto") {
    resolved = null;
  } else {
    resolved = chosen.toLowerCase().startsWith("ja") ? "ja" : "en";
  }
  try {
    localStorage.setItem(STORAGE_KEY, chosen);
  } catch (_) {
    // ignore
  }
};

export const getLocale = () => resolved || "en";

export const detectLocale = async () => {
  if (resolved) return resolved;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setLocale(stored);
      if (resolved) return resolved;
    }
  } catch (_) {}
  try {
    const res = await fetch('/api/locale');
    if (res.ok) {
      const data = await res.json();
      if (data?.locale) setLocale(data.locale);
    }
  } catch (_) {}
  if (!resolved) {
    const nav = navigator.language || navigator.userLanguage || 'en';
    setLocale(nav);
  }
  return resolved;
};

export const t = (key, params) => {
  const locale = resolved || 'en';
  const dict = translations[locale] || translations.en;
  const entry = dict[key] ?? translations.en[key] ?? key;
  if (typeof entry === 'function') return entry(params ?? {});
  return format(entry, params);
};
