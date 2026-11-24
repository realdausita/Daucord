/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Daucord branding generator.
 * Crops the master artwork, rounds the corners with transparency and writes
 * the PNG size set + a multi-size .ico. Uses only System.Drawing, so it
 * compiles with the csc.exe bundled with Windows.
 *
 * Usage: make-icons.exe <source image> <branding dir>
 */

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

static class MakeIcons
{
    // Panel bounds inside the 1024x1024 master artwork.
    const int CropX = 181;
    const int CropY = 182;
    const int CropW = 665;
    const int CropH = 660;
    const float CornerRadius = 168f;

    // Icon-only crop: just the D + C + cat, without the wordmark.
    const int IconX = 225;
    const int IconY = 186;
    const int IconSize = 524;
    const float IconRadius = 184f;

    static GraphicsPath RoundedRect(RectangleF r, float radius)
    {
        GraphicsPath p = new GraphicsPath();
        float d = radius * 2f;
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    static Bitmap Master(string input)
    {
        return Build(input, CropX, CropY, CropW, CropH, CornerRadius);
    }

    static Bitmap IconMaster(string input)
    {
        using (Bitmap src = new Bitmap(input))
        {
            EraseWordmark(src);
            return Build(src, IconX, IconY, IconSize, IconSize, IconRadius);
        }
    }

    // The master artwork has a "daucord" wordmark under the icon. The app icon
    // crops it out, so we first replace that band with the panel's own gradient
    // (sampled from the untouched left/right edges) to avoid a visible patch.
    static void EraseWordmark(Bitmap img)
    {
        const int top = 642;
        const int bottom = 712;
        const int left = 192;
        const int right = 828;

        for (int y = top; y <= bottom; y++)
        {
            Color l = img.GetPixel(left, y);
            Color r = img.GetPixel(right, y);
            for (int x = left + 1; x < right; x++)
            {
                float t = (float)(x - left) / (right - left);
                int rr = (int)(l.R + (r.R - l.R) * t + 0.5f);
                int gg = (int)(l.G + (r.G - l.G) * t + 0.5f);
                int bb = (int)(l.B + (r.B - l.B) * t + 0.5f);
                img.SetPixel(x, y, Color.FromArgb(rr, gg, bb));
            }
        }
    }

    static Bitmap Build(string input, int cx, int cy, int cw, int ch, float radius)
    {
        using (Bitmap src = new Bitmap(input))
        {
            return Build(src, cx, cy, cw, ch, radius);
        }
    }

    static Bitmap Build(Bitmap src, int cx, int cy, int cw, int ch, float radius)
    {
        {
            Bitmap master = new Bitmap(1024, 1024, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(master))
            {
                g.SmoothingMode = SmoothingMode.AntiAlias;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.Clear(Color.Transparent);
                g.DrawImage(src, new Rectangle(0, 0, 1024, 1024),
                    new Rectangle(cx, cy, cw, ch), GraphicsUnit.Pixel);
            }

            using (Bitmap mask = new Bitmap(1024, 1024, PixelFormat.Format32bppArgb))
            {
                using (Graphics g = Graphics.FromImage(mask))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.Clear(Color.Transparent);
                    using (GraphicsPath path = RoundedRect(new RectangleF(0, 0, 1024, 1024), radius))
                    using (SolidBrush brush = new SolidBrush(Color.White))
                        g.FillPath(brush, path);
                }
                ApplyMask(master, mask);
            }

            return master;
        }
    }

    static void ApplyMask(Bitmap target, Bitmap mask)
    {
        Rectangle rect = new Rectangle(0, 0, target.Width, target.Height);
        BitmapData td = target.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        BitmapData md = mask.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);

        int bytes = Math.Abs(td.Stride) * target.Height;
        byte[] t = new byte[bytes];
        byte[] m = new byte[bytes];
        Marshal.Copy(td.Scan0, t, 0, bytes);
        Marshal.Copy(md.Scan0, m, 0, bytes);

        for (int i = 3; i < bytes; i += 4)
            t[i] = (byte)((t[i] * m[i]) / 255);

        Marshal.Copy(t, 0, td.Scan0, bytes);
        target.UnlockBits(td);
        mask.UnlockBits(md);
    }

    static Bitmap Resize(Bitmap source, int size)
    {
        Bitmap result = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using (Graphics g = Graphics.FromImage(result))
        {
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);
            g.DrawImage(source, new Rectangle(0, 0, size, size));
        }
        return result;
    }

    static byte[] PngBytes(Bitmap source, int size)
    {
        using (Bitmap resized = Resize(source, size))
        using (MemoryStream ms = new MemoryStream())
        {
            resized.Save(ms, ImageFormat.Png);
            return ms.ToArray();
        }
    }

    static void SavePng(Bitmap master, string path, int size)
    {
        using (Bitmap resized = Resize(master, size))
            resized.Save(path, ImageFormat.Png);
    }

    static void WriteIco(Bitmap master, string path, int[] sizes)
    {
        List<byte[]> blobs = new List<byte[]>();
        foreach (int s in sizes) blobs.Add(PngBytes(master, s));

        using (FileStream fs = new FileStream(path, FileMode.Create))
        using (BinaryWriter w = new BinaryWriter(fs))
        {
            w.Write((short)0);
            w.Write((short)1);
            w.Write((short)sizes.Length);

            int offset = 6 + 16 * sizes.Length;
            for (int i = 0; i < sizes.Length; i++)
            {
                int s = sizes[i];
                w.Write((byte)(s >= 256 ? 0 : s));
                w.Write((byte)(s >= 256 ? 0 : s));
                w.Write((byte)0);
                w.Write((byte)0);
                w.Write((short)1);
                w.Write((short)32);
                w.Write(blobs[i].Length);
                w.Write(offset);
                offset += blobs[i].Length;
            }

            foreach (byte[] blob in blobs) w.Write(blob);
        }
    }

    static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Kullanim: make-icons.exe <kaynak-gorsel> <branding-klasoru>");
            return 1;
        }

        string input = args[0];
        string outDir = args[1];
        Directory.CreateDirectory(outDir);

        using (Bitmap master = IconMaster(input))
        {
            int[] pngSizes = { 1024, 512, 256, 128, 96, 64, 48, 32, 24, 16 };
            foreach (int s in pngSizes)
            {
                string path = Path.Combine(outDir, "daucord-" + s + ".png");
                SavePng(master, path, s);
                Console.WriteLine("  + " + Path.GetFileName(path));
            }

            string ico = Path.Combine(outDir, "daucord.ico");
            WriteIco(master, ico, new int[] { 16, 24, 32, 48, 64, 128, 256 });
            Console.WriteLine("  + " + Path.GetFileName(ico));
        }

        using (Bitmap wordmark = Master(input))
        {
            SavePng(wordmark, Path.Combine(outDir, "daucord-wordmark-1024.png"), 1024);
            SavePng(wordmark, Path.Combine(outDir, "daucord-wordmark-512.png"), 512);
            Console.WriteLine("  + daucord-wordmark-1024.png");
            Console.WriteLine("  + daucord-wordmark-512.png");
        }

        Console.WriteLine("Tamamlandi: " + outDir);
        return 0;
    }
}
