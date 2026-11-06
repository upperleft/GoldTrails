import {readFileSync} from 'node:fs';

// Read the editorial data directly so public profiles do not depend on the Almanac renderer.
function indexCreatorDestinations() {
 const content=JSON.parse(readFileSync(new URL('./content.json',import.meta.url),'utf8'));
 const states=JSON.parse(readFileSync(new URL('./states.json',import.meta.url),'utf8'));
 const statesById=new Map(states.map(state=>[state.id,state]));
 const byCreator=new Map();

 for(const record of content.states){
  const state=statesById.get(record.id);
  for(const destination of record.destinations||[]){
   const place={
    title:destination.title,
    state:state.name,
    href:'/gold-almanac/'+state.slug+'/#destination-'+encodeURIComponent(destination.id)
   };
   for(const {slug} of destination.creatorConnections||[]){
    if(!byCreator.has(slug))byCreator.set(slug,[]);
    byCreator.get(slug).push(place);
   }
  }
 }
 return byCreator;
}

const byCreator=indexCreatorDestinations();
export const destinationsForCreator=slug=>byCreator.get(slug)||[];
