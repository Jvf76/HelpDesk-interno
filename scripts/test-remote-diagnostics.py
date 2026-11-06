import importlib.util, pathlib, tempfile, json
p=pathlib.Path(__file__).with_name('sanitize-remote-diagnostics.py')
spec=importlib.util.spec_from_file_location('sanitize',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as folder:
    f=pathlib.Path(folder)/'log'
    f.write_text('unrelated credential=SECRET\nUAI_RELAY_TRANSITION '+json.dumps({'session':'11111111-1111-4111-8111-111111111111','next':'ACTIVE','cookie':'SECRET','reason':'SECRET','at':1793890000000,'elapsedMs':5})+'\nUAI_LOCAL_TRANSITION '+json.dumps({'session':'SECRET','next':'ACTIVE'}))
    rows=m.export(f);assert len(rows)==1;assert rows[0]['next']=='ACTIVE';assert 'SECRET' not in json.dumps(rows);assert rows[0]['elapsedMs']==5
    assert m.sanitize({'session':'11111111-1111-4111-8111-111111111111','code':'token=SECRET','next':'SECRET'}).keys()=={'session'}
print('Diagnostic allowlist: raw secrets, unknown fields, free text and invalid identities excluded.')

r=m.sanitize({'session':'11111111-1111-4111-8111-111111111111','stage':'CREATE_FAILED','numericCode':5,'codeField':'code','errorKind':'Error','message':'SECRET'})
assert r['numericCode']==5 and 'SECRET' not in json.dumps(r)
