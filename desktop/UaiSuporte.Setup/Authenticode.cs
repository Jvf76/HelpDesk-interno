using System.Runtime.InteropServices;
namespace UaiSuporte.Setup;

internal static class Authenticode
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct FileInfo { public uint Size; public IntPtr Path, Handle, Subject; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct TrustData
    {
        public uint Size;
        public IntPtr Policy, Sip;
        public uint Ui, Revocation, Choice;
        public IntPtr File;
        public uint StateAction;
        public IntPtr State, Url;
        public uint Flags, Context;
        public IntPtr Signature;
    }
    [DllImport("wintrust.dll", ExactSpelling = true)]
    static extern int WinVerifyTrust(IntPtr window, ref Guid action, ref TrustData data);

    public static void RequireValid(string path, string component = "Componente de acesso remoto", bool offline = false)
    {
        var name = Marshal.StringToCoTaskMemUni(path);
        var info = new FileInfo { Size = (uint)Marshal.SizeOf<FileInfo>(), Path = name };
        var pointer = Marshal.AllocHGlobal(Marshal.SizeOf<FileInfo>());
        Marshal.StructureToPtr(info, pointer, false);
        var action = new Guid("00AAC56B-CD44-11D0-8CC2-00C04FC295EE");
        // Native Authenticode policy, no UI, online revocation chain checking, execute context.
        var data = new TrustData { Size = (uint)Marshal.SizeOf<TrustData>(), Ui = 2, Revocation = 1,
            Choice = 1, File = pointer, StateAction = 1, Flags = (uint)(0x80 | 0x2000 | (offline ? 0x1000 : 0)) };
        try
        {
            var result = WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            if (result != 0) throw new InvalidDataException($"{component} bloqueado pela validação de assinatura do Windows (0x{unchecked((uint)result):X8}). A TI deve verificar assinatura, confiança e evidências de revogação disponíveis neste Windows. Nenhuma proteção foi desativada.");
        }
        finally
        {
            data.StateAction = 2;
            WinVerifyTrust(new IntPtr(-1), ref action, ref data);
            Marshal.FreeHGlobal(pointer);
            Marshal.FreeCoTaskMem(name);
        }
    }
}
