const get = id => document.getElementById(id);
const key = 'zuri.potty.v1';
const day = date => date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
const time = date => date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
function records(){return JSON.parse(localStorage.getItem(key) || '[]')}
function render(){
  const now=new Date(), all=records().sort((a,b)=>b.at-a.at);
  get('date').textContent=day(now);
  const today=all.filter(r=>day(new Date(r.at))===day(now));
  const outside=today.filter(r=>r.place==='Outside').length;
  get('summary').textContent=outside+' outside today · '+(today.length-outside)+' indoor accident'+(today.length-outside===1?'':'s');
  const list=get('history'); list.replaceChildren();
  if(!all.length) list.textContent='Zuri’s first potty break will appear here.';
  let previous='';
  for(const item of all){
    const date=new Date(item.at), heading=day(date);
    if(heading!==previous){const h=document.createElement('h3');h.textContent=heading;list.append(h);previous=heading}
    const row=document.createElement('div');row.className='row';
    const label=document.createElement('div'), kind=document.createElement('strong'),place=document.createElement('small'),stamp=document.createElement('time'),remove=document.createElement('button');
    kind.textContent=item.kind==='Both'?'Pee + poop':item.kind;place.textContent=item.place;stamp.textContent=time(date);
    remove.textContent='×';remove.setAttribute('aria-label','Delete '+kind.textContent+' at '+stamp.textContent);
    remove.onclick=()=>{if(confirm('Delete this potty break?')) save(records().filter(r=>r.id!==item.id),'Entry deleted.')};
    label.append(kind,place);row.append(label,stamp,remove);list.append(row);
  }
}
function save(items,message){
  try{localStorage.setItem(key,JSON.stringify(items));render();get('status').textContent=message;return true}
  catch{get('status').textContent='Couldn’t save on this device. Please try again.';return false}
}
document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{
  const earlier=document.querySelector('details').open;
  const at=earlier?new Date(get('when').value).getTime():Date.now();
  if(!Number.isFinite(at)||at>Date.now()){get('status').textContent='Choose a time in the past.';return}
  const place=document.querySelector('[name=place]:checked').value,kind=button.dataset.kind;
  if(save([...records(),{id:crypto.randomUUID(),at,place,kind}],kind+' logged at '+time(new Date(at))+'.')){
    document.querySelector('details').open=false;get('when').value='';document.querySelector('[value=Outside]').checked=true
  }
});
render();window.addEventListener('pageshow',render);window.addEventListener('storage',render);
