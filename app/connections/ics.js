import {eventUrl} from './model.js';
const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
const stamp=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
const fold=line=>{const result=[];let current='',bytes=0;for(const char of line){const n=Buffer.byteLength(char);if(bytes+n>73){result.push(current);current=' ';bytes=1;}current+=char;bytes+=n;}return [...result,current].join('\r\n');};
export function calendarIcs(event,origin){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Gold Trails//Gold Connections//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT','UID:'+event.id+'@goldtrails.org','DTSTAMP:'+stamp(new Date()),'SEQUENCE:'+Number(event.revision||1),'DTSTART:'+stamp(event.startUtc),'DTEND:'+stamp(event.endUtc),'SUMMARY:'+escape(event.title),'DESCRIPTION:'+escape('Gold Connections event. See current details and RSVP at '+origin+eventUrl(event.id)),'LOCATION:'+escape([event.locationName,event.city,event.state].filter(Boolean).join(', ')),'URL:'+origin+eventUrl(event.id),'STATUS:'+(event.status==='cancelled'?'CANCELLED':'CONFIRMED'),'END:VEVENT','END:VCALENDAR'];return lines.map(fold).join('\r\n')+'\r\n';
}
