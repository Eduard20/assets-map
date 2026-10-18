import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('exact equivalence validates identifiers and separates class, date and same-filer ambiguity',()=>{
 const result=execFileSync('python3',['-c',String.raw`
import importlib.util,tempfile,pathlib,json,gzip,hashlib
spec=importlib.util.spec_from_file_location('matcher','scripts/build-instrument-equivalence.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
assert m.identifier_ok('037833100')
assert not m.identifier_ok('037833101')
assert not m.identifier_ok('000000000')
assert not m.identifier_ok('NO ID')
with tempfile.TemporaryDirectory() as d:
 d=pathlib.Path(d);inputs=[];sources={}
 for filer,classes in [('a',['COM']),('b',['COM']),('c',['CL A']),('d',['COM','COM'])]:
  sid='source-'+filer;url='https://www.sec.gov/'+filer+'.xml'
  xml='<informationTable>'+''.join('<infoTable><nameOfIssuer>Same company</nameOfIssuer><titleOfClass>'+c+'</titleOfClass><cusip>037833100</cusip><sshPrnamtType>SH</sshPrnamtType></infoTable>' for c in classes)+'</informationTable>'
  path=d/(filer+'.xml');path.write_text(xml);sources[url]=str(path)
  data={'portfolioId':filer,'reportingDate':'2026-06-30','reconciliation':{'activeSourceIds':[sid]},'sources':[{'sourceId':sid,'informationTableUrl':url,'informationTableSha256':hashlib.sha256(xml.encode()).hexdigest()}],
  'positions':[{'shareViewEligible':True,'sourceId':sid,'rowOrdinal':i+1,'issuerName':'Same company','securityClass':c,'reportedSecurityId':sid+'-'+str(i),'positionId':sid+'-row-'+str(i)} for i,c in enumerate(classes)]}
  path=d/(filer+'.json.gz');path.write_bytes(gzip.compress(json.dumps(data).encode()));inputs.append(str(path))
 result=m.build(inputs[:3],sources);assert result['groups']==[['source-a-0','source-b-0']]
 assert result['admission']=={'status':'pending'}
 assert '037833100' not in json.dumps(result)
 result=m.build(inputs,sources);assert result['groups']==[];assert result['coverage']['ambiguousSameFilerInstrumentCount']==4
 print('passed')
`],{encoding:'utf8'});assert.match(result,/passed/);
});
