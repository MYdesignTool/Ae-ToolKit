// Read-only local preview of the real panel. Favorites are only held in browser memory.
// Usage: node tests/preview.cjs [optional script directory]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');const {fileURLToPath}=require('node:url');const {root}=require('./helpers.cjs');const {bridge,data}=require('./motion.cjs');
const client=path.join(root,'extension','client'),preview=JSON.parse(JSON.stringify(data));
preview.scan.scripts.forEach((script,index)=>{if(script.iconPath)script.iconPath='/preview-image/'+index;});
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml'};
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://localhost');response.setHeader('Cache-Control','no-store');
 if(url.pathname==='/'){
  preview.changelog=JSON.parse(fs.readFileSync(path.join(root,'extension/data/changelog.json'),'utf8'));
  const mock='('+bridge.toString()+')('+JSON.stringify(preview).replace(/</g,'\\u003c')+');';
  const html=fs.readFileSync(path.join(client,'index.html'),'utf8').replace('<head>','<head><base href="/extension/client/">').replace('<header class="topbar">','<header class="topbar" title="浏览器预览：不执行脚本、不写设置">').replace('<script src="./js/core.js"></script>',()=>'<script>'+mock+'</script><script src="./js/core.js"></script>');
  response.writeHead(200,{'Content-Type':mime['.html']}).end(html);return;
 }
 let file;
 if(/^\/preview-image\/\d+$/.test(url.pathname)){
  const script=data.scan.scripts[Number(url.pathname.split('/').pop())];if(script&&script.iconPath)file=fileURLToPath(script.iconPath);
 }else{
  const candidate=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(candidate.startsWith(client+path.sep))file=candidate;
 }
 if(!file){response.writeHead(404).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){response.writeHead(404).end();return;}response.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'}).end(bytes);});
});
server.listen(Number(process.env.PREVIEW_PORT)||0,'127.0.0.1',()=>process.stdout.write('PREVIEW_URL=http://127.0.0.1:'+server.address().port+'/\n'));
