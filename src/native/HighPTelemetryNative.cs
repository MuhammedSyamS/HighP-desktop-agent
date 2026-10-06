using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Diagnostics;
using System.Threading;

public struct LASTINPUTINFO {
    public uint cbSize;
    public uint dwTime;
}

[StructLayout(LayoutKind.Sequential)]
public struct POINT {
    public int X;
    public int Y;
}

[StructLayout(LayoutKind.Sequential)]
public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public IntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public POINT pt;
}

public class Program {
    public delegate bool EnumWindowProc(IntPtr hWnd, IntPtr lParam);
    public delegate void WinEventDelegate(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

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
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool EnumChildWindows(IntPtr window, EnumWindowProc callback, IntPtr lParam);

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

    [DllImport("kernel32.dll")]
    public static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    public static extern IntPtr SetWinEventHook(uint eventMin, uint eventMax, IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc, uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    public static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    public static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    public static extern bool TranslateMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    public static extern IntPtr DispatchMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    public static extern bool PostThreadMessage(uint threadId, uint msg, IntPtr wParam, IntPtr lParam);

    private const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;
    private const uint DESKTOP_ALL = 0x10000000 | 0x01FF;
    private const uint EVENT_SYSTEM_FOREGROUND = 0x0003;
    private const uint WINEVENT_OUTOFCONTEXT = 0;
    private const uint WM_QUIT = 0x0012;

    static IntPtr _desktopHandle = IntPtr.Zero;
    static readonly object _syncLock = new object();
    static WinEventDelegate _winEventProc;
    static IntPtr _hookHandle = IntPtr.Zero;
    static uint _mainThreadId = 0;

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

    static void GetProcessInfo(uint pid, out string procName, out string procPath) {
        procName = "Unknown";
        procPath = "";
        if (pid == 0) return;

        IntPtr hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (hProc != IntPtr.Zero) {
            try {
                StringBuilder sb = new StringBuilder(1024);
                uint size = (uint)sb.Capacity;
                if (QueryFullProcessImageName(hProc, 0, sb, ref size)) {
                    procPath = sb.ToString();
                    procName = Path.GetFileName(procPath);
                }
            } finally {
                CloseHandle(hProc);
            }
        }

        if (procName.Equals("Unknown", StringComparison.OrdinalIgnoreCase)) {
            try {
                using (Process p = Process.GetProcessById((int)pid)) {
                    procName = p.ProcessName + ".exe";
                    try {
                        procPath = p.MainModule.FileName;
                    } catch {}
                }
            } catch {}
        }
    }

    static string GetTelemetryJson(string eventType = null) {
        EnsureDesktopAttached();
        IntPtr hwnd = GetForegroundWindow();
        uint pid = 0;
        string procName = "Unknown";
        string procPath = "";
        string windowTitle = "";

        if (hwnd != IntPtr.Zero) {
            GetWindowThreadProcessId(hwnd, out pid);
            if (pid > 0) {
                GetProcessInfo(pid, out procName, out procPath);

                // If the top-level window is ApplicationFrameHost (UWP wrapper), drill down to hosted child
                if (procName.Equals("ApplicationFrameHost.exe", StringComparison.OrdinalIgnoreCase)) {
                    uint hostPid = pid;
                    uint realPid = 0;
                    EnumChildWindows(hwnd, (childHwnd, lParam) => {
                        uint cPid;
                        GetWindowThreadProcessId(childHwnd, out cPid);
                        if (cPid > 0 && cPid != hostPid) {
                            realPid = cPid;
                            return false;
                        }
                        return true;
                    }, IntPtr.Zero);

                    if (realPid > 0) {
                        string childExe;
                        string childPath;
                        GetProcessInfo(realPid, out childExe, out childPath);
                        if (!childExe.Equals("Unknown", StringComparison.OrdinalIgnoreCase)) {
                            pid = realPid;
                            procName = childExe;
                            procPath = childPath;
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

        string eventProp = string.IsNullOrEmpty(eventType) ? "" : string.Format("\"event\":\"{0}\",", eventType);

        return string.Format(
            "{{{0}\"status\":\"OK\",\"hwnd\":\"{1}\",\"processId\":{2},\"executable\":\"{3}\",\"executablePath\":\"{4}\",\"windowTitle\":\"{5}\",\"idleSeconds\":{6},\"timestamp\":\"{7}\"}}",
            eventProp,
            hwnd.ToInt64(),
            pid,
            procName.Replace("\\", "\\\\").Replace("\"", "\\\""),
            procPath.Replace("\\", "\\\\").Replace("\"", "\\\""),
            windowTitle.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " "),
            idleSeconds,
            DateTime.UtcNow.ToString("o")
        );
    }

    static void WinEventProc(IntPtr hWinEventHook, uint eventType, IntPtr hwnd, int idObject, int idChild, uint dwEventThread, uint dwmsEventTime) {
        if (eventType == EVENT_SYSTEM_FOREGROUND && hwnd != IntPtr.Zero) {
            lock (_syncLock) {
                try {
                    Console.WriteLine(GetTelemetryJson("FOREGROUND_CHANGED"));
                    Console.Out.Flush();
                } catch {}
            }
        }
    }

    public static void Main(string[] args) {
        EnsureDesktopAttached();
        bool streamMode = args.Length > 0 && args[0] == "--stream";
        if (streamMode) {
            _mainThreadId = GetCurrentThreadId();

            // Set up event-driven Windows foreground hook
            _winEventProc = new WinEventDelegate(WinEventProc);
            _hookHandle = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, _winEventProc, 0, 0, WINEVENT_OUTOFCONTEXT);

            lock (_syncLock) {
                Console.WriteLine("{\"status\":\"READY\"}");
                Console.Out.Flush();
            }

            // Reader thread for stdin commands (query/poll requests or exit)
            Thread stdinThread = new Thread(() => {
                string line;
                while ((line = Console.ReadLine()) != null) {
                    if (line == "exit" || line == "quit") {
                        if (_hookHandle != IntPtr.Zero) {
                            UnhookWinEvent(_hookHandle);
                            _hookHandle = IntPtr.Zero;
                        }
                        PostThreadMessage(_mainThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
                        break;
                    }
                    lock (_syncLock) {
                        try {
                            Console.WriteLine(GetTelemetryJson(null));
                            Console.Out.Flush();
                        } catch {}
                    }
                }
            });
            stdinThread.IsBackground = true;
            stdinThread.Start();

            // Windows message pump on main thread to receive WinEvents instantaneously
            MSG msg;
            while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
                TranslateMessage(ref msg);
                DispatchMessage(ref msg);
            }

            if (_hookHandle != IntPtr.Zero) {
                UnhookWinEvent(_hookHandle);
                _hookHandle = IntPtr.Zero;
            }
        } else {
            Console.WriteLine(GetTelemetryJson(null));
        }
    }
}
