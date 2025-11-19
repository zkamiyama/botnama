#nullable enable

using System;
using System.Drawing;
using System.Windows.Forms;

namespace MCV.Botnama.Plugin;

internal sealed class SettingsForm : Form
{
    private readonly TextBox _endpointTextBox = new() { Width = 360 };
    private readonly TextBox _tokenTextBox = new() { Width = 360, UseSystemPasswordChar = true };
    private readonly CheckBox _enabledCheckBox = CreateCheckBox("プラグインを有効化");
    private readonly CheckBox _ngCheckBox = CreateCheckBox("NGユーザーを送信対象に含める");
    private readonly CheckBox _initialCheckBox = CreateCheckBox("初期コメントを送信対象に含める");
    private readonly CheckBox _requestCheckBox = CreateCheckBox("コメント中のURLを自動的にリクエスト登録する");
    private readonly NumericUpDown _timeoutNumeric = new() { Minimum = 5, Maximum = 120, Width = 80 };
    private readonly NumericUpDown _retryNumeric = new() { Minimum = 1, Maximum = 10, Width = 80 };
    private readonly NumericUpDown _retryDelayNumeric = new() { Minimum = 1, Maximum = 30, Width = 80 };

    internal PluginOptions Result { get; private set; }

    public SettingsForm(PluginOptions options)
    {
        Result = options.Clone();
        Text = "Botnama Bridge 設定";
        StartPosition = FormStartPosition.CenterParent;
        AutoScaleMode = AutoScaleMode.Font;
        Font = SystemFonts.MessageBoxFont;
        AutoSize = true;
        AutoSizeMode = AutoSizeMode.GrowAndShrink;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        Padding = new Padding(12);

        _endpointTextBox.Text = Result.Endpoint;
        _tokenTextBox.Text = Result.AccessToken;
        _enabledCheckBox.Checked = Result.Enabled;
        _ngCheckBox.Checked = Result.IncludeNgUsers;
        _initialCheckBox.Checked = Result.IncludeInitialComments;
        _requestCheckBox.Checked = Result.EnableRequestCreation;
        _timeoutNumeric.Value = Result.TimeoutSeconds;
        _retryNumeric.Value = Result.MaxRetryCount;
        _retryDelayNumeric.Value = Result.RetryDelaySeconds;

        var layout = new TableLayoutPanel
        {
            ColumnCount = 2,
            AutoSize = true,
            Dock = DockStyle.Fill,
        };

        layout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));

        layout.Controls.Add(new Label { Text = "エンドポイントURL", AutoSize = true }, 0, 0);
        layout.Controls.Add(_endpointTextBox, 1, 0);
        layout.Controls.Add(new Label { Text = "共有トークン (任意)", AutoSize = true }, 0, 1);
        layout.Controls.Add(_tokenTextBox, 1, 1);
        layout.Controls.Add(new Label { Text = "HTTPタイムアウト (秒)", AutoSize = true }, 0, 2);
        layout.Controls.Add(_timeoutNumeric, 1, 2);
        layout.Controls.Add(new Label { Text = "再試行回数", AutoSize = true }, 0, 3);
        layout.Controls.Add(_retryNumeric, 1, 3);
        layout.Controls.Add(new Label { Text = "再試行間隔 (秒)", AutoSize = true }, 0, 4);
        layout.Controls.Add(_retryDelayNumeric, 1, 4);

        var checkboxLayout = new TableLayoutPanel
        {
            ColumnCount = 1,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 6, 0, 0),
        };
        checkboxLayout.Controls.Add(_enabledCheckBox, 0, 0);
        checkboxLayout.Controls.Add(_ngCheckBox, 0, 1);
        checkboxLayout.Controls.Add(_initialCheckBox, 0, 2);
        checkboxLayout.Controls.Add(_requestCheckBox, 0, 3);
        layout.Controls.Add(checkboxLayout, 0, 5);
        layout.SetColumnSpan(checkboxLayout, 2);

        var buttonPanel = new FlowLayoutPanel
        {
            FlowDirection = FlowDirection.RightToLeft,
            Dock = DockStyle.Fill,
            AutoSize = true,
            Padding = new Padding(0, 12, 0, 0),
        };

        var okButton = new Button { Text = "保存", DialogResult = DialogResult.OK };
        okButton.Click += (_, _) => SaveAndClose();
        var cancelButton = new Button { Text = "キャンセル", DialogResult = DialogResult.Cancel };
        cancelButton.Click += (_, _) => Close();

        buttonPanel.Controls.Add(okButton);
        buttonPanel.Controls.Add(cancelButton);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoSize = true,
            RowCount = 2,
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        root.Controls.Add(layout, 0, 0);
        root.Controls.Add(buttonPanel, 0, 1);

        Controls.Add(root);
        AcceptButton = okButton;
        CancelButton = cancelButton;
    }

    private static CheckBox CreateCheckBox(string text) => new()
    {
        Text = text,
        AutoSize = true,
        AutoEllipsis = true,
        Anchor = AnchorStyles.Left,
        Margin = new Padding(0, 3, 0, 0),
    };

    private void SaveAndClose()
    {
        Result = new PluginOptions
        {
            Endpoint = _endpointTextBox.Text.Trim(),
            AccessToken = _tokenTextBox.Text.Trim(),
            Enabled = _enabledCheckBox.Checked,
            IncludeNgUsers = _ngCheckBox.Checked,
            IncludeInitialComments = _initialCheckBox.Checked,
            EnableRequestCreation = _requestCheckBox.Checked,
            TimeoutSeconds = Convert.ToInt32(_timeoutNumeric.Value),
            MaxRetryCount = Convert.ToInt32(_retryNumeric.Value),
            RetryDelaySeconds = Convert.ToInt32(_retryDelayNumeric.Value),
        };
        DialogResult = DialogResult.OK;
        Close();
    }
}

