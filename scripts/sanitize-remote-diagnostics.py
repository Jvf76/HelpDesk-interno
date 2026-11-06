#!/usr/bin/env python3
"""Offline allowlist exporter. Never copy raw logs, configuration, URLs or exception text."""
import argparse, datetime, json, pathlib, uuid

STATES=set('REQUESTED TARGET_NOTIFIED CONSENT_PENDING CONSENT_ACCEPTED_VIEW CONSENT_ACCEPTED_CONTROL CONSENT_REJECTED ENGINE_AUTHORIZING TRANSPORT_CONNECTING ENGINE_CONSENT_PENDING AWAITING_FIRST_FRAME FIRST_FRAME_RECEIVED VIEWING CONTROLLING STOP_REQUESTED ENGINE_STOPPING TERMINATED EXPIRED REVOKED FAILED READY CONNECTING AWAITING_CONSENT CONSENTED AWAITING_RENDER ACTIVE ENDED PENDING'.split())
CODES=set('DIALOG_SESSION_ZERO DIALOG_WRONG_SESSION DIALOG_PLACEMENT_UNCONFIRMED ACTIVE_SESSION_UNKNOWN LOCAL_STOP REQUESTER_STOP REJECTED EXPIRED REVOKED STAGE_TIMEOUT AUTHORIZATION_TIMEOUT ENGINE_ERROR ENGINE_UNREACHABLE STOP_UNCONFIRMED TRANSPORT_TIMEOUT ENGINE_CONSENT_TIMEOUT FIRST_FRAME_TIMEOUT RENDER_TIMEOUT DISCONNECTED CONNECTION_LOST PRIVACY_BAR_FAILED CONSENT_MISSING PROTOCOL_ERROR LEASE_LOST SERVER_STOP LOCAL_STOP_PRIORITY PRESENTER_LOST_STOP NETWORK_FAILED_STOP DESKTOP_LOCKED WINDOWS_SESSION_CHANGED SESSION_ENDED SERVICE_STOP WATCHDOG_FAILED'.split())
COMPONENTS={'BACKEND','MESH_RELAY','MESH_CONTROL','LOCAL_UI','WINDOWS_SERVICE','AGENT_POLL','AGENT_DECISION'}
def sanitize(row):
    out={}
    for key in ('session','session_id','target','target_device_id','requester_device_id','requester_user_id'):
        try: out[key]=str(uuid.UUID(str(row[key])))
        except (ValueError,KeyError,TypeError): pass
    if not ('session' in out or 'session_id' in out): return None
    for key in ('previous','next','previous_state','next_state','lastState'):
        if isinstance(row.get(key),str) and row[key] in STATES: out[key]=row[key]
    for key in ('code','error_code','reason'):
        if isinstance(row.get(key),str) and row[key] in CODES: out[key]=row[key]
    if isinstance(row.get('component'),str) and row['component'] in COMPONENTS: out['component']=row['component']
    for key in ('mode','requested_mode','granted_mode'):
        if row.get(key) in ('VIEW','CONTROL'): out[key]=row[key]
    for key in ('at','occurred_at'):
        value=row.get(key)
        if type(value) is int and 0<value<4102444800000: out[key]=value
        elif isinstance(value,str) and len(value)<=40:
            try: out[key]=datetime.datetime.fromisoformat(value.replace('Z','+00:00')).isoformat()
            except ValueError: pass
    for key in ('elapsedMs','elapsed_ms','viewerMessages','agentMessages'):
        if type(row.get(key)) is int and 0<=row[key]<=86400000: out[key]=row[key]
    for key in ('viewerAttached','peerPaired','protocolRequested','nativeConsentRequested','nativeConsentGranted','privacyBar','firstFrame'):
        if type(row.get(key)) is bool: out[key]=row[key]
    if row.get('stage') in ('REQUESTED','HELPER_CREATED','HELPER_READY','RESPONSE_ACCEPTED','RESPONSE_REJECTED','WINDOW_VISIBLE_REPORTED','CREATE_FAILED','PROMISE_REJECTED'): out['stage']=row['stage']
    if row.get('decision') in ('accept','accept-view','reject'): out['decision']=row['decision']
    for key in ('targetSession','engineSession','consoleSession','helperPid','helperSession','verifiedHelperSession','activeSession','reporterPid'):
        if type(row.get(key)) is int and -1<=row[key]<=2147483647: out[key]=row[key]
    if row.get('errorKind') in ('Error','TypeError','RangeError','ReferenceError','SyntaxError','EvalError','URIError','UNKNOWN'): out['errorKind']=row['errorKind']
    if row.get('codeField') in ('win32Error','lastError','errorCode','errno','code','NONE'): out['codeField']=row['codeField']
    if type(row.get('numericCode')) is int and row['numericCode'] in (-1,2,3,5,6,8,87,1008,1314,1816,-2147024891): out['numericCode']=row['numericCode']
    return out
def export(source):
    if source.stat().st_size>8*1024*1024: raise ValueError('Entrada excede 8 MiB')
    text=source.read_text(errors='replace');rows=[]
    try:
        value=json.loads(text)
        if isinstance(value,list): rows=value
    except ValueError:
        for line in text.splitlines():
            for marker in ('UAI_RELAY_TRANSITION ','UAI_RELAY_DIAGNOSTIC ','UAI_LOCAL_TRANSITION ','UAI_NATIVE_CONSENT ','UAI_LOCAL_CONSENT '):
                if marker in line:
                    try: rows.append(json.loads(line.split(marker,1)[1]))
                    except ValueError: pass
                    break
    return [clean for row in rows if isinstance(row,dict) and (clean:=sanitize(row))]
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=pathlib.Path);parser.add_argument('output',type=pathlib.Path);parser.add_argument('--session',type=uuid.UUID,required=True);args=parser.parse_args()
    if args.input.resolve()==args.output.resolve(): parser.error('Use uma saída separada')
    args.output.write_text(json.dumps([row for row in export(args.input) if row.get("session",row.get("session_id"))==str(args.session)],indent=2,ensure_ascii=False)+'\n')
