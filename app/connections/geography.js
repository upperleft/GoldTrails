import {readFileSync} from 'node:fs';
import {states,stateFor,ConnectionsError} from './model.js';
const data=JSON.parse(readFileSync(new URL('./adjacency.json',import.meta.url),'utf8'));
export const adjacency=data.neighbors;
if(Object.keys(adjacency).length!==50||states.some(s=>!adjacency[s.code]||adjacency[s.code].some(n=>!stateFor(n)||n===s.code||!adjacency[n].includes(s.code))))throw Error('Invalid state adjacency');
export function coverageStates(state,range=0){
 const code=stateFor(state)?.code,depth=Number(range);if(!code||!Number.isInteger(depth)||depth<0||depth>2)throw new ConnectionsError('Choose a state and a notification range.');
 const found=new Set([code]);let edge=[code];for(let i=0;i<depth;i++){const next=[];for(const s of edge)for(const n of adjacency[s])if(!found.has(n)){found.add(n);next.push(n);}edge=next;}
 return states.filter(s=>found.has(s.code));
}
