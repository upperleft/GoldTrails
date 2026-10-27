
document.addEventListener('click',function(event){
 const link=event.target.closest('a.creator-video');
 if(!link||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
 const width=Math.min(800,screen.availWidth),height=Math.min(600,screen.availHeight);
 const popup=window.open('about:blank','_blank','popup=yes,width='+width+',height='+height+',resizable=yes,scrollbars=yes');
 if(!popup)return;
 popup.opener=null;
 popup.location.replace(link.href);
 event.preventDefault();
});

