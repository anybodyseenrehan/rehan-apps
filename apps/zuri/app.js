const get = id => document.getElementById(id);
const key = 'zuri.potty.v1';
const day = date => date.toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric',year:'numeric'});
const time = date => date.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
function records(){return JSON.parse(localStorage.getItem(key) || '[]')}
function render(){
  const now=new Date(), all=records().sort((a,b)=>b.at-a.at);
  if (!get('trends-view').hidden) renderTrends(all, now);
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
    const editNote = document.createElement('button');
    const action = item.note ? 'Edit note' : 'Add note';
    editNote.textContent = '✎';
    editNote.title = action;
    editNote.setAttribute('aria-label', action + ' for ' + kind.textContent + ' at ' + stamp.textContent);
    editNote.onclick = () => {
      const draft = window.prompt(action + ' for ' + kind.textContent + ' at ' + stamp.textContent, item.note || '');
      if (draft === null) return;
      const entries = records();
      const entry = entries.find(record => record.id === item.id);
      if (!entry) { render(); return; }
      entry.note = draft.trim();
      save(entries, entry.note ? 'Note saved.' : 'Note cleared.');
    };
    label.append(kind,place);
    row.append(label,stamp,editNote,remove);
    const entryBlock = document.createElement('div');
    entryBlock.className = 'history-entry';
    entryBlock.append(row);
    if (item.note) {
      const note = document.createElement('p');
      note.className = 'entry-note';
      note.textContent = item.note;
      entryBlock.append(note);
    }
    list.append(entryBlock);
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
function selectView() {
  const trends = location.hash === '#trends';
  get('log-view').hidden = trends;
  get('trends-view').hidden = !trends;
  get(trends ? 'log-link' : 'trends-link').removeAttribute('aria-current');
  get(trends ? 'trends-link' : 'log-link').setAttribute('aria-current', 'page');
  render();
}
get('trend-period').onchange = render;
window.addEventListener('hashchange', selectView);
selectView();window.addEventListener('pageshow',render);window.addEventListener('storage',render);
