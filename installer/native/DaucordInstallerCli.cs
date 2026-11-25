/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Daucord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Daucord Installer (CLI) — like EquilotlCli.
 * Never starts, stops or restarts Discord.
 */

using System;
using System.Collections.Generic;
using System.Text;
using Daucord;

namespace Daucord
{
    public static class Program
    {
        static string GetFlag(string[] args, string flag)
        {
            for (int i = 0; i < args.Length; i++)
            {
                if (args[i] == flag && i + 1 < args.Length) return args[i + 1];
            }
            return null;
        }

        static bool HasFlag(string[] args, string flag)
        {
            for (int i = 0; i < args.Length; i++)
                if (args[i] == flag) return true;
            return false;
        }

        static void Log(string msg)
        {
            Console.WriteLine(msg);
        }

        static int Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;
                Console.InputEncoding = Encoding.UTF8;
            }
            catch { }

            string command = "status";
            for (int i = 0; i < args.Length; i++)
            {
                if (!args[i].StartsWith("--"))
                {
                    command = args[i];
                    break;
                }
            }

            string branch = GetFlag(args, "--branch");
            if (branch == null) branch = "stable";
            string customDir = GetFlag(args, "--discord-dir");
            bool dryRun = HasFlag(args, "--dry-run");
            bool force = HasFlag(args, "--force");

            if (command == "help" || command == "--help" || command == "-h")
            {
                Log("Daucord Installer CLI");
                Log("");
                Log("Usage:");
                Log("  DaucordInstallerCli.exe install            install into Discord Stable");
                Log("  DaucordInstallerCli.exe install --branch all");
                Log("  DaucordInstallerCli.exe uninstall [--force]");
                Log("  DaucordInstallerCli.exe repair");
                Log("  DaucordInstallerCli.exe status [--branch all]");
                Log("  DaucordInstallerCli.exe migrate [--from <Equicord/Vencord settings folder>]");
                Log("");
                Log("Flags: --branch <stable|ptb|canary|dev|all>, --dry-run, --force, --discord-dir <path>");
                Log("Note: this tool never closes or starts Discord. Restart Discord yourself after installing.");
                return 0;
            }

            if (command == "migrate")
            {
                try
                {
                    return Core.MigrateSettings(GetFlag(args, "--from"), Log) ? 0 : 1;
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine("ERROR: " + ex.Message);
                    return 1;
                }
            }

            List<Install> installs = Core.FindInstalls(branch, customDir);
            if (installs.Count == 0)
            {
                Console.Error.WriteLine("No Discord installation found." + (string.IsNullOrEmpty(customDir) ? " Try --discord-dir." : ""));
                return 1;
            }

            bool success = true;
            foreach (Install inst in installs)
            {
                switch (command)
                {
                    case "install":
                        success = Core.Install(inst, false, dryRun, Log) && success;
                        break;
                    case "repair":
                        success = Core.Install(inst, true, dryRun, Log) && success;
                        break;
                    case "uninstall":
                        success = Core.Uninstall(inst, force, dryRun, Log) && success;
                        break;
                    case "status":
                        Log("  " + Core.StatusText(inst));
                        break;
                    default:
                        Console.Error.WriteLine("Unknown command: " + command);
                        return 1;
                }
            }

            return success ? 0 : 1;
        }
    }
}
