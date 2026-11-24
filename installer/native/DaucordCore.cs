/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Daucord Installer core — shared by the GUI and CLI executables.
 * Written in C# 5 so it compiles with the .NET Framework compiler that
 * ships with Windows (no downloads, no extra tooling required).
 *
 * It NEVER starts, stops or restarts Discord.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

[assembly: AssemblyTitle("Daucord Installer")]
[assembly: AssemblyDescription("Daucord installer for Discord (open source Vencord fork)")]
[assembly: AssemblyProduct("Daucord")]
[assembly: AssemblyCompany("Daucord contributors")]
[assembly: AssemblyCopyright("GPL-3.0-or-later - Copyright (c) 2026 Daucord contributors")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

namespace Daucord
{
    public class Install
    {
        public string Key;
        public string Name;
        public string BaseDir;
        public string Version;
        public string Resources;
    }

    public class State
    {
        public string AppAsar;
        public string BackupAsar;
        public string Kind;
        public string Injector;
        public bool IsDaucord;
        public bool IsPatched;
    }

    public static class Core
    {
        public const string Version = "1.0.0";
        public const string ReleasesRepo = "realdausita/Daucord";

        public const string Marker = "Daucord injector";

        static readonly string[] BranchKeys = { "stable", "ptb", "canary", "dev" };
        static readonly string[] BranchNames = { "Discord Stable", "Discord PTB", "Discord Canary", "Discord Development" };
        static readonly string[] BranchDirs = { "Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment" };

        public static readonly string[] EmbeddedFiles = {
            "patcher.js",
            "renderer.js",
            "renderer.css",
            "preload.js",
            "patcher.js.LEGAL.txt",
            "renderer.js.LEGAL.txt"
        };

        public static string DataDir
        {
            get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "Daucord"); }
        }

        public static string DistDir
        {
            get { return Path.Combine(DataDir, "dist"); }
        }

        public static string PatcherPath
        {
            get { return Path.Combine(DistDir, "patcher.js"); }
        }

        // ---------- discovery ----------

        static long[] ParseVersion(string dir)
        {
            string v = Path.GetFileName(dir);
            if (v.StartsWith("app-")) v = v.Substring(4);
            string[] parts = v.Split('.');
            long[] nums = new long[parts.Length];
            for (int i = 0; i < parts.Length; i++)
            {
                long n;
                if (!long.TryParse(parts[i], out n)) n = 0;
                nums[i] = n;
            }
            return nums;
        }

        static int CompareVersions(long[] a, long[] b)
        {
            int len = Math.Max(a.Length, b.Length);
            for (int i = 0; i < len; i++)
            {
                long x = i < a.Length ? a[i] : 0;
                long y = i < b.Length ? b[i] : 0;
                if (x != y) return x < y ? -1 : 1;
            }
            return 0;
        }

        public static List<Install> FindInstalls(string branch, string customDir)
        {
            List<Install> result = new List<Install>();
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            for (int i = 0; i < BranchKeys.Length; i++)
            {
                if (branch != "all" && branch != BranchKeys[i]) continue;

                string baseDir = string.IsNullOrEmpty(customDir) ? Path.Combine(localApp, BranchDirs[i]) : customDir;
                if (!Directory.Exists(baseDir)) continue;

                string[] versions;
                try { versions = Directory.GetDirectories(baseDir, "app-*"); }
                catch { continue; }
                if (versions.Length == 0) continue;

                Array.Sort(versions, delegate(string a, string b)
                {
                    return CompareVersions(ParseVersion(a), ParseVersion(b));
                });

                string latest = versions[versions.Length - 1];
                string resources = Path.Combine(latest, "resources");
                if (!Directory.Exists(resources)) continue;

                Install inst = new Install();
                inst.Key = BranchKeys[i];
                inst.Name = BranchNames[i];
                inst.BaseDir = baseDir;
                inst.Version = Path.GetFileName(latest);
                inst.Resources = resources;
                result.Add(inst);
            }

            return result;
        }

        // ---------- state ----------

        public static State Inspect(Install inst)
        {
            State s = new State();
            s.AppAsar = Path.Combine(inst.Resources, "app.asar");
            s.BackupAsar = Path.Combine(inst.Resources, "_app.asar");

            if (!File.Exists(s.AppAsar) && !Directory.Exists(s.AppAsar))
            {
                s.Kind = "missing";
                return s;
            }

            if (Directory.Exists(s.AppAsar))
            {
                s.Kind = "folder";
                string idx = Path.Combine(s.AppAsar, "index.js");
                if (File.Exists(idx))
                {
                    try { s.Injector = File.ReadAllText(idx); }
                    catch { }
                }
            }
            else
            {
                s.Kind = "file";
                if (File.Exists(s.BackupAsar)) s.Injector = "(asar archive)";
            }

            string escaped = PatcherPath.Replace("\\", "\\\\");
            s.IsDaucord = s.Injector != null && (
                s.Injector.Contains(Marker) ||
                s.Injector.Contains(PatcherPath) ||
                s.Injector.Contains(escaped)
            );

            s.IsPatched = s.Kind == "folder" || (s.Kind == "file" && File.Exists(s.BackupAsar));
            return s;
        }

        public static string StatusText(Install inst)
        {
            State s = Inspect(inst);
            string label;
            if (s.Kind == "missing") label = "unknown (no app.asar)";
            else if (s.IsDaucord) label = "DAUCORD INSTALLED";
            else if (s.IsPatched) label = "another mod installed";
            else label = "clean (no mod)";

            return inst.Name.PadRight(22) + " " + inst.Version.PadRight(14) + " " + label;
        }

        // ---------- payload ----------

        public static void ExtractDist(Action<string> log)
        {
            Directory.CreateDirectory(DistDir);
            Assembly asm = Assembly.GetExecutingAssembly();

            foreach (string name in EmbeddedFiles)
            {
                string resourceName = "Daucord." + name;
                using (Stream st = asm.GetManifestResourceStream(resourceName))
                {
                    if (st == null) throw new IOException("Embedded file not found: " + name);
                    string target = Path.Combine(DistDir, name);
                    using (FileStream fs = new FileStream(target, FileMode.Create, FileAccess.Write))
                    {
                        byte[] buffer = new byte[81920];
                        int read;
                        while ((read = st.Read(buffer, 0, buffer.Length)) > 0)
                            fs.Write(buffer, 0, read);
                    }
                }
            }

            if (!File.Exists(PatcherPath))
                throw new IOException("Could not extract patcher.js.");
        }

        // ---------- patch / unpatch ----------

        static void WriteInjector(string appAsarDir, bool dryRun, Action<string> log)
        {
            string indexJs = "// " + Marker + " - Vencord fork (GPL-3.0-or-later)\r\n" +
                             "require(\"" + PatcherPath.Replace("\\", "\\\\") + "\");\r\n";
            string pkg = "{\r\n  \"name\": \"discord\",\r\n  \"main\": \"index.js\"\r\n}\r\n";

            if (dryRun)
            {
                log("[dry-run] would write: " + Path.Combine(appAsarDir, "index.js"));
                log("[dry-run] " + indexJs.Trim());
                return;
            }

            Directory.CreateDirectory(appAsarDir);
            File.WriteAllText(Path.Combine(appAsarDir, "index.js"), indexJs, Encoding.UTF8);
            File.WriteAllText(Path.Combine(appAsarDir, "package.json"), pkg, Encoding.UTF8);
        }

        public static bool Install(Install inst, bool repair, bool dryRun, Action<string> log)
        {
            log(">> " + inst.Name + " (" + inst.Version + ")");
            State s = Inspect(inst);

            if (s.Kind == "missing")
            {
                log("ERROR: app.asar not found, this installation is not recognised.");
                return false;
            }

            if (s.IsDaucord && !repair)
            {
                log("Daucord is already installed. Use Repair to rewrite it.");
                if (!File.Exists(Path.Combine(DataDir, "settings", "settings.json"))) AutoMigrate(log);
                return true;
            }

            List<string[]> renames = new List<string[]>();

            try
            {
                if (dryRun) log("[dry-run] Daucord files would be extracted to: " + DistDir);
                else
                {
                    ExtractDist(log);
                    log("Daucord files ready: " + DistDir);
                }

                if (s.Kind == "file" && !File.Exists(s.BackupAsar))
                {
                    log("Backing up: app.asar -> _app.asar");
                    if (!dryRun)
                    {
                        File.Move(s.AppAsar, s.BackupAsar);
                        renames.Add(new string[] { s.AppAsar, s.BackupAsar });
                    }
                }
                else if (s.IsPatched && !s.IsDaucord)
                {
                    string backup = Path.Combine(inst.Resources, "app.asar.backup-" + DateTime.Now.ToString("yyyyMMddHHmmss"));
                    log("Another mod is installed. Backing up: " + Path.GetFileName(backup));
                    if (!dryRun)
                    {
                        if (Directory.Exists(s.AppAsar)) Directory.Move(s.AppAsar, backup);
                        else File.Move(s.AppAsar, backup);
                        renames.Add(new string[] { s.AppAsar, backup });
                    }
                    if (!File.Exists(s.BackupAsar))
                        throw new IOException("_app.asar (original Discord) not found. Stopped for safety.");
                }
                else if (s.IsDaucord && repair)
                {
                    log("Rewriting the existing Daucord injector");
                    if (!dryRun && Directory.Exists(s.AppAsar)) Directory.Delete(s.AppAsar, true);
                }

                WriteInjector(s.AppAsar, dryRun, log);

                if (dryRun) log("[dry-run] Equicord/Vencord settings (if any) would be migrated to Daucord");
                else AutoMigrate(log);

                log(repair ? "Daucord repaired." : "Daucord installed.");
                log("Restart Discord YOURSELF for it to take effect.");
                return true;
            }
            catch (Exception ex)
            {
                log("ERROR: " + ex.Message);
                if (ex is IOException || ex is UnauthorizedAccessException)
                    log("Discord may be running. Close it and try again (this tool never closes Discord).");

                for (int i = renames.Count - 1; i >= 0; i--)
                {
                    try
                    {
                        string from = renames[i][0];
                        string to = renames[i][1];
                        if (Directory.Exists(to) && !Directory.Exists(from)) Directory.Move(to, from);
                        else if (File.Exists(to) && !File.Exists(from)) File.Move(to, from);
                    }
                    catch { }
                }
                return false;
            }
        }

        public static bool Uninstall(Install inst, bool force, bool dryRun, Action<string> log)
        {
            log(">> " + inst.Name + " (" + inst.Version + ")");
            State s = Inspect(inst);

            if (!s.IsPatched)
            {
                log("This installation is already clean (no mod).");
                return true;
            }

            if (!s.IsDaucord && !force)
            {
                log("The installed injector does not belong to Daucord. Use --force to remove it.");
                return false;
            }

            if (!File.Exists(s.BackupAsar))
            {
                log("ERROR: _app.asar backup not found. Manual repair may be required.");
                return false;
            }

            string tmp = Path.Combine(inst.Resources, "app.asar.tmp-" + DateTime.Now.ToString("yyyyMMddHHmmss"));

            try
            {
                if (!dryRun)
                {
                    if (Directory.Exists(s.AppAsar)) Directory.Move(s.AppAsar, tmp);
                    else File.Move(s.AppAsar, tmp);

                    File.Move(s.BackupAsar, s.AppAsar);

                    if (Directory.Exists(tmp)) Directory.Delete(tmp, true);
                    else if (File.Exists(tmp)) File.Delete(tmp);
                }
                else
                {
                    log("[dry-run] the injector would be removed and the original _app.asar restored");
                }

                log("Daucord removed, original Discord restored.");
                log("Restart Discord YOURSELF for it to take effect.");

                string[] backups = Directory.GetDirectories(inst.Resources, "app.asar.backup-*");
                if (backups.Length > 0)
                {
                    log("Note: the previous mod backup is still there: " + Path.GetFileName(backups[0]));
                    log("Run the previous mod's installer again to restore it.");
                }
                return true;
            }
            catch (Exception ex)
            {
                log("ERROR: " + ex.Message);
                if (ex is IOException || ex is UnauthorizedAccessException)
                    log("Discord may be running. Close it and try again (this tool never closes Discord).");
                return false;
            }
        }

        // ---------- settings migration (one-way, source stays read-only) ----------

        public static bool MigrateSettings(string sourceDir, Action<string> log)
        {
            string from = sourceDir;
            if (string.IsNullOrEmpty(from))
            {
                string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
                string equicord = Path.Combine(appData, "Equicord");
                string vencord = Path.Combine(appData, "Vencord");
                if (Directory.Exists(equicord)) from = equicord;
                else if (Directory.Exists(vencord)) from = vencord;
            }

            if (string.IsNullOrEmpty(from) || !Directory.Exists(from))
            {
                log("No Equicord/Vencord settings folder found.");
                return false;
            }

            log("Source : " + from + "  (read-only)");
            log("Target : " + DataDir);

            string srcSettings = Path.Combine(from, "settings");
            string dstSettings = Path.Combine(DataDir, "settings");
            Directory.CreateDirectory(dstSettings);

            string dstJson = Path.Combine(dstSettings, "settings.json");
            if (File.Exists(dstJson))
            {
                string bak = dstJson + ".bak-" + DateTime.Now.ToString("yyyyMMddHHmmss");
                File.Copy(dstJson, bak, true);
                log("Existing Daucord settings backed up: " + Path.GetFileName(bak));
            }

            int count = 0;
            string[] files = { "settings.json", "quickCss.css", "native-settings.json" };
            foreach (string f in files)
            {
                string src = Path.Combine(srcSettings, f);
                if (!File.Exists(src))
                {
                    log("  - " + f + ": not present, skipped");
                    continue;
                }
                File.Copy(src, Path.Combine(dstSettings, f), true);
                log("  + " + f);
                count++;
            }

            string srcThemes = Path.Combine(from, "themes");
            string dstThemes = Path.Combine(DataDir, "themes");
            if (Directory.Exists(srcThemes))
            {
                Directory.CreateDirectory(dstThemes);
                string[] css = Directory.GetFiles(srcThemes, "*.css");
                foreach (string c in css)
                {
                    File.Copy(c, Path.Combine(dstThemes, Path.GetFileName(c)), true);
                    log("  + theme: " + Path.GetFileName(c));
                    count++;
                }
            }
            else
            {
                log("  - themes: no folder, skipped");
            }

            if (count == 0)
            {
                log("No files to migrate.");
                return false;
            }

            log(count + " files migrated. The source folder was not modified; nothing was deleted.");
            return true;
        }

        // ---------- release updates (GitHub) ----------

        public class Release
        {
            public string Tag;
            public string Url;
            public string Sha256;
        }

        static string MatchOne(string text, string pattern)
        {
            Match m = Regex.Match(text, pattern);
            return m.Success ? m.Groups[1].Value : null;
        }

        static int[] ParseTag(string tag)
        {
            string[] parts = tag.Replace("v", "").Replace("V", "").Split('.');
            int[] nums = new int[parts.Length];
            for (int i = 0; i < parts.Length; i++)
            {
                string digits = Regex.Match(parts[i], "^\\d+").Value;
                int n;
                nums[i] = int.TryParse(digits, out n) ? n : 0;
            }
            return nums;
        }

        public static bool IsNewer(string candidate, string current)
        {
            int[] a = ParseTag(candidate);
            int[] b = ParseTag(current);
            int len = Math.Max(a.Length, b.Length);
            for (int i = 0; i < len; i++)
            {
                int x = i < a.Length ? a[i] : 0;
                int y = i < b.Length ? b[i] : 0;
                if (x != y) return x > y;
            }
            return false;
        }

        public static Release FetchLatestRelease(Action<string> log)
        {
            try
            {
                ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;

                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(
                    "https://api.github.com/repos/" + ReleasesRepo + "/releases/latest");
                req.UserAgent = "Daucord-Installer/" + Version;
                req.Accept = "application/vnd.github+json";
                req.Timeout = 8000;
                req.ReadWriteTimeout = 8000;

                string json;
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                using (StreamReader sr = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                    json = sr.ReadToEnd();

                string tag = MatchOne(json, "\"tag_name\"\\s*:\\s*\"([^\"]+)\"");
                string url = null;
                foreach (Match m in Regex.Matches(json, "\"browser_download_url\"\\s*:\\s*\"([^\"]+\\.exe)\""))
                {
                    if (m.Groups[1].Value.IndexOf("Installer", StringComparison.OrdinalIgnoreCase) >= 0)
                    {
                        url = m.Groups[1].Value;
                        break;
                    }
                }

                if (string.IsNullOrEmpty(tag) || url == null)
                {
                    log("No downloadable installer found in the latest release.");
                    return null;
                }

                Release rel = new Release();
                rel.Tag = tag;
                rel.Url = url;

                int pos = json.IndexOf(url, StringComparison.Ordinal);
                if (pos >= 0)
                {
                    int end = Math.Min(json.Length, pos + 4000);
                    string chunk = json.Substring(pos, end - pos);
                    string sha = MatchOne(chunk, "\"digest\"\\s*:\\s*\"sha256:([a-fA-F0-9]{64})\"");
                    if (sha != null) rel.Sha256 = sha.ToLowerInvariant();
                }

                return rel;
            }
            catch (WebException ex)
            {
                HttpWebResponse resp = ex.Response as HttpWebResponse;
                if (resp != null && resp.StatusCode == HttpStatusCode.NotFound)
                    log("No published Daucord release yet · using the bundled build.");
                else
                    log("Update check failed: " + ex.Message);
                return null;
            }
            catch (Exception ex)
            {
                log("Update check failed: " + ex.Message);
                return null;
            }
        }

        public static string DownloadRelease(Release rel, Action<string> log)
        {
            string dir = Path.Combine(Path.GetTempPath(), "daucord-update");
            string file = Path.Combine(dir, "DaucordInstaller-" + rel.Tag + ".exe");

            try
            {
                Directory.CreateDirectory(dir);
                using (WebClient wc = new WebClient())
                {
                    wc.Headers.Add("User-Agent", "Daucord-Installer/" + Version);
                    wc.DownloadFile(rel.Url, file);
                }

                if (rel.Sha256 != null)
                {
                    string got = HashFile(file);
                    if (!string.Equals(got, rel.Sha256, StringComparison.OrdinalIgnoreCase))
                    {
                        try { File.Delete(file); } catch { }
                        log("Checksum mismatch, download discarded.");
                        return null;
                    }
                    log("SHA-256 verified.");
                }

                return file;
            }
            catch (Exception ex)
            {
                log("Download failed: " + ex.Message);
                return null;
            }
        }

        static string HashFile(string path)
        {
            using (SHA256 sha = SHA256.Create())
            using (FileStream fs = File.OpenRead(path))
            {
                byte[] hash = sha.ComputeHash(fs);
                StringBuilder sb = new StringBuilder();
                foreach (byte b in hash) sb.Append(b.ToString("x2"));
                return sb.ToString();
            }
        }

        // Installs every detected Discord branch without any UI (used by the update chain).
        public static bool UpdateAll(Action<string> log)
        {
            List<Install> all = FindInstalls("all", null);
            if (all.Count == 0)
            {
                log("No Discord installation found.");
                return false;
            }

            bool ok = true;
            foreach (Install i in all) ok = Install(i, true, false, log) && ok;
            return ok;
        }

        // Inherits Equicord/Vencord settings on first install; errors never break the install.
        public static void AutoMigrate(Action<string> log)
        {
            try
            {
                string target = Path.Combine(DataDir, "settings", "settings.json");
                if (File.Exists(target))
                {
                    log("Daucord settings already exist; automatic migration skipped.");
                    return;
                }

                log("");
                log("Looking for Equicord/Vencord settings...");
                if (MigrateSettings(null, log))
                    log("Settings migrated to Daucord (source folder untouched).");
                else
                    log("No settings to inherit.");
            }
            catch (Exception ex)
            {
                log("Settings migration skipped: " + ex.Message);
            }
        }
    }
}
