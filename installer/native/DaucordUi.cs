/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Windows.Forms;

namespace Daucord
{
    public static class Ui
    {
        public static readonly Color Bg = Color.FromArgb(8, 9, 13);
        public static readonly Color Card = Color.FromArgb(21, 22, 30);
        public static readonly Color CardDeep = Color.FromArgb(15, 16, 22);
        public static readonly Color Border = Color.FromArgb(40, 42, 56);
        public static readonly Color Text = Color.FromArgb(233, 235, 244);
        public static readonly Color TextDim = Color.FromArgb(156, 160, 178);
        public static readonly Color TextFaint = Color.FromArgb(110, 114, 133);
        public static readonly Color Accent = Color.FromArgb(124, 108, 240);
        public static readonly Color Accent2 = Color.FromArgb(34, 199, 232);
        public static readonly Color Success = Color.FromArgb(64, 196, 128);
        public static readonly Color Warn = Color.FromArgb(240, 170, 70);
        public static readonly Color Danger = Color.FromArgb(240, 96, 104);

        static readonly Dictionary<string, Font> Cache = new Dictionary<string, Font>();
        static readonly string DisplayFamily;
        static readonly string BodyFamily;
        static readonly string MonoFamily;
        static readonly string IconFamily;

        static Ui()
        {
            List<string> names = new List<string>();
            using (InstalledFontCollection col = new InstalledFontCollection())
            {
                foreach (FontFamily fam in col.Families) names.Add(fam.Name);
            }

            DisplayFamily = names.Contains("Segoe UI Variable Display") ? "Segoe UI Variable Display" : "Segoe UI";
            BodyFamily = "Segoe UI";
            MonoFamily = names.Contains("Cascadia Mono") ? "Cascadia Mono" : (names.Contains("Consolas") ? "Consolas" : "Courier New");
            IconFamily = names.Contains("Segoe MDL2 Assets") ? "Segoe MDL2 Assets" : "Segoe UI Symbol";
        }

        static Font Get(string family, float px, FontStyle style)
        {
            string key = family + "|" + px.ToString("0.##") + "|" + ((int)style);
            Font f;
            if (Cache.TryGetValue(key, out f)) return f;
            f = new Font(family, px, style, GraphicsUnit.Pixel);
            Cache[key] = f;
            return f;
        }

        public static Font Font(float px)
        {
            return Get(BodyFamily, px, FontStyle.Regular);
        }

        public static Font Font(float px, FontStyle style)
        {
            return Get(BodyFamily, px, style);
        }

        public static Font Display(float px, FontStyle style)
        {
            return Get(DisplayFamily, px, style);
        }

        public static Font Mono(float px)
        {
            return Get(MonoFamily, px, FontStyle.Regular);
        }

        public static Font Icon(float px)
        {
            return Get(IconFamily, px, FontStyle.Regular);
        }

        public static GraphicsPath Round(Rectangle r, float radius)
        {
            return Round(new RectangleF(r.X, r.Y, r.Width, r.Height), radius);
        }

        public static GraphicsPath Round(RectangleF r, float radius)
        {
            GraphicsPath p = new GraphicsPath();
            float max = Math.Min(r.Width, r.Height) / 2f;
            if (radius > max) radius = max;
            if (radius < 0.5f) radius = 0.5f;
            float d = radius * 2f;

            p.AddArc(r.X, r.Y, d, d, 180f, 90f);
            p.AddArc(r.Right - d, r.Y, d, d, 270f, 90f);
            p.AddArc(r.Right - d, r.Bottom - d, d, d, 0f, 90f);
            p.AddArc(r.X, r.Bottom - d, d, d, 90f, 90f);
            p.CloseFigure();
            return p;
        }

        public static void FillRound(Graphics g, Rectangle r, float radius, Color color)
        {
            using (GraphicsPath p = Round(r, radius))
            using (SolidBrush b = new SolidBrush(color))
                g.FillPath(b, p);
        }

        public static void StrokeRound(Graphics g, Rectangle r, float radius, Color color, float width)
        {
            RectangleF rr = new RectangleF(r.X + width / 2f, r.Y + width / 2f, r.Width - width, r.Height - width);
            using (GraphicsPath p = Round(rr, radius))
            using (Pen pen = new Pen(color, width))
                g.DrawPath(pen, p);
        }

