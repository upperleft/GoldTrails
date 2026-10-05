// Starter vocabulary. Selected entries are added on save, never during a GET.
export const starterTopics = [
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2801',slug:'gold-panning',name:'Gold panning'},
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2802',slug:'gold-sniping',name:'Gold sniping'},
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2803',slug:'metal-detecting',name:'Metal detecting'},
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2804',slug:'sluicing-highbanking',name:'Sluicing & highbanking'},
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2805',slug:'geology-placer-deposits',name:'Geology & placer deposits'},
 {id:'98e0bd25-ef00-4c4b-bb1f-5377b66b2806',slug:'maps-field-research',name:'Maps & field research'},
];
export function topicChoices(rows) {
 const slugs=new Set(rows.map(t=>t.slug));
 return [...rows,...starterTopics.filter(t=>!slugs.has(t.slug))].sort((a,b)=>a.name.localeCompare(b.name));
}
