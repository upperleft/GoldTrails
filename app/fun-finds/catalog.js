import {foodFinds,giftFinds,diyIdeas,snackBreak,unverifiedConcepts,researchExclusions} from './data.js';

export {foodFinds,giftFinds,diyIdeas,snackBreak,unverifiedConcepts,researchExclusions};
export const findPages={
 food:{route:'/gold-you-can-eat/',title:'Gold You Can Eat',eyebrow:'GOLD FUN & FINDS / TREATS & KITCHEN IDEAS',description:'Discover gold-colored candy, foods decorated with real edible gold, places to try them, and original gold-rush kitchen ideas.',intro:'A little treasure for the snack table. Explore nugget-shaped treats, real edible-gold decorations, and a few kitchen adventures of your own.',sections:[{id:'candy',title:'Gold candy & treats',intro:'Nuggets, coins, and other sweet lookalikes. Check the classification: gold color and gold wrapping are different from edible gold.'},{id:'edible-gold',title:'Foods & ingredients with edible gold',intro:'Edible gold is a culinary decoration sold as thin leaf or flakes for foods such as chocolates and cakes. Use only products explicitly labeled edible and intended for food; craft leaf and wrappers are different.'},{id:'experiences',title:'Places to try gold foods',intro:'A golden detour for your travel wish list. Check the location’s current menu, hours, and availability before making a trip.'}]},
 gifts:{route:'/gold-gifts-oddities/',title:'Gold Gifts & Oddities',eyebrow:'GOLD FUN & FINDS / LITTLE TREASURES',description:'Explore nugget-shaped accessories, gold-bar gifts, unusual home details, and clearly labeled gold-themed product concepts.',intro:'Some treasures belong on a hat, a sofa, or a cupboard door. Here are a few unusual finds with a recognizable nugget, bullion, or prospecting connection.',sections:[{id:'accessories',title:'Wear it, pin it, sew it',intro:'Small details with a nugget connection. Materials matter: gold-colored plastic, plating, and real gold are different things.'},{id:'home',title:'A little gold around the house',intro:'A recognizable bullion or nugget shape earns its place here; a gold-colored everyday object alone does not.'},{id:'novelties',title:'Pocket treasures & oddities',intro:'Small gifts with a prospecting or treasure twist. These are outbound discoveries, not products sold by Gold Trails.'}]}
};

const ids=new Set();
for(const [kind,finds] of [['food',foodFinds],['gifts',giftFinds]]){
 const sections=new Set(findPages[kind].sections.map(section=>section.id));
 for(const find of finds){
  if(!find.id||ids.has(find.id))throw new Error('Find needs a unique identity: '+find.id);
  ids.add(find.id);
  if(!sections.has(find.section))throw new Error('Unknown find section: '+find.id);
  if(!find.name||!find.summary||!find.classification||!find.sources?.length)throw new Error('Find needs description, classification and sources: '+find.id);
  if(!['available','listed','unconfirmed','unavailable'].includes(find.availability))throw new Error('Unknown find availability: '+find.id);
 }
}
export function findSummary(){return {food:foodFinds.length,gifts:giftFinds.length,originalIdeas:diyIdeas.length,concepts:unverifiedConcepts.length};}
