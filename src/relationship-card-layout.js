// Columns describe entity roles, not ownership depth. Cycles and cross-links
// remain explicit edges; a column never asserts control or legal ownership.
export const CARD_WIDTH=224, CARD_HEIGHT=76, COLUMN_GAP=72;
export function layoutRelationshipCards(graph){
  const subsidiaryIds=new Set(graph.edges.filter(e=>e.kind==='subsidiary').map(e=>e.target));
  const definitions=[['capital','Funds & investors','Reporting entities, not ultimate owners'],['companies','Companies & groups','Named companies and disclosed groups'],['subsidiaries','Reported subsidiaries','Only explicitly sourced subsidiary links'],['assets','Assets & brands','Securities, properties and affiliations']];
  const buckets=new Map(definitions.map(([id])=>[id,[]]));
  for(const node of graph.nodes){
    const key=['manager','sovereign','fund','person'].includes(node.kind)?'capital':['asset','brand'].includes(node.kind)?'assets':subsidiaryIds.has(node.id)?'subsidiaries':'companies';
    buckets.get(key).push(node);
  }
  const positions=new Map(),columns=[];let x=24;
  for(const [id,title,description] of definitions){
    const nodes=buckets.get(id);if(!nodes.length)continue;
    nodes.sort((a,b)=>(a.sector||a.kind).localeCompare(b.sector||b.kind)||a.label.localeCompare(b.label));
    let y=116,previous=null;const groups=[];
    for(const node of nodes){const group=node.sector||node.kind;if(group!==previous){groups.push({label:group,y:y-14});if(previous)y+=26;groups.at(-1).y=y-14;previous=group;}positions.set(node.id,{x:x+CARD_WIDTH/2,y:y+CARD_HEIGHT/2,column:id});y+=CARD_HEIGHT+12;}
    columns.push({id,title,description,x,groups,height:y});x+=CARD_WIDTH+COLUMN_GAP;
  }
  return{positions,columns,width:Math.max(320,x-COLUMN_GAP+24),height:Math.max(360,...columns.map(c=>c.height+32))};
}
export function relationshipCurve(a,b,index=0){
  if(a.x===b.x){const side=a.x+CARD_WIDTH/2,reach=side+32+(index%4)*10;return`M ${side} ${a.y} C ${reach} ${a.y}, ${reach} ${b.y}, ${side} ${b.y}`;}
  const direction=b.x>a.x?1:-1,start=a.x+direction*CARD_WIDTH/2,end=b.x-direction*CARD_WIDTH/2,bend=Math.max(36,Math.abs(end-start)*.45);
  return`M ${start} ${a.y} C ${start+direction*bend} ${a.y}, ${end-direction*bend} ${b.y}, ${end} ${b.y}`;
}
