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
    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetThreadDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

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
    private const uint DESKTOP_ALL = 0x10000000 | 0x01FF;

    static IntPtr _desktopHandle = IntPtr.Zero;

    static void EnsureDesktopAttached() {
        if (_desktopHandle != IntPtr.Zero) return;
        try {
            _desktopHandle = OpenInputDesktop(0, false, DESKTOP_ALL);
            if (_desktopHandle == IntPtr.Zero) {
                _desktopHandle = OpenDesktop("default", 0, false, DESKTOP_ALL);
            }
            if (_desktopHandle != IntPtr.Zero) {
                SetThreadDesktop(_desktopHandle);
            }
        } catch {}
    }

    static string GetTelemetryJson() {
        EnsureDesktopAttached();
        IntPtr hwnd = GetForegroundWindow();
        uint pid = 0;
        string procName = "Unknown";
        string windowTitle = "";

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
            StringBuilder titleSb = new StringBuilder(512);
            GetWindowText(hwnd, titleSb, 512);
            windowTitle = titleSb.ToString();
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
            "{{\"status\":\"OK\",\"hwnd\":\"{0}\",\"processId\":{1},\"executable\":\"{2}\",\"windowTitle\":\"{3}\",\"idleSeconds\":{4}}}",
            hwnd.ToInt64(),
            pid,
            procName.Replace("\\", "\\\\").Replace("\"", "\\\""),
            windowTitle.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " "),
            idleSeconds
        );
    }

    public static void Main(string[] args) {
        EnsureDesktopAttached();
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
