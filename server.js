import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const db = new DatabaseSync(join(root, 'dashboard.db'));
db.exec(`PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS panels (id INTEGER PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, panel_id INTEGER NOT NULL REFERENCES panels(id) ON DELETE CASCADE, name TEXT NOT NULL, position INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS links (id INTEGER PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, name TEXT NOT NULL, url TEXT NOT NULL, description TEXT DEFAULT '', position INTEGER NOT NULL);`);
if (!db.prepare('SELECT id FROM panels LIMIT 1').get()) {
  db.exec(`INSERT INTO panels (name,position) VALUES ('Personal',0),('Work',1);
  INSERT INTO categories (panel_id,name,position) VALUES (1,'Daily',0),(1,'Discover',1),(2,'Projects',0),(2,'Tools',1);
  INSERT INTO links (category_id,name,url,description,position) VALUES
  (1,'YouTube','https://youtube.com','Watch later, music and subscriptions',0),(1,'Gmail','https://mail.google.com','Inbox zero, someday',1),(2,'The New York Times','https://nytimes.com','Today’s essential reading',0),
  (3,'GitHub','https://github.com','Code, pull requests, and issues',0),(3,'Linear','https://linear.app','Product work in motion',1),(4,'Figma','https://figma.com','Design workspace',0),(4,'Notion','https://notion.so','Notes and team knowledge',1);`);
}
const json = (res, status, value) => { res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(value)); };
function dashboard() {
 const panels = db.prepare('SELECT * FROM panels ORDER BY position').all();
 const cats = db.prepare('SELECT * FROM categories ORDER BY position').all();
 const links = db.prepare('SELECT * FROM links ORDER BY position').all();
 return panels.map(p=>({...p,categories:cats.filter(c=>c.panel_id===p.id).map(c=>({...c,links:links.filter(l=>l.category_id===c.id)}))}));
}
function body(req){ return new Promise(resolve=>{let s='';req.on('data',c=>s+=c);req.on('end',()=>resolve(s?JSON.parse(s):{}));}); }
function next(table, where='', args=[]){ const q=`SELECT COALESCE(MAX(position),-1)+1 AS n FROM ${table}${where}`; return db.prepare(q).get(...args).n; }
function reorder(table, records) { const stmt=db.prepare(`UPDATE ${table} SET position=?${table==='links'?', category_id=?':''} WHERE id=?`); db.exec('BEGIN'); try { records.forEach((r,i)=>table==='links'?stmt.run(i,r.category_id,r.id):stmt.run(i,r.id)); db.exec('COMMIT'); } catch(e){db.exec('ROLLBACK');throw e;} }

const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 try {
  if(url.pathname==='/api/dashboard'&&req.method==='GET') return json(res,200,dashboard());
  if(url.pathname==='/api/panels'&&req.method==='POST'){const b=await body(req); const r=db.prepare('INSERT INTO panels(name,position) VALUES(?,?)').run(b.name,next('panels')); return json(res,201,{id:Number(r.lastInsertRowid)});}
  if(url.pathname==='/api/categories'&&req.method==='POST'){const b=await body(req); const r=db.prepare('INSERT INTO categories(panel_id,name,position) VALUES(?,?,?)').run(b.panel_id,b.name,next('categories',' WHERE panel_id=?',[b.panel_id])); return json(res,201,{id:Number(r.lastInsertRowid)});}
  if(url.pathname.match(/^\/api\/categories\/\d+$/)&&req.method==='DELETE'){db.prepare('DELETE FROM categories WHERE id=?').run(+url.pathname.split('/').pop());return json(res,204,{});}
  if(url.pathname==='/api/links'&&req.method==='POST'){const b=await body(req);const r=db.prepare('INSERT INTO links(category_id,name,url,description,position) VALUES(?,?,?,?,?)').run(b.category_id,b.name,b.url,b.description||'',next('links',' WHERE category_id=?',[b.category_id]));return json(res,201,{id:Number(r.lastInsertRowid)});}
  if(url.pathname.match(/^\/api\/links\/\d+$/)&&req.method==='PUT'){const b=await body(req);db.prepare('UPDATE links SET name=?,url=?,description=?,category_id=? WHERE id=?').run(b.name,b.url,b.description||'',b.category_id,+url.pathname.split('/').pop());return json(res,200,{});}
  if(url.pathname.match(/^\/api\/links\/\d+$/)&&req.method==='DELETE'){db.prepare('DELETE FROM links WHERE id=?').run(+url.pathname.split('/').pop());return json(res,204,{});}
  if(url.pathname==='/api/reorder/categories'&&req.method==='PUT'){reorder('categories',(await body(req)).items);return json(res,200,{});}
  if(url.pathname==='/api/reorder/links'&&req.method==='PUT'){reorder('links',(await body(req)).items);return json(res,200,{});}
  const file=url.pathname==='/'?'index.html':url.pathname.slice(1); const type={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[extname(file)]||'application/octet-stream'; const content=await readFile(join(root,'public',file));res.writeHead(200,{'Content-Type':type});res.end(content);
 } catch(e){ if(e.code==='ENOENT') return json(res,404,{error:'Not found'}); console.error(e);json(res,500,{error:e.message}); }
});
const port = Number(process.env.PORT || 3000);
server.listen(port,()=>console.log(`Orbit Dashboard running at http://localhost:${port}`));
