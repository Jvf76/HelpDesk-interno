namespace UaiSuporte.Printers;
public static class PrinterSchedule {
    // Explicit one-shot LAB request. Never roll a missed run into tomorrow/monthly.
    public static readonly DateTimeOffset Due = new(2026,11,26,14,0,0,TimeSpan.FromHours(-3));
    public static readonly DateTimeOffset Expires = Due.AddMinutes(30);
    public static bool CanRun(string status,DateTimeOffset now,DateTimeOffset? nextAttempt) =>
        status=="ARMED" && now>=Due && now<=Expires && (nextAttempt==null || now>=nextAttempt);
    public static string Recover(string status) => status=="SENDING"?"DELIVERY_UNCONFIRMED":status=="COLLECTING"?"ARMED":status;
}
