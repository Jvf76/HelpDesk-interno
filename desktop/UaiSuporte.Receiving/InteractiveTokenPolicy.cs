namespace UaiSuporte.Agent;

// The requested token-handle rights are decided during duplication. Enabling
// caller privileges afterwards does not repair rights missing from that handle.
public interface IInteractiveTokenOperations {
 void EnableCallerPrivileges();
 void DuplicatePrimary();
 void RestorePrimaryPrivileges();
 void SetSession(int session);
 int SessionId {get;}
 void RestoreCallerPrivileges();
 void DiscardPrimary();
}
public static class InteractiveTokenPolicy {
 // Explicit rights for creating, restoring and setting the private primary copy:
 // ASSIGN_PRIMARY | DUPLICATE | QUERY | ADJUST_PRIVILEGES | ADJUST_DEFAULT |
 // ADJUST_SESSIONID. Keep the combined default/session adjustment access, without
 // requesting ALL_ACCESS, MAXIMUM_ALLOWED, WRITE_DAC or WRITE_OWNER.
 public const uint PrimaryTokenAccess=0x0001|0x0002|0x0008|0x0020|0x0080|0x0100;
 public static void Prepare(int session,IInteractiveTokenOperations operations){
  if(session<=0)throw new InvalidOperationException("INTERACTIVE_SESSION_REQUIRED");
  bool prepared=false;
  try {
   try {
    operations.EnableCallerPrivileges();
    operations.DuplicatePrimary();
    // The engine must not inherit privileges temporarily enabled for its setup.
    operations.RestorePrimaryPrivileges();
    operations.SetSession(session);
    if(operations.SessionId!=session)throw new InvalidOperationException("TOKEN_SESSION_MISMATCH");
   } finally { operations.RestoreCallerPrivileges(); }
   prepared=true;
  } finally { if(!prepared)operations.DiscardPrimary(); }
 }
}