        public static void Shadow(Graphics g, Rectangle r, float radius, int spread, int alpha)
        {
            for (int i = spread; i >= 1; i--)
            {
                Rectangle rr = r;
                rr.Inflate(i, i);
                rr.Offset(0, i / 2 + 1);
                int a = alpha / (i + 3);
                if (a < 1) continue;
                using (GraphicsPath p = Round(rr, radius + i))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(a, 0, 0, 0)))
                    g.FillPath(b, p);
            }
        }

        public static void Glow(Graphics g, Rectangle r, float radius, Color color, int alpha)
        {
            for (int i = 7; i >= 1; i--)
            {
                Rectangle rr = r;
                rr.Inflate(i * 2, i * 2);
                int a = alpha / 9;
                if (a < 1) continue;
                using (GraphicsPath p = Round(rr, radius + i * 2))
                using (SolidBrush b = new SolidBrush(Color.FromArgb(a, color)))
                    g.FillPath(b, p);
            }
        }

        public static void Blob(Graphics g, PointF center, float radius, Color color)
        {
            if (radius <= 1f) return;
            using (GraphicsPath p = new GraphicsPath())
            {
                p.AddEllipse(center.X - radius, center.Y - radius, radius * 2f, radius * 2f);
                using (PathGradientBrush b = new PathGradientBrush(p))
                {
                    b.CenterColor = color;
                    b.SurroundColors = new Color[] { Color.FromArgb(0, color) };
                    b.SetSigmaBellShape(0.62f);
                    g.FillPath(b, p);
                }
            }
        }

        public static Color Lerp(Color a, Color b, float t)
        {
            if (t < 0f) t = 0f;
            if (t > 1f) t = 1f;
            return Color.FromArgb(
                (int)(a.A + (b.A - a.A) * t),
                (int)(a.R + (b.R - a.R) * t),
                (int)(a.G + (b.G - a.G) * t),
                (int)(a.B + (b.B - a.B) * t));
        }

        public static Color WithAlpha(Color c, int a)
        {
            if (a < 0) a = 0;
            if (a > 255) a = 255;
            return Color.FromArgb(a, c);
        }

        public static float EaseOut(float t)
        {
            if (t < 0f) t = 0f;
            if (t > 1f) t = 1f;
            return 1f - (1f - t) * (1f - t);
        }

        public static Size Measure(string text, Font font)
        {
            return TextRenderer.MeasureText(text, font, Size.Empty, TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
        }

        public static void DrawText(Graphics g, string text, Font font, Color color, Rectangle r, TextFormatFlags flags)
        {
            TextRenderer.DrawText(g, text, font, r, color, flags | TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
        }

        public static void Glyph(Graphics g, string glyph, Font font, Color color, Rectangle r)
        {
            TextRenderer.DrawText(g, glyph, font, r, color,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter |
                TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix | TextFormatFlags.SingleLine);
        }

        public static void GradientText(Graphics g, string text, Font font, Rectangle area, Color top, Color bottom, bool shadow)
        {
            using (GraphicsPath p = new GraphicsPath())
            {
                p.AddString(text, font.FontFamily, (int)font.Style, font.Size, PointF.Empty, StringFormat.GenericTypographic);
                RectangleF b = p.GetBounds();
                float x = area.X + (area.Width - b.Width) / 2f - b.X;
                float y = area.Y + (area.Height - b.Height) / 2f - b.Y;
                using (Matrix m = new Matrix())
                {
                    m.Translate(x, y);
                    p.Transform(m);
                }

                if (shadow)
                {
                    using (GraphicsPath sp = (GraphicsPath)p.Clone())
                    using (Matrix sm = new Matrix())
                    using (SolidBrush sb = new SolidBrush(Color.FromArgb(110, 0, 0, 0)))
                    {
                        sm.Translate(0f, 2f);
                        sp.Transform(sm);
                        g.FillPath(sb, sp);
                    }
                }

                using (LinearGradientBrush br = new LinearGradientBrush(
                    new RectangleF(area.X, area.Y, area.Width, Math.Max(2, area.Height)), top, bottom, 90f))
                {
                    g.FillPath(br, p);
                }
            }
        }
    }

    public static class Native
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        [System.Runtime.InteropServices.DllImport("user32.dll")]
        public static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);

        [System.Runtime.InteropServices.DllImport("dwmapi.dll")]
        public static extern int DwmExtendFrameIntoClientArea(IntPtr hwnd, ref Margins margins);

        [System.Runtime.InteropServices.StructLayout(System.Runtime.InteropServices.LayoutKind.Sequential)]
        public struct Margins
        {
            public int Left;
            public int Right;
            public int Top;
            public int Bottom;
        }
    }
}
