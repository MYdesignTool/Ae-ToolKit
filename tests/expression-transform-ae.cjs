// Real ExtendScript engine regression. Uses local fixtures and reads the active selection;
// never changes the open project, its selection, expressions, or undo history.
// Usage: node tests/expression-transform-ae.cjs ".../AfterFX.exe"
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {root}=require('./helpers.cjs');
async function main(){
  const ae=process.argv[2];assert.ok(ae&&fs.existsSync(ae),'Pass the full AfterFX.exe path');
  const out=path.join(root,'.artifacts','0.6.1','selection-ae-'+crypto.randomUUID());fs.mkdirSync(out,{recursive:true});
  const report=path.join(out,'result.txt'),script=path.join(out,'run.jsx'),native=file=>file.replace(/\\/g,'/');
  const source=JSON.stringify(native(path.join(root,'extension/host/modules/expressions.jsx')));
  const jsx=`(function(){
    var output=new File(${JSON.stringify(native(report))});output.encoding='UTF-8';if(!output.open('w'))return;
    function check(value,message){if(!value)throw new Error(message);output.writeln('PASS '+message);}
    function load(){var file=new File(${source});file.encoding='UTF-8';if(!file.open('r'))throw new Error('Cannot read host');var text=file.read();file.close();return text;}
    try{
      output.writeln('AE='+app.version);
      output.writeln('CHAINED_TERNARY='+(true?'properties':true?'layers':'none'));
      var source=load();
      (function(app,CompItem,PropertyType){
        CompItem=app.FixtureComp;var AELocalToolkit={};eval(source);var api=AELocalToolkit.expressions,comp=app.project.activeItem;
        var first=comp.selectedLayers[0],second=comp.selectedLayers[1],summary=api.getSelectedPropertySummary(['position']);
        check(summary.mode==='layers'&&summary.supported===2,'layer-only selection uses chosen transforms');
        comp.selectedProperties=[first.opacity];
        summary=api.getSelectedPropertySummary(['position']);
        check(comp.selectedLayers.length===2&&summary.mode==='properties'&&summary.supported===1,'selected property wins while its layer and another layer remain selected');
        var result=api.applyExpression('value',true,summary.selectionKey,['position']);
        check(result.ok&&result.applied===1&&first.opacity.expression==='value'&&first.position.expression===''&&second.position.expression==='','property apply does not touch checked transforms or other selected layers');
        check(api.getSelectedPropertySummary([]).mode==='properties','property selection works without transform targets');
        comp.selectedProperties=[];first.selectedProperties=[first.opacity];
        check(api.getSelectedPropertySummary(['position']).mode==='properties','layer property list also wins over selected layer');
        first.selectedProperties=[];comp.selectedProperties=[first.group];
        check(api.getSelectedPropertySummary(['position']).mode==='properties'&&!api.applyExpression('value',true,'',['position']).ok,'selected group never falls back to transform writes');
        comp.selectedProperties=[];
        check(api.getSelectedPropertySummary([]).supported===0,'layer-only empty targets stay empty');
        summary=api.getSelectedPropertySummary(['position']);comp.selectedProperties=[first.opacity];
        check(!api.applyExpression('value',true,summary.selectionKey,['position']).ok,'selection change rejects stale layer batch');
      })((function(){
        function FixtureComp(){}var comp=new FixtureComp();comp.id=42;comp.name='Fixture';comp.selectedProperties=[];comp.selectedLayers=[];
        function layer(index){var layer={id:index,index:index,name:'Layer '+index,locked:false,threeDLayer:false,selectedProperties:[],parentProperty:null};
          var group={propertyType:2,parentProperty:layer,propertyIndex:1};
          function prop(name,index){return{name:name,propertyType:1,canSetExpression:true,expression:'',expressionEnabled:false,expressionError:'',propertyDepth:2,propertyIndex:index,parentProperty:group,propertyGroup:function(){return layer;}};}
          layer.opacity=prop('Opacity',11);layer.position=prop('Position',2);layer.group=group;
          group.property=function(name){return name==='ADBE Position'?layer.position:layer.opacity;};layer.property=function(){return group;};return layer;
        }
        comp.selectedLayers=[layer(1),layer(2)];return{project:{activeItem:comp},beginUndoGroup:function(){},endUndoGroup:function(){},FixtureComp:FixtureComp};
      })(),null,{PROPERTY:1});
      (function(){
        var AELocalToolkit={};eval(source);var comp=app.project&&app.project.activeItem;
        if(!(comp instanceof CompItem)){output.writeln('LIVE_SELECTION=no active composition');return;}
        var propertyCount=comp.selectedProperties.length,layers=comp.selectedLayers;
        if(!propertyCount){for(var i=0;i<layers.length;i++)propertyCount+=layers[i].selectedProperties.length;}
        var expected='none';if(propertyCount>0)expected='properties';else if(layers.length>0)expected='layers';
        var result=AELocalToolkit.expressions.getSelectedPropertySummary(['position','opacity']);
        if(!result.ok||result.mode!==expected)throw new Error('Live selection mismatch: '+result.mode+' expected '+expected);
        output.writeln('LIVE_SELECTION='+result.mode+' propertyCount='+propertyCount+' selectedLayers='+layers.length+' supported='+result.supported);
      })();
    }catch(error){output.writeln('ERROR='+String(error)+' line='+error.line);}
    finally{output.writeln('DONE');output.close();}
  })();`;
  fs.writeFileSync(script,'\uFEFF'+jsx);
  const child=cp.spawn(ae,['-r',script],{cwd:out,windowsHide:true,stdio:'ignore'});let launchError;child.on('error',error=>{launchError=error;});child.unref();
  const started=Date.now();let text='';
  while(Date.now()-started<25000){if(launchError)throw launchError;if(fs.existsSync(report)){text=fs.readFileSync(report,'utf8');if(text.trimEnd().endsWith('DONE'))break;}await new Promise(resolve=>setTimeout(resolve,200));}
  assert.ok(text.trimEnd().endsWith('DONE'),'AE did not complete: '+report);assert.ok(!text.includes('ERROR='),text);assert.equal((text.match(/^PASS /gm)||[]).length,8,text);
  console.log(text.trim()+'\nReport: '+report);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
