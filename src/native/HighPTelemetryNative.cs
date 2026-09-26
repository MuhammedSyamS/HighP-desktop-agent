using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;

public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
}

public class Program {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("kernel32.dll")]
    public static extern ulong GetTickCount64();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern IntPtr OpenProcess(uint processAccess, bool bInheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool QueryFullProcessImageName(IntPtr hProcess, uint flags, StringBuilder lpExeName, ref uint lpdwSize);

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool CloseHandle(IntPtr hObject);

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

    static string GetTelemetryJson() {
        IntPtr hwnd = GetForegroundWindow();
        uint pid = 0;
        string procName = "Unknown";

        if (hwnd != IntPtr.Zero) {
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid > 0) {
                try {
                    using (Process p = Process.GetProcessById((int)pid)) {
                        procName = p.ProcessName + ".exe";
                    }
                } catch {
                    IntPtr hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
                    if (hProc != IntPtr.Zero) {
                        try {
                            StringBuilder sb = new StringBuilder(1024);
                            uint size = (uint)sb.Capacity;
                            if (QueryFullProcessImageName(hProc, 0, sb, ref size)) {
                                procName = Path.GetFileName(sb.ToString());
                            }
                        } finally {
                            CloseHandle(hProc);
                        }
                    }
                }
            }
        }

        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(lii);
        ulong idleSeconds = 0;
        if (GetLastInputInfo(ref lii)) {
            ulong ticks = GetTickCount64();
            uint current32 = (uint)(ticks & 0xFFFFFFFF);
            uint elapsedMs = current32 >= lii.dwTime ? current32 - lii.dwTime : (uint.MaxValue - lii.dwTime + current32);
            idleSeconds = elapsedMs / 1000;
        }

        return string.Format(
            "{{\"status\":\"OK\",\"hwnd\":\"{0}\",\"processId\":{1},\"executable\":\"{2}\",\"idleSeconds\":{3}}}",
            hwnd.ToInt64(),
            pid,
            procName.Replace("\\", "\\\\").Replace("\"", "\\\""),
            idleSeconds
        );
    }

    public static void Main(string[] args) {
        bool streamMode = args.Length > 0 && args[0] == "--stream";
        if (streamMode) {
            Console.WriteLine("{\"status\":\"READY\"}");
            Console.Out.Flush();
            string line;
            while ((line = Console.ReadLine()) != null) {
                if (line == "exit" || line == "quit") break;
                Console.WriteLine(GetTelemetryJson());
                Console.Out.Flush();
            }
        } else {
            Console.WriteLine(GetTelemetryJson());
        }
    }
}
