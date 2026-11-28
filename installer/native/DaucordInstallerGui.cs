/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace Daucord
{
    public class MainForm : Form
    {
        const int CW = 940;
        const int CH = 750;
        const string UpdateText = "already installed? click this text to update it to latest version.";

        class Btn
        {
            public string Id;
            public string Label;
            public Rectangle R;
            public bool Primary;

            public Btn(string id, string label, Rectangle r, bool primary)
            {
                Id = id;
                Label = label;
                R = r;
                Primary = primary;
            }
        }

        class LogEntry
        {
            public string Text;
            public Color Color;

            public LogEntry(string text, Color color)
            {
                Text = text;
                Color = color;
            }
        }

        class Particle
        {
            public float X;
            public float Y;
            public float V;
            public float S;
            public float A;
            public float P;
        }

        List<Install> installs = new List<Install>();
        List<string> dropItems = new List<string>();
        List<int> dropMap = new List<int>();
        List<Btn> buttons = new List<Btn>();
        List<LogEntry> logLines = new List<LogEntry>();
        List<Particle> particles = new List<Particle>();
        Random rnd = new Random();

        Dictionary<string, float> hover = new Dictionary<string, float>();
        string hoverId = "";
        string pressId = "";
        bool dropdownOpen;
        int dropHover = -1;
        int selected = -1;
        bool busy;
        float time;
        float busyT;
        float toastAt = -100f;
        string toastText = "";
        bool toastOk = true;
        int logScroll;

        Image logo;
        Image hero;
        Bitmap heroBmp;
        Bitmap bgBmp;
        float bgAt = -10f;
        System.Windows.Forms.Timer timer;
        Stopwatch clock;

        string statusTitle = "Checking status…";
        string statusSub = "";
        Color statusColor = Ui.TextDim;
        string badgeText = "…";
        Color badgeColor = Ui.TextDim;

        Rectangle rStatus = new Rectangle(48, 318, CW - 96, 78);
        Rectangle rSelect = new Rectangle(48, 428, 470, 46);
        Rectangle rUpdate;
        Rectangle rLog = new Rectangle(48, 584, CW - 96, 116);
        Rectangle rClear;
        Rectangle rClose = new Rectangle(CW - 54, 8, 40, 32);
        Rectangle rMin = new Rectangle(CW - 98, 8, 40, 32);
        Rectangle rRefresh = new Rectangle(848, 492, 44, 46);

        public bool SelfTest()
        {
            CreateControl();
            return logo != null && hero != null;
        }

        public MainForm()
        {
            Text = "Daucord Installer";
            ClientSize = new Size(CW, CH);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.None;
            MaximizeBox = false;
            MinimizeBox = false;
            KeyPreview = true;
            DoubleBuffered = true;
            AutoScaleMode = AutoScaleMode.None;
            BackColor = Ui.Bg;
            ForeColor = Ui.Text;
            Font = Ui.Font(12f);
            Opacity = 0;

            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.UserPaint | ControlStyles.ResizeRedraw, true);

            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); }
            catch { }

            logo = LoadImage("Daucord.logo256.png");
            hero = LoadImage("Daucord.hero.jpg");

            rClear = new Rectangle(rLog.Right - 84, rLog.Y + 10, 66, 20);
            rUpdate = new Rectangle(48, 548, Ui.Measure(UpdateText, Ui.Font(11.5f)).Width + 54, 30);

            buttons.Add(new Btn("install", "Install", new Rectangle(48, 492, 168, 46), true));
            buttons.Add(new Btn("uninstall", "Uninstall", new Rectangle(228, 492, 132, 46), false));
            buttons.Add(new Btn("repair", "Repair", new Rectangle(372, 492, 120, 46), false));
            buttons.Add(new Btn("status", "Status", new Rectangle(504, 492, 120, 46), false));
            buttons.Add(new Btn("migrate", "Migrate settings", new Rectangle(636, 492, 176, 46), false));

            foreach (Btn b in buttons) hover[b.Id] = 0f;
            hover["refresh"] = 0f;
            hover["select"] = 0f;
            hover["close"] = 0f;
            hover["min"] = 0f;
            hover["clear"] = 0f;
            hover["update"] = 0f;

            LoadInstalls(true);

            for (int i = 0; i < 26; i++)
            {
                particles.Add(new Particle
                {
                    X = rnd.Next(0, CW),
                    Y = rnd.Next(320, CH),
                    V = 4f + (float)rnd.NextDouble() * 9f,
                    S = 1.1f + (float)rnd.NextDouble() * 1.6f,
                    A = 10f + rnd.Next(22),
                    P = (float)rnd.NextDouble() * 6.28f
                });
            }

            clock = Stopwatch.StartNew();
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 16;
            timer.Tick += Tick;
            timer.Start();
        }

        static Image LoadImage(string name)
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream st = asm.GetManifestResourceStream(name))
                {
                    if (st == null) return null;
                    using (Image img = Image.FromStream(st))
                        return new Bitmap(img);
                }
            }
            catch { return null; }
        }

        protected override void OnHandleCreated(EventArgs e)
        {
            base.OnHandleCreated(e);
            try
            {
                int pref = 2;
                int hr = Native.DwmSetWindowAttribute(Handle, 33, ref pref, 4);
                Native.Margins m = new Native.Margins();
                m.Left = 1;
                m.Right = 1;
                m.Top = 1;
                m.Bottom = 1;
                Native.DwmExtendFrameIntoClientArea(Handle, ref m);

                if (hr != 0)
                {
                    using (GraphicsPath p = Ui.Round(new Rectangle(0, 0, Width, Height), 14))
                        Region = new Region(p);
                }
            }
            catch { }
        }

        protected override void OnPaintBackground(PaintEventArgs e)
        {
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            Graphics g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            PaintBackground(g);
            PaintChrome(g);
            PaintHero(g);
            PaintStatus(g);
            PaintSelect(g);
            PaintButtons(g);
            PaintUpdate(g);
            PaintLog(g);
            PaintFooter(g);
            if (dropdownOpen) PaintDropdown(g);
            PaintToast(g);
        }

        void Tick(object sender, EventArgs e)
        {
            float dt = 0.016f;
            time += dt;
            if (Opacity < 1f) Opacity = Math.Min(1f, Opacity + dt * 5f);
            if (busy) busyT += dt;

            List<string> keys = new List<string>(hover.Keys);
            foreach (string k in keys)
            {
                float target = (hoverId == k && !busy) ? 1f : 0f;
                float v = hover[k];
                hover[k] = v + (target - v) * Math.Min(1f, dt * 13f);
            }

            foreach (Particle p in particles)
            {
                p.Y -= p.V * dt;
                if (p.Y < 300f)
                {
                    p.Y = CH + 12f;
                    p.X = rnd.Next(0, CW);
                }
            }

            Invalidate();
        }

        float Hover(string id)
        {
            float v;
            return hover.TryGetValue(id, out v) ? v : 0f;
        }

        // ---------- data ----------

        void LoadInstalls(bool writeLog)
        {
            string keepKey = null;
            if (selected >= 0 && selected < installs.Count) keepKey = installs[selected].Key;

            installs = Core.FindInstalls("all", null);

            dropItems.Clear();
            dropMap.Clear();
            if (installs.Count > 1)
            {
                dropItems.Add("All (detected branches)");
                dropMap.Add(-1);
            }
            for (int i = 0; i < installs.Count; i++)
            {
                dropItems.Add(installs[i].Name + "  (" + installs[i].Version + ")");
                dropMap.Add(i);
            }

            selected = -1;
            if (keepKey != null)
            {
                for (int i = 0; i < installs.Count; i++)
                    if (installs[i].Key == keepKey) selected = i;
            }
            if (selected < 0)
            {
                for (int i = 0; i < installs.Count; i++)
                    if (installs[i].Key == "stable") selected = i;
            }
            if (selected < 0 && installs.Count > 0) selected = 0;

            UpdateStatus();

            if (writeLog)
            {
                AppendLog("Daucord Installer");
                if (installs.Count == 0)
                {
                    AppendLog("No Discord installation found.");
                    AppendLog("Is the Discord desktop app installed?");
                }
                else
                {
                    AppendLog("Detected installations:");
                    foreach (Install i in installs) AppendLog("  " + Core.StatusText(i));
                    AppendLog("");
                    AppendLog("Ready. Press Install to set up Daucord.");
                }
            }
        }

        List<Install> SelectedTargets()
        {
            if (selected < 0) return new List<Install>(installs);
            if (selected < installs.Count) return new List<Install> { installs[selected] };
            return new List<Install>();
        }

        int DropIndexFor(int installIndex)
        {
            for (int i = 0; i < dropMap.Count; i++)
                if (dropMap[i] == installIndex) return i;
            return 0;
        }

        void UpdateStatus()
        {
            List<Install> t = SelectedTargets();
            if (t.Count == 0)
            {
                statusTitle = "Discord not found";
                statusSub = "Is the Discord desktop app installed?";
                statusColor = Ui.Danger;
                badgeText = "NONE";
                badgeColor = Ui.Danger;
                return;
            }

            Install i = t[0];
            State s = Core.Inspect(i);

            if (s.IsDaucord)
            {
                statusTitle = "Daucord is installed";
                statusColor = Ui.Success;
                badgeText = "DAUCORD INSTALLED";
                badgeColor = Ui.Success;
            }
            else if (s.IsPatched)
            {
                statusTitle = "Another mod is installed";
                statusColor = Ui.Warn;
                badgeText = "MOD INSTALLED";
                badgeColor = Ui.Warn;
            }
            else if (s.Kind == "missing")
            {
                statusTitle = "app.asar not found";
                statusColor = Ui.Danger;
                badgeText = "UNKNOWN";
                badgeColor = Ui.Danger;
            }
            else
            {
                statusTitle = "Clean installation";
                statusColor = Ui.TextDim;
                badgeText = "CLEAN";
                badgeColor = Ui.TextDim;
            }

            if (t.Count > 1) statusTitle = statusTitle + "  ·  " + t.Count + " installs";
            statusSub = i.Name + "  ·  " + i.Version + "  ·  " + (s.Kind == "folder" ? "folder" : (s.Kind == "file" ? "archive" : "unknown"));
        }

        // ---------- actions ----------

        void Execute(string id)
        {
            if (busy) return;

            if (id == "install")
            {
                RunOp("Installation", delegate(Install i, Action<string> log) { return Core.Install(i, false, false, log); });
            }
            else if (id == "uninstall")
            {
                RunOp("Uninstall", delegate(Install i, Action<string> log) { return Core.Uninstall(i, false, false, log); });
            }
            else if (id == "repair")
            {
                RunOp("Repair", delegate(Install i, Action<string> log) { return Core.Install(i, true, false, log); });
            }
            else if (id == "status")
            {
                AppendLog("");
                AppendLog("=== Status ===");
                foreach (Install i in installs) AppendLog("  " + Core.StatusText(i));
                Toast("Status refreshed", true);
            }
            else if (id == "migrate")
            {
                RunMigrate();
            }
            else if (id == "update")
            {
                RunUpdate();
            }
            else if (id == "refresh")
            {
                LoadInstalls(false);
                Toast("Installations refreshed", true);
            }
            else if (id == "select")
            {
                if (installs.Count == 0) return;
                dropdownOpen = !dropdownOpen;
                dropHover = -1;
            }
            else if (id == "clear")
            {
                logLines.Clear();
                logScroll = 0;
            }
            else if (id == "min")
            {
                WindowState = FormWindowState.Minimized;
            }
            else if (id == "close")
            {
                Close();
            }

            Invalidate();
        }

        void RunOp(string title, Func<Install, Action<string>, bool> op)
        {
            List<Install> targets = SelectedTargets();
            if (targets.Count == 0) return;

            busy = true;
            busyT = 0f;
            dropdownOpen = false;
            AppendLog("");
            AppendLog("=== " + title + " ===");

            ThreadPool.QueueUserWorkItem(delegate
            {
                List<string> lines = new List<string>();
                Action<string> log = delegate(string s) { lock (lines) { lines.Add(s); } };

                bool ok = true;
                try
                {
                    foreach (Install t in targets) ok = op(t, log) && ok;
                }
                catch (Exception ex)
                {
                    lock (lines) { lines.Add("ERROR: " + ex.Message); }
                    ok = false;
                }

                BeginInvoke(new Action(delegate
                {
                    List<string> copy;
                    lock (lines) { copy = new List<string>(lines); }
                    foreach (string l in copy) AppendLog(l);

                    busy = false;
                    LoadInstalls(false);

                    if (ok) Toast(title + " complete · restart Discord", true);
                    else Toast(title + " failed · check the log", false);
                }));
            });
        }

        void RunUpdate()
        {
            List<Install> targets = SelectedTargets();
            if (targets.Count == 0)
            {
                Toast("Install Discord first · no installation found", false);
                return;
            }

            busy = true;
            busyT = 0f;
            dropdownOpen = false;
            AppendLog("");
            AppendLog("=== Update ===");

            ThreadPool.QueueUserWorkItem(delegate
            {
                List<string> lines = new List<string>();
                Action<string> log = delegate(string s) { lock (lines) { lines.Add(s); } };

                bool ok = true;
                string message = "Updated to the latest build · restart Discord";

                try
                {
                    log("Refreshing Daucord files from this installer...");
                    foreach (Install t in targets) ok = Core.Install(t, true, false, log) && ok;

                    log("");
                    log("Checking GitHub for a newer Daucord release...");
                    Core.Release rel = Core.FetchLatestRelease(log);

                    if (rel == null)
                    {
                        log("Release check skipped · you now have the latest build bundled here.");
                    }
                    else if (!Core.IsNewer(rel.Tag, Core.Version))
                    {
                        log("You are on the latest release (" + rel.Tag + ").");
                        message = "Already on the latest version (" + rel.Tag + ") · restart Discord";
                    }
                    else
                    {
                        log("Newer release available: " + rel.Tag + " (this installer: v" + Core.Version + ")");
                        string exe = Core.DownloadRelease(rel, log);
                        if (exe == null)
                        {
                            log("Falling back to the bundled build.");
                        }
                        else
                        {
                            log("Running the new installer in silent update mode...");
                            ProcessStartInfo psi = new ProcessStartInfo(exe, "--update");
                            psi.UseShellExecute = false;
                            psi.CreateNoWindow = true;
                            using (Process proc = Process.Start(psi))
                            {
                                if (!proc.WaitForExit(240000)) log("The update is still running in the background.");
                                else log("Update finished (exit code " + proc.ExitCode + ").");
                            }
                            message = "Updated to " + rel.Tag + " · restart Discord";
                        }
                    }
                }
                catch (Exception ex)
                {
                    lock (lines) { lines.Add("ERROR: " + ex.Message); }
                    ok = false;
                    message = "Update failed · check the log";
                }

                BeginInvoke(new Action(delegate
                {
                    List<string> copy;
                    lock (lines) { copy = new List<string>(lines); }
                    foreach (string l in copy) AppendLog(l);

                    busy = false;
                    LoadInstalls(false);
                    Toast(message, ok);
                }));
            });
        }

        void RunMigrate()
        {
            busy = true;
            busyT = 0f;
            AppendLog("");
            AppendLog("=== Settings migration ===");

            ThreadPool.QueueUserWorkItem(delegate
            {
                List<string> lines = new List<string>();
                Action<string> log = delegate(string s) { lock (lines) { lines.Add(s); } };

                bool ok = false;
                try
                {
                    ok = Core.MigrateSettings(null, log);
                }
                catch (Exception ex)
                {
                    lock (lines) { lines.Add("ERROR: " + ex.Message); }
                    ok = false;
                }

                BeginInvoke(new Action(delegate
                {
                    List<string> copy;
                    lock (lines) { copy = new List<string>(lines); }
                    foreach (string l in copy) AppendLog(l);

                    busy = false;
                    if (ok) Toast("Settings migrated to Daucord · nothing was deleted", true);
                    else Toast("No settings to migrate · is Equicord/Vencord installed?", false);
                }));
            });
        }

        void Toast(string text, bool ok)
        {
            toastText = text;
            toastOk = ok;
            toastAt = time;
            Invalidate();
        }

        void AppendLog(string line)
        {
            logLines.Add(new LogEntry(line, LogColor(line)));
            if (logLines.Count > 800) logLines.RemoveRange(0, logLines.Count - 800);
            Invalidate();
        }

        static Color LogColor(string s)
        {
            if (s.StartsWith("===")) return Color.FromArgb(178, 168, 255);
            if (s.IndexOf("ERROR", StringComparison.OrdinalIgnoreCase) >= 0) return Ui.Danger;
            if (s.StartsWith("  ")) return Ui.TextFaint;
            return Color.FromArgb(172, 177, 194);
        }

        // ---------- input ----------

        bool IsClickable(string id)
        {
            return id != "" && id != "titlebar";
        }

        int DropIndexAt(Point p)
        {
            if (!dropdownOpen) return -1;
            int itemH = 40;
            Rectangle r = new Rectangle(rSelect.X, rSelect.Bottom + 8, rSelect.Width, dropItems.Count * itemH + 10);
            if (!r.Contains(p)) return -1;
            int idx = (p.Y - r.Y - 5) / itemH;
            if (idx < 0 || idx >= dropItems.Count) return -1;
            return idx;
        }

        string HitTest(Point p)
        {
            if (dropdownOpen)
            {
                int idx = DropIndexAt(p);
                if (idx >= 0) return "drop" + idx;
            }
            if (rClose.Contains(p)) return "close";
            if (rMin.Contains(p)) return "min";
            foreach (Btn b in buttons)
                if (b.R.Contains(p)) return b.Id;
            if (rRefresh.Contains(p)) return "refresh";
            if (rUpdate.Contains(p)) return "update";
            if (rSelect.Contains(p)) return "select";
            if (logLines.Count > 0 && rClear.Contains(p)) return "clear";
            if (p.Y < 48) return "titlebar";
            return "";
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);

            int di = DropIndexAt(e.Location);
            if (di != dropHover)
            {
                dropHover = di;
                Invalidate();
            }

            string id = HitTest(e.Location);
            if (id != hoverId)
            {
                hoverId = id;
                Cursor = IsClickable(id) ? Cursors.Hand : Cursors.Default;
                Invalidate();
            }
        }

        protected override void OnMouseLeave(EventArgs e)
        {
            base.OnMouseLeave(e);
            hoverId = "";
            dropHover = -1;
            Invalidate();
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left) return;

            string id = HitTest(e.Location);

            if (dropdownOpen && !id.StartsWith("drop") && id != "select")
            {
                dropdownOpen = false;
                Invalidate();
                if (id == "") return;
            }

            if (id.StartsWith("drop"))
            {
                int idx = int.Parse(id.Substring(4));
                if (idx >= 0 && idx < dropMap.Count)
                {
                    selected = dropMap[idx];
                    UpdateStatus();
                }
                dropdownOpen = false;
                Invalidate();
                return;
            }

            if (id == "titlebar")
            {
                Native.ReleaseCapture();
                Native.SendMessage(Handle, 0xA1, 0x2, 0);
                return;
            }

            if (id != "")
            {
                pressId = id;
                Capture = true;
                Invalidate();
            }
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button != MouseButtons.Left) return;

            string id = HitTest(e.Location);
            if (pressId != "" && pressId == id) Execute(id);

            pressId = "";
            Capture = false;
            Invalidate();
        }

        protected override void OnMouseWheel(MouseEventArgs e)
        {
            base.OnMouseWheel(e);
            if (!rLog.Contains(e.Location) || dropdownOpen) return;

            int visible = Math.Max(1, (rLog.Height - 56) / 16);
            int max = Math.Max(0, logLines.Count - visible);
            logScroll += e.Delta > 0 ? 3 : -3;
            if (logScroll < 0) logScroll = 0;
            if (logScroll > max) logScroll = max;
            Invalidate();
        }

        protected override void OnKeyDown(KeyEventArgs e)
        {
            base.OnKeyDown(e);
            if (e.KeyCode == Keys.Escape && dropdownOpen)
            {
                dropdownOpen = false;
                Invalidate();
            }
        }

        protected override void OnFormClosing(FormClosingEventArgs e)
        {
            if (busy)
            {
                e.Cancel = true;
                Toast("An operation is running · please wait", false);
                return;
            }
            base.OnFormClosing(e);
        }

        // ---------- painting ----------

        void RebuildAurora()
        {
            if (bgBmp == null) bgBmp = new Bitmap(CW, CH);
            using (Graphics g = Graphics.FromImage(bgBmp))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                using (LinearGradientBrush br = new LinearGradientBrush(
                    new Rectangle(0, 0, CW, CH), Color.FromArgb(11, 12, 18), Color.FromArgb(6, 7, 10), 90f))
                {
                    g.FillRectangle(br, 0, 0, CW, CH);
                }

                Ui.Blob(g, new PointF((float)(190 + Math.Sin(time * 0.21) * 100), (float)(540 + Math.Cos(time * 0.17) * 60)),
                    340, Color.FromArgb(52, Ui.Accent));
                Ui.Blob(g, new PointF((float)(790 + Math.Cos(time * 0.16) * 120), (float)(660 + Math.Sin(time * 0.19) * 70)),
                    320, Color.FromArgb(34, Ui.Accent2));
                Ui.Blob(g, new PointF((float)(520 + Math.Sin(time * 0.11) * 160), (float)(790 + Math.Cos(time * 0.14) * 50)),
                    280, Color.FromArgb(26, 232, 90, 170));
            }
        }

        void BuildHero()
        {
            if (hero == null) return;
            heroBmp = new Bitmap(CW + 80, 380);
            using (Graphics g = Graphics.FromImage(heroBmp))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                float scale = Math.Max((CW + 80) / (float)hero.Width, 380f / hero.Height);
                int w = (int)(hero.Width * scale) + 1;
                int h = (int)(hero.Height * scale) + 1;
                g.DrawImage(hero, new Rectangle((CW + 80 - w) / 2, (380 - h) / 2, w, h));
            }
        }

        void PaintBackground(Graphics g)
        {
            if (bgBmp == null || time - bgAt > 0.1f)
            {
                bgAt = time;
                RebuildAurora();
            }
            g.DrawImageUnscaled(bgBmp, 0, 0);

            if (heroBmp == null && hero != null) BuildHero();
            if (heroBmp != null)
            {
                int px = (int)(Math.Sin(time * 0.13) * 16);
                int py = (int)(Math.Cos(time * 0.09) * 7);
                g.SetClip(new Rectangle(0, 0, CW, 340));
                g.DrawImageUnscaled(heroBmp, -40 + px, -22 + py);
                g.ResetClip();
            }

            Rectangle band = new Rectangle(0, 0, CW, 340);
            using (LinearGradientBrush br = new LinearGradientBrush(band, Color.Black, Color.Black, 90f))
            {
                ColorBlend cb = new ColorBlend(3);
                cb.Colors = new Color[] {
                    Color.FromArgb(170, 8, 9, 13),
                    Color.FromArgb(214, 8, 9, 13),
                    Color.FromArgb(255, 8, 9, 13)
                };
                cb.Positions = new float[] { 0f, 0.58f, 1f };
                br.InterpolationColors = cb;
                g.FillRectangle(br, band);
            }

            using (LinearGradientBrush br = new LinearGradientBrush(new Rectangle(0, 0, CW, 90),
                Color.FromArgb(150, 0, 0, 0), Color.FromArgb(0, 0, 0, 0), 90f))
            {
                g.FillRectangle(br, 0, 0, CW, 90);
            }

            Ui.Blob(g, new PointF(CW / 2f, 104), 210, Color.FromArgb(64, Ui.Accent));

            foreach (Particle p in particles)
            {
                float a = p.A * (0.55f + 0.45f * (float)Math.Sin(time * 0.8f + p.P));
                if (a < 2f) continue;
                using (SolidBrush b = new SolidBrush(Color.FromArgb((int)a, 190, 200, 255)))
                    g.FillEllipse(b, p.X, p.Y, p.S, p.S);
            }
        }

        void PaintChrome(Graphics g)
        {
            if (logo != null)
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(logo, new Rectangle(20, 14, 22, 22));
            }

            int x = 50;
            Size s1 = Ui.Measure("Daucord", Ui.Font(12.5f, FontStyle.Bold));
            Ui.DrawText(g, "Daucord", Ui.Font(12.5f, FontStyle.Bold), Ui.Text,
                new Rectangle(x, 12, s1.Width + 4, 26), TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            Ui.DrawText(g, "Installer", Ui.Font(12.5f), Ui.TextFaint,
                new Rectangle(x + s1.Width + 4, 12, 120, 26), TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);

            float hMin = Hover("min");
            float hClose = Hover("close");

            if (hMin > 0.01f)
                Ui.FillRound(g, rMin, 8, Color.FromArgb((int)(16 * hMin), 255, 255, 255));
            if (hClose > 0.01f)
                Ui.FillRound(g, rClose, 8, Color.FromArgb((int)(220 * hClose), 232, 17, 35));

            Ui.Glyph(g, "\uE921", Ui.Icon(10f), Ui.Lerp(Ui.TextDim, Ui.Text, hMin), rMin);
            Ui.Glyph(g, "\uE8BB", Ui.Icon(10f), hClose > 0.5f ? Color.White : Ui.Lerp(Ui.TextDim, Ui.Text, hClose), rClose);
        }

        void PaintHero(Graphics g)
        {
            float pulse = (float)(0.5 + 0.5 * Math.Sin(time * 1.6));
            Rectangle lr = new Rectangle(CW / 2 - 42, 62, 84, 84);

            Ui.Blob(g, new PointF(lr.X + 42, lr.Y + 42), 118 + pulse * 12,
                Color.FromArgb((int)(48 + pulse * 18), Ui.Accent));

            if (logo != null)
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.DrawImage(logo, lr);
            }
            Ui.StrokeRound(g, new Rectangle(lr.X - 1, lr.Y - 1, lr.Width + 2, lr.Height + 2), 23,
                Color.FromArgb(30, 255, 255, 255), 1f);

            Ui.GradientText(g, "Daucord", Ui.Display(46f, FontStyle.Bold), new Rectangle(0, 152, CW, 56),
                Color.White, Color.FromArgb(168, 156, 255), true);

            Ui.DrawText(g, "lightweight, optimized fork of vencord/equicord.", Ui.Font(13f), Ui.TextDim,
                new Rectangle(0, 210, CW, 20), TextFormatFlags.HorizontalCenter | TextFormatFlags.SingleLine);

            string ver = "v" + Core.Version;
            string author = "by dausita";
            Size sv = Ui.Measure(ver, Ui.Font(11f, FontStyle.Bold));
            Size sa = Ui.Measure(author, Ui.Font(11.5f));
            int pillW = sv.Width + 26;
            int total = pillW + 12 + sa.Width;
            int sx = (CW - total) / 2;
            Rectangle pill = new Rectangle(sx, 238, pillW, 24);

            Ui.FillRound(g, pill, 12, Color.FromArgb(34, Ui.Accent));
            Ui.StrokeRound(g, pill, 12, Color.FromArgb(90, Ui.Accent), 1f);
            Ui.DrawText(g, ver, Ui.Font(11f, FontStyle.Bold), Color.FromArgb(206, 198, 255), pill,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            Ui.DrawText(g, author, Ui.Font(11.5f), Ui.TextFaint,
                new Rectangle(pill.Right + 12, 238, sa.Width + 2, 24),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }

        void DrawCard(Graphics g, Rectangle r, int rad)
        {
            Ui.Shadow(g, r, rad, 9, 130);
            using (GraphicsPath p = Ui.Round(r, rad))
            using (LinearGradientBrush b = new LinearGradientBrush(
                new Rectangle(r.X, r.Y - 1, r.Width, r.Height + 2),
                Color.FromArgb(238, 23, 24, 33), Color.FromArgb(238, 15, 16, 22), 90f))
            {
                g.FillPath(b, p);
            }
            Ui.StrokeRound(g, r, rad, Color.FromArgb(44, 46, 60), 1f);
            using (GraphicsPath p = Ui.Round(new Rectangle(r.X + 1, r.Y + 1, r.Width - 2, r.Height - 2), rad - 1))
            using (Pen pen = new Pen(Color.FromArgb(16, 255, 255, 255), 1f))
            {
                g.DrawPath(pen, p);
            }
        }

        void PaintStatus(Graphics g)
        {
            DrawCard(g, rStatus, 16);
            int cy = rStatus.Y + rStatus.Height / 2;

            Rectangle stripe = new Rectangle(rStatus.X + 18, rStatus.Y + 22, 3, rStatus.Height - 44);
            Ui.FillRound(g, stripe, 1.5f, statusColor);

            PointF dot = new PointF(rStatus.X + 44, cy);
            if (busy)
            {
                float a0 = (time * 320f) % 360f;
                using (Pen pen = new Pen(statusColor, 2.4f))
                {
                    pen.StartCap = LineCap.Round;
                    pen.EndCap = LineCap.Round;
                    g.DrawArc(pen, dot.X - 8, dot.Y - 8, 16, 16, a0, 260f);
                }
            }
            else
            {
                float pulse = (float)(0.5 + 0.5 * Math.Sin(time * 2.2));
                Ui.Blob(g, dot, 15 + pulse * 4, Color.FromArgb((int)(50 + pulse * 40), statusColor));
                using (SolidBrush b = new SolidBrush(statusColor)) g.FillEllipse(b, dot.X - 5, dot.Y - 5, 10, 10);
                using (SolidBrush b = new SolidBrush(Color.FromArgb(220, 255, 255, 255))) g.FillEllipse(b, dot.X - 2, dot.Y - 2, 4, 4);
            }

            Ui.DrawText(g, statusTitle, Ui.Font(15f, FontStyle.Bold), Ui.Text,
                new Rectangle(rStatus.X + 66, rStatus.Y + 17, 540, 24),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            Ui.DrawText(g, statusSub, Ui.Font(11.5f), Ui.TextDim,
                new Rectangle(rStatus.X + 66, rStatus.Y + 42, 540, 18),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);

            Size bs = Ui.Measure(badgeText, Ui.Font(10f, FontStyle.Bold));
            int bw = bs.Width + 26;
            Rectangle br = new Rectangle(rStatus.Right - 24 - bw, cy - 12, bw, 24);
            Ui.FillRound(g, br, 12, Color.FromArgb(30, badgeColor));
            Ui.StrokeRound(g, br, 12, Color.FromArgb(80, badgeColor), 1f);
            Ui.DrawText(g, badgeText, Ui.Font(10f, FontStyle.Bold), badgeColor, br,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);

            if (busy)
            {
                Rectangle track = new Rectangle(rStatus.X + 18, rStatus.Bottom - 9, rStatus.Width - 36, 3);
                Ui.FillRound(g, track, 1.5f, Color.FromArgb(22, 255, 255, 255));

                int segW = 170;
                float t = (time * 0.75f) % 1f;
                int segX = track.X + (int)((track.Width - segW) * Ui.EaseOut(t));
                Rectangle seg = new Rectangle(segX, track.Y, segW, track.Height);
                using (GraphicsPath p = Ui.Round(seg, 1.5f))
                using (LinearGradientBrush b = new LinearGradientBrush(seg, Color.FromArgb(0, Ui.Accent), Ui.Accent2, 0f))
                {
                    g.FillPath(b, p);
                }
            }
        }

        void PaintSelect(Graphics g)
        {
            bool has = installs.Count > 0;
            float h = Hover("select");
            bool open = dropdownOpen;

            Ui.DrawText(g, "DISCORD INSTALLATION", Ui.Font(10f, FontStyle.Bold), Ui.TextFaint,
                new Rectangle(rSelect.X + 2, rSelect.Y - 22, 300, 16),
                TextFormatFlags.Left | TextFormatFlags.SingleLine);

            Color fill = Ui.Lerp(Color.FromArgb(19, 20, 27), Color.FromArgb(25, 27, 38), h);
            using (GraphicsPath p = Ui.Round(rSelect, 12))
            using (SolidBrush b = new SolidBrush(fill))
            {
                g.FillPath(b, p);
            }
            Ui.StrokeRound(g, rSelect, 12,
                open ? Ui.Accent : Ui.Lerp(Ui.Border, Color.FromArgb(74, 78, 104), h), 1f);

            string label = has ? dropItems[DropIndexFor(selected)] : "Discord not found";
            Ui.DrawText(g, label, Ui.Font(13f), has ? Ui.Text : Ui.TextFaint,
                new Rectangle(rSelect.X + 18, rSelect.Y, rSelect.Width - 60, rSelect.Height),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);

            int cx = rSelect.Right - 26;
            int cy = rSelect.Y + rSelect.Height / 2;
            using (Pen pen = new Pen(has ? Ui.TextDim : Ui.TextFaint, 2f))
            {
                pen.StartCap = LineCap.Round;
                pen.EndCap = LineCap.Round;
                if (open)
                {
                    g.DrawLine(pen, cx - 5, cy + 3, cx, cy - 2);
                    g.DrawLine(pen, cx, cy - 2, cx + 5, cy + 3);
                }
                else
                {
                    g.DrawLine(pen, cx - 5, cy - 2, cx, cy + 3);
                    g.DrawLine(pen, cx, cy + 3, cx + 5, cy - 2);
                }
            }

            if (has)
            {
                Rectangle hint = new Rectangle(CW - 48 - 240, 434, 240, 34);
                Ui.FillRound(g, hint, 10, Color.FromArgb(10, 255, 255, 255));
                Ui.StrokeRound(g, hint, 10, Color.FromArgb(20, 255, 255, 255), 1f);
                Ui.Glyph(g, "\uE73E", Ui.Icon(10f), Ui.Success, new Rectangle(hint.X + 8, hint.Y, 20, hint.Height));
                Ui.DrawText(g, "Settings are inherited automatically", Ui.Font(11f), Ui.TextDim,
                    new Rectangle(hint.X + 32, hint.Y, hint.Width - 40, hint.Height),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            }
        }

        void DrawButton(Graphics g, Btn b)
        {
            float h = Hover(b.Id);
            bool press = pressId == b.Id;
            Rectangle r = b.R;
            if (press) r.Offset(0, 1);

            if (b.Primary)
            {
                Ui.Glow(g, r, 12, Ui.Accent, (int)(60 + 70 * h));
                Color c1 = Ui.Lerp(Color.FromArgb(136, 118, 250), Color.FromArgb(152, 136, 255), h);
                Color c2 = Ui.Lerp(Color.FromArgb(88, 72, 214), Color.FromArgb(104, 88, 236), h);
                using (GraphicsPath p = Ui.Round(r, 12))
                using (LinearGradientBrush br = new LinearGradientBrush(
                    new Rectangle(r.X, r.Y - 2, r.Width, r.Height + 4), c1, c2, 90f))
                {
                    g.FillPath(br, p);
                }
                using (GraphicsPath p = Ui.Round(new Rectangle(r.X + 1, r.Y + 1, r.Width - 2, r.Height / 2), 11))
                using (LinearGradientBrush br = new LinearGradientBrush(
                    new Rectangle(r.X, r.Y, r.Width, r.Height / 2), Color.FromArgb(46, 255, 255, 255), Color.FromArgb(0, 255, 255, 255), 90f))
                {
                    g.FillPath(br, p);
                }

                using (GraphicsPath clip = Ui.Round(r, 12))
                {
                    g.SetClip(clip);
                    float phase = (time * 0.23f) % 1f;
                    Rectangle band = new Rectangle(r.X - 150 + (int)(phase * (r.Width + 300)), r.Y, 130, r.Height);
                    ColorBlend cb = new ColorBlend(3);
                    cb.Colors = new Color[] {
                        Color.FromArgb(0, 255, 255, 255),
                        Color.FromArgb(30, 255, 255, 255),
                        Color.FromArgb(0, 255, 255, 255)
                    };
                    cb.Positions = new float[] { 0f, 0.5f, 1f };
                    using (LinearGradientBrush sb = new LinearGradientBrush(band, Color.White, Color.White, 0f))
                    {
                        sb.InterpolationColors = cb;
                        g.FillRectangle(sb, band);
                    }
                    g.ResetClip();
                }

                Ui.StrokeRound(g, r, 12, Color.FromArgb(70, 255, 255, 255), 1f);
            }
            else
            {
                Color fill = Ui.Lerp(Color.FromArgb(22, 23, 31), Color.FromArgb(34, 36, 50), h);
                using (GraphicsPath p = Ui.Round(r, 12))
                using (SolidBrush br = new SolidBrush(fill))
                {
                    g.FillPath(br, p);
                }
                Ui.StrokeRound(g, r, 12, Ui.Lerp(Color.FromArgb(42, 44, 58), Color.FromArgb(76, 80, 106), h), 1f);
            }

            if (busy)
            {
                using (GraphicsPath p = Ui.Round(r, 12))
                using (SolidBrush br = new SolidBrush(Color.FromArgb(150, 10, 11, 16)))
                {
                    g.FillPath(br, p);
                }
            }

            Color tc = b.Primary ? Color.White : Ui.Lerp(Ui.TextDim, Ui.Text, h);
            if (busy) tc = Color.FromArgb(98, 100, 114);
            Ui.DrawText(g, b.Label, Ui.Font(13f, FontStyle.Bold), tc, r,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
        }

        void PaintButtons(Graphics g)
        {
            foreach (Btn b in buttons) DrawButton(g, b);

            float h = Hover("refresh");
            Rectangle r = rRefresh;
            using (GraphicsPath p = Ui.Round(r, 12))
            using (SolidBrush br = new SolidBrush(Ui.Lerp(Color.FromArgb(22, 23, 31), Color.FromArgb(34, 36, 50), h)))
            {
                g.FillPath(br, p);
            }
            Ui.StrokeRound(g, r, 12, Ui.Lerp(Color.FromArgb(42, 44, 58), Color.FromArgb(76, 80, 106), h), 1f);
            Ui.Glyph(g, "\uE72C", Ui.Icon(14f), busy ? Color.FromArgb(98, 100, 114) : Ui.Lerp(Ui.TextDim, Ui.Text, h), r);
        }

        void PaintUpdate(Graphics g)
        {
            float h = Hover("update");
            Rectangle r = rUpdate;

            if (h > 0.01f)
            {
                using (GraphicsPath p = Ui.Round(r, 9))
                using (SolidBrush b = new SolidBrush(Color.FromArgb((int)(16 * h), 255, 255, 255)))
                {
                    g.FillPath(b, p);
                }
                Ui.StrokeRound(g, r, 9, Color.FromArgb((int)(40 * h), Ui.Accent), 1f);
            }

            Ui.Glyph(g, "\uE896", Ui.Icon(10f), Ui.Lerp(Ui.Accent, Color.White, h),
                new Rectangle(r.X + 9, r.Y, 18, r.Height));

            Color tc = Ui.Lerp(Color.FromArgb(142, 147, 168), Ui.Text, h);
            if (busy) tc = Color.FromArgb(90, 92, 106);
            Ui.DrawText(g, UpdateText, Ui.Font(11.5f), tc,
                new Rectangle(r.X + 30, r.Y, r.Width - 38, r.Height),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);

            if (h > 0.05f)
            {
                Size ts = Ui.Measure(UpdateText, Ui.Font(11.5f));
                int lineW = (int)(ts.Width * Math.Min(1f, h * 1.4f));
                using (Pen pen = new Pen(Color.FromArgb((int)(170 * h), Ui.Accent), 1f))
                    g.DrawLine(pen, r.X + 30, r.Y + r.Height / 2 + 8, r.X + 30 + lineW, r.Y + r.Height / 2 + 8);
            }
        }

        void PaintLog(Graphics g)
        {
            DrawCard(g, rLog, 16);

            Ui.DrawText(g, "LOG", Ui.Font(10f, FontStyle.Bold), Ui.TextFaint,
                new Rectangle(rLog.X + 18, rLog.Y + 12, 200, 18),
                TextFormatFlags.Left | TextFormatFlags.SingleLine);

            if (logLines.Count > 0)
            {
                float h = Hover("clear");
                Ui.DrawText(g, "clear", Ui.Font(10.5f), Ui.Lerp(Ui.TextFaint, Ui.Accent, h),
                    rClear, TextFormatFlags.Right | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine);
            }

            using (Pen pen = new Pen(Color.FromArgb(24, 255, 255, 255), 1f))
                g.DrawLine(pen, rLog.X + 18, rLog.Y + 38, rLog.Right - 18, rLog.Y + 38);

            Rectangle inner = new Rectangle(rLog.X + 18, rLog.Y + 46, rLog.Width - 36, rLog.Height - 58);
            int lineH = 16;
            int visible = Math.Max(1, inner.Height / lineH);
            int maxScroll = Math.Max(0, logLines.Count - visible);
            if (logScroll > maxScroll) logScroll = maxScroll;

            int start = Math.Max(0, logLines.Count - visible - logScroll);
            for (int i = 0; i < visible; i++)
            {
                int idx = start + i;
                if (idx >= logLines.Count) break;
                LogEntry entry = logLines[idx];
                Ui.DrawText(g, entry.Text, Ui.Mono(11.5f), entry.Color,
                    new Rectangle(inner.X, inner.Y + i * lineH, inner.Width - 10, lineH),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
            }

            if (maxScroll > 0)
            {
                Rectangle track = new Rectangle(rLog.Right - 12, inner.Y, 3, inner.Height);
                Ui.FillRound(g, track, 1.5f, Color.FromArgb(18, 255, 255, 255));

                float ratio = visible / (float)logLines.Count;
                int thumbH = Math.Max(18, (int)(inner.Height * ratio));
                int denom = Math.Max(1, maxScroll);
                int thumbY = inner.Y + (int)((inner.Height - thumbH) * (1f - logScroll / (float)denom));
                Rectangle thumb = new Rectangle(track.X, thumbY, 3, thumbH);
                Ui.FillRound(g, thumb, 1.5f, Color.FromArgb(70, 255, 255, 255));
            }
        }

        void PaintFooter(Graphics g)
        {
            Ui.DrawText(g, "Discord is never closed. Restart it yourself after installing.",
                Ui.Font(11.5f), Ui.TextFaint, new Rectangle(48, 712, 720, 20),
                TextFormatFlags.Left | TextFormatFlags.SingleLine);
            Ui.DrawText(g, "open source · GPL-3.0", Ui.Font(11.5f), Ui.TextFaint,
                new Rectangle(CW - 268, 712, 220, 20),
                TextFormatFlags.Right | TextFormatFlags.SingleLine);
        }

        void PaintDropdown(Graphics g)
        {
            if (dropItems.Count == 0) return;

            int itemH = 40;
            Rectangle r = new Rectangle(rSelect.X, rSelect.Bottom + 8, rSelect.Width, dropItems.Count * itemH + 10);

            Ui.Shadow(g, r, 14, 14, 190);
            using (GraphicsPath p = Ui.Round(r, 14))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(252, 20, 21, 29)))
            {
                g.FillPath(b, p);
            }
            Ui.StrokeRound(g, r, 14, Color.FromArgb(66, 70, 94), 1f);

            for (int i = 0; i < dropItems.Count; i++)
            {
                Rectangle ir = new Rectangle(r.X + 5, r.Y + 5 + i * itemH, r.Width - 10, itemH);
                bool sel = dropMap[i] == selected;

                if (i == dropHover)
                {
                    Ui.FillRound(g, ir, 9, Color.FromArgb(16, 255, 255, 255));
                }
                if (sel)
                {
                    Ui.FillRound(g, new Rectangle(ir.X + 1, ir.Y + 1, ir.Width - 2, ir.Height - 2), 9,
                        Color.FromArgb(26, Ui.Accent));
                }

                Ui.DrawText(g, dropItems[i], Ui.Font(12.5f, sel ? FontStyle.Bold : FontStyle.Regular),
                    sel ? Color.White : Ui.TextDim,
                    new Rectangle(ir.X + 14, ir.Y, ir.Width - 50, ir.Height),
                    TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);

                if (sel)
                    Ui.Glyph(g, "\uE73E", Ui.Icon(11f), Ui.Accent, new Rectangle(ir.Right - 34, ir.Y, 20, ir.Height));
            }
        }

        void PaintToast(Graphics g)
        {
            float age = time - toastAt;
            if (age < 0f || age > 4.6f) return;

            float slide;
            if (age < 0.22f) slide = 1f - age / 0.22f;
            else if (age > 4.1f) slide = (age - 4.1f) / 0.5f;
            else slide = 0f;

            Size ts = Ui.Measure(toastText, Ui.Font(12.5f, FontStyle.Bold));
            int w = Math.Min(780, ts.Width + 82);
            Rectangle r = new Rectangle((CW - w) / 2, CH - 82 + (int)(slide * 14), w, 46);

            Ui.Shadow(g, r, 14, 12, 180);
            using (GraphicsPath p = Ui.Round(r, 14))
            using (SolidBrush b = new SolidBrush(Color.FromArgb(252, 22, 24, 32)))
            {
                g.FillPath(b, p);
            }

            Color c = toastOk ? Ui.Success : Ui.Danger;
            Ui.StrokeRound(g, r, 14, Color.FromArgb(70, c), 1f);

            using (SolidBrush b = new SolidBrush(Color.FromArgb(34, c)))
                g.FillEllipse(b, r.X + 14, r.Y + 13, 20, 20);
            Ui.Glyph(g, toastOk ? "\uE73E" : "\uE711", Ui.Icon(10f), c, new Rectangle(r.X + 14, r.Y + 13, 20, 20));

            Ui.DrawText(g, toastText, Ui.Font(12.5f, FontStyle.Bold), Ui.Text,
                new Rectangle(r.X + 46, r.Y, r.Width - 60, r.Height),
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.SingleLine | TextFormatFlags.EndEllipsis);
        }
    }

    public static class Program
    {
        [STAThread]
        public static int Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate(object sender, ThreadExceptionEventArgs e)
            {
                try
                {
                    File.WriteAllText(Path.Combine(Path.GetTempPath(), "daucord-installer-error.txt"), e.Exception.ToString());
                }
                catch { }
                MessageBox.Show("An unexpected error occurred. Details: %TEMP%\\daucord-installer-error.txt",
                    "Daucord", MessageBoxButtons.OK, MessageBoxIcon.Error);
            };

            bool selfTest = false;
            bool silentUpdate = false;
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == "--selftest") selfTest = true;
                if (args[i] == "--update") silentUpdate = true;
            }

            if (silentUpdate)
            {
                StringBuilder log = new StringBuilder();
                bool ok;
                try
                {
                    ok = Core.UpdateAll(delegate(string s) { log.AppendLine(s); });
                }
                catch (Exception ex)
                {
                    log.AppendLine("ERROR: " + ex.Message);
                    ok = false;
                }
                try
                {
                    File.WriteAllText(Path.Combine(Path.GetTempPath(), "daucord-update.log"), log.ToString());
                }
                catch { }
                return ok ? 0 : 1;
            }

            if (selfTest)
            {
                MainForm f = new MainForm();
                bool ok = f.SelfTest();
                string result = ok ? "OK" : "FAIL";
                try
                {
                    File.WriteAllText(Path.Combine(Path.GetTempPath(), "daucord-selftest.txt"),
                        result + Environment.NewLine +
                        "installs=" + Core.FindInstalls("all", null).Count + Environment.NewLine +
                        "distDir=" + Core.DataDir + "\\dist" + Environment.NewLine);
                }
                catch { }
                return ok ? 0 : 1;
            }

            Application.Run(new MainForm());
            return 0;
        }
    }
}
