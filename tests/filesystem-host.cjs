// Read-only adapter for checking script discovery against a caller-supplied directory.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');const {source}=require('./helpers.cjs');
exports.scanDirectory=function(directory){
 function native(value){return path.resolve(String(value));}
 function File(value){if(!(this instanceof File))return new File(value);this.fsName=native(value);}
 function Folder(value){if(!(this instanceof Folder))return new Folder(value);this.fsName=native(value);}
 function exists(target,directory){try{return directory?fs.statSync(target).isDirectory():fs.statSync(target).isFile();}catch{return false;}}
 for(const Type of [File,Folder])Object.defineProperties(Type.prototype,{
   name:{get(){return encodeURIComponent(path.basename(this.fsName));}},
   fullName:{get(){return encodeURI(this.fsName.replace(/\\/g,'/').replace(/^([A-Za-z]):/,(_,drive)=>'/'+drive.toLowerCase()));}},
   absoluteURI:{get(){return this.fullName;}},parent:{get(){return new Folder(path.dirname(this.fsName));}},exists:{get(){return exists(this.fsName,Type===Folder);}}
 });
 Folder.prototype.getFiles=function(){return fs.readdirSync(this.fsName,{withFileTypes:true}).map(entry=>entry.isDirectory()?new Folder(path.join(this.fsName,entry.name)):new File(path.join(this.fsName,entry.name)));};
 Folder.fs=process.platform==='win32'?'Windows':'Macintosh';
 const context=vm.createContext({AELocalToolkit:{},File,Folder});vm.runInContext(source('extension/host/modules/launcher.jsx'),context);context.selectedRoot=path.resolve(directory);
 return JSON.parse(JSON.stringify(vm.runInContext('AELocalToolkit.launcher.scanScripts(selectedRoot)',context)));
};
