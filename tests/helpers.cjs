const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
exports.root = root;
exports.source = file => fs.readFileSync(path.join(root, file), 'utf8');
exports.context = (extra = {}) => vm.createContext({ console, AELT: {}, ...extra });
exports.run = (context, file) => vm.runInContext(exports.source(file), context, { filename: file });
exports.storage = () => {
  const files = new Map(), folders = new Set(['/user', '/extension/data', '/extension/data/organizer-schemes']);
  const fault = {};
  function normalize(p) { return String(p).replace(/\\/g, '/').replace(/\/$/, ''); }
  function File(p) { if (!(this instanceof File)) return new File(p); this.fullName = normalize(p); }
  Object.defineProperties(File.prototype, {
    fsName: {get() {return this.fullName;}}, name: {get() {return this.fullName.split('/').pop();}},
    parent: {get() {return new Folder(this.fullName.slice(0, this.fullName.lastIndexOf('/')));}},
    absoluteURI: {get() {return encodeURI(this.fullName.replace(/^([A-Za-z]):/,function(_,drive){return '/'+drive.toLowerCase();}));}},
    exists: {get() {return files.has(this.fullName);}}
  });
  File.prototype.open = function(mode) { if(fault.open && fault.open(this.fullName,mode)) return false; if(mode==='w') files.set(this.fullName,''); return mode==='w' || this.exists; };
  File.prototype.close = () => true;
  File.prototype.read = function() {return files.get(this.fullName);};
  File.prototype.write = function(text) {if(fault.write) return false; files.set(this.fullName,text);return true;};
  File.prototype.remove = function() {return files.delete(this.fullName);};
  File.prototype.copy = function(destination) {if(!this.exists)return false; files.set(normalize(destination),files.get(this.fullName));return true;};
  File.prototype.rename = function(name) {const destination=this.parent.fullName+'/'+name;if(fault.rename && fault.rename(destination))return false;files.set(destination,files.get(this.fullName));files.delete(this.fullName);this.fullName=destination;return true;};
  function Folder(p) {if(!(this instanceof Folder))return new Folder(p);this.fullName=normalize(p);}
  Object.defineProperties(Folder.prototype,{name:{get(){return this.fullName.split('/').pop();}},fsName:{get(){return this.fullName;}},exists:{get(){return folders.has(this.fullName);}}});
  Folder.prototype.create=function(){folders.add(this.fullName);return true;};
  Folder.prototype.getFiles=function(pattern){const suffix=pattern?pattern.slice(1):'',prefix=this.fullName+'/';const found=[...files.keys()].filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes('/')&&p.endsWith(suffix)).map(p=>new File(p));return pattern?found:found.concat([...folders].filter(p=>p.startsWith(prefix)&&!p.slice(prefix.length).includes('/')).map(p=>new Folder(p)));};
  Folder.userData=new Folder('/user');
  const context=exports.context({File,Folder,AELocalToolkit:{moduleBase:'/extension'}});
  exports.run(context,'extension/host/lib/json.jsx');
  vm.runInContext('AELocalToolkit.returnResult = AELocalToolkit.json.stringify; AELocalToolkit.error = function(e) { return AELocalToolkit.returnResult({ok:false,messages:[String(e)]}); };',context);
  for(const name of ['settings.default.json','organizer-rules.json']) files.set('/extension/data/'+name,exports.source('extension/data/'+name));
  exports.run(context,'extension/host/modules/storage.jsx');
  return {context, files, folders, fault, call:code=>vm.runInContext(code,context)};
};
