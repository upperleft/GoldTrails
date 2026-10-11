"""Compile vendored us-atlas projected boundaries; no runtime map service needed."""
import json, pathlib, re
root=pathlib.Path(__file__).resolve().parent.parent
topo=json.loads((root/'database/map-data/states-albers-10m.json').read_text())
codes='AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|DE Delaware|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming'
byname={v[3:]:v[:2] for v in codes.split('|')}
arcs=[]
for arc in topo['arcs']:
 x=y=0;points=[]
 for dx,dy in arc:
  x+=dx;y+=dy;points.append([x*topo['transform']['scale'][0]+topo['transform']['translate'][0],y*topo['transform']['scale'][1]+topo['transform']['translate'][1]])
 arcs.append(points)
def ring(indices):
 out=[]
 for i in indices:
  a=arcs[i] if i>=0 else list(reversed(arcs[~i]));out.extend(a if not out else a[1:])
 return out
def center(r):
 pairs=list(zip(r,r[1:]+r[:1]));area=sum(x*v-u*y for (x,y),(u,v) in pairs)
 if abs(area)<.01:return 0,r[0]
 return abs(area),[sum((x+u)*(x*v-u*y) for (x,y),(u,v) in pairs)/(3*area),sum((y+v)*(x*v-u*y) for (x,y),(u,v) in pairs)/(3*area)]
# Coastal labels use short leader lines; the selector remains available for small states.
overrides={'RI':[988,239],'CT':[988,266],'NJ':[988,307],'DE':[988,333],'MD':[988,359],'MA':[988,213],'NH':[970,164],'VT':[927,137],'HI':[305,553]}
states=[]
for g in topo['objects']['states']['geometries']:
 name=g['properties']['name']
 if name not in byname:continue
 polys=g['arcs'] if g['type']=='MultiPolygon' else [g['arcs']]
 rings=[ring(indices) for poly in polys for indices in poly]
 _,centroid=max((center(ring(p[0])) for p in polys),key=lambda a:a[0])
 code=byname[name];label=overrides.get(code,centroid)
 path=''.join('M'+'L'.join(f'{x:.1f},{y:.1f}' for x,y in r)+'Z' for r in rings)
 states.append({'id':'US-'+code,'code':code,'name':name,'slug':name.lower().replace(' ','-'),'fips':g['id'],'path':path,'label':[round(v,1) for v in label],'center':[round(v,1) for v in centroid]})
states.sort(key=lambda s:s['name'])
assert len(states)==50 and len({s['id'] for s in states})==50
(root/'app/almanac/states.json').write_text(json.dumps(states,separators=(',',':'))+'\n')
print('Compiled 50 state boundaries, including Alaska and Hawaii.')
