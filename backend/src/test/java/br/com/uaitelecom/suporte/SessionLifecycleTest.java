package br.com.uaitelecom.suporte;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
class SessionLifecycleTest {
 @Test void terminalsAreAbsorbingAndDuplicatesDoNotAdvance(){
  for(String end:SessionLifecycle.TERMINAL){
   assertTrue(SessionLifecycle.allows(end,end));
   for(String active:SessionLifecycle.EDGES.keySet())assertFalse(SessionLifecycle.allows(end,active),end+" -> "+active);
  }
 }
 @Test void everyStageCanStopButCannotSkipFirstFrame(){
  for(String state:SessionLifecycle.EDGES.keySet())assertTrue(SessionLifecycle.allows(state,"STOP_REQUESTED"));
  assertFalse(SessionLifecycle.allows("CONSENT_PENDING","CONTROLLING"));
  assertFalse(SessionLifecycle.allows("ENGINE_CONSENT_PENDING","CONTROLLING"));
  assertFalse(SessionLifecycle.allows("AWAITING_FIRST_FRAME","VIEWING"));
  assertTrue(SessionLifecycle.allows("AWAITING_FIRST_FRAME","FIRST_FRAME_RECEIVED"));
 }
 @Test void timeoutsAreIndependentAndBounded(){
  assertEquals(60,SessionLifecycle.timeout("CONSENT_PENDING"));
  assertEquals(20,SessionLifecycle.timeout("ENGINE_AUTHORIZING"));
  assertEquals(35,SessionLifecycle.timeout("ENGINE_CONSENT_PENDING"));
  assertEquals(15,SessionLifecycle.timeout("TRANSPORT_CONNECTING"));
  assertEquals(15,SessionLifecycle.timeout("AWAITING_FIRST_FRAME"));
  assertEquals(10,SessionLifecycle.timeout("ENGINE_STOPPING"));
 }
}
