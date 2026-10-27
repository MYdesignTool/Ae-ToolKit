const vm=require('node:vm');const {context,run}=require('./helpers.cjs');
const names={anchorPoint:'ADBE Anchor Point',position:'ADBE Position',scale:'ADBE Scale',rotation:'ADBE Rotate Z',opacity:'ADBE Opacity',orientation:'ADBE Orientation',xRotation:'ADBE Rotate X',yRotation:'ADBE Rotate Y'};
function fixture(configs=[{},{}]){
  function CompItem(){};let serial=100;
  function layer(config={},index=1){
    const props={},result={id:++serial,index,name:config.name||'图层 '+index,threeDLayer:!!config.threeD,locked:!!config.locked,parentProperty:null};
    const group={name:'变换',propertyIndex:1,parentProperty:result,propertyType:2,property:match=>props[match]||null};
    function property(key,match,propertyIndex){let expression=config.existing?.[key]||'';
      const prop={name:match,propertyIndex,parentProperty:group,propertyType:1,propertyDepth:2,propertyGroup:()=>result,canSetExpression:true,expressionEnabled:!!expression,writes:0,
        get expression(){return expression;},set expression(value){expression=value;this.writes++;if(!value)this.expressionEnabled=false;},
        get expressionError(){return expression==='bad'||expression==='needsVector'&&key==='opacity'?'Expression error':'';}};
      props[match]=prop;return prop;
    }
    let count=1;for(const [key,match] of Object.entries(names)){
      if((!result.threeDLayer&&['orientation','xRotation','yRotation'].includes(key))||(config.missing||[]).includes(key))continue;
      property(key,match,count++);
    }
    if(config.separated){const leader=props[names.position],followers=[];leader.isSeparationLeader=true;leader.dimensionsSeparated=true;leader.canSetExpression=false;
      for(let axis=0;axis<(result.threeDLayer?3:2);axis++)followers.push(property('position'+axis,'ADBE Position_'+axis,20+axis));
      leader.getSeparationFollower=axis=>followers[axis];result.followers=followers;
    }
    result.property=match=>match==='ADBE Transform Group'?group:null;result.props=props;result.group=group;return result;
  }
  const layers=configs.map((config,index)=>layer(config,index+1)),comp=new CompItem();Object.assign(comp,{id:42,name:'Main',selectedProperties:[],selectedLayers:layers});
  const undo=[],ctx=context({AELocalToolkit:{},CompItem,PropertyType:{PROPERTY:1},app:{project:{activeItem:comp},beginUndoGroup:()=>undo.push('begin'),endUndoGroup:()=>undo.push('end')}});
  run(ctx,'extension/host/modules/expressions.jsx');const call=code=>vm.runInContext(code,ctx);
  const api=ctx.AELocalToolkit.expressions;
  return{ctx,comp,layers,undo,names,layer,call,api,
    summary:targets=>call('AELocalToolkit.expressions.getSelectedPropertySummary('+JSON.stringify(targets??[]) +')'),
    apply:(code,targets,overwrite=true,key)=>call('AELocalToolkit.expressions.applyExpression('+[JSON.stringify(code),JSON.stringify(overwrite),JSON.stringify(key||''),JSON.stringify(targets)].join(',')+')')};
}
module.exports={fixture,names};
