import {buildSelectionTopology,selectConnected} from './selection-engine.js';
import {prepareFaceColors} from './surface-colors.js';
let topology=null,appearance=null;
self.onmessage=({data})=>{
  const {id,type}=data,progress=text=>self.postMessage({id,type:'progress',text});
  try{
    if(type==='init'){topology=buildSelectionTopology(data.positions,data.index,progress);appearance=null;self.postMessage({id,type:'ready',stats:{count:topology.count,boundary:topology.boundary,nonManifold:topology.nonManifold}});}
    else if(type==='colors'){
      if(!topology)throw Error('Prepara primero la malla.');
      appearance=prepareFaceColors(data.appearance,topology.count,progress);
      self.postMessage({id,type:'ready',source:appearance.hasTexture?'textura UV':appearance.hasVertexColors?'colores de vértices':'material uniforme'});
    }else if(type==='select'){
      if(!topology)throw Error('Prepara primero la malla.');
      const options=data.options;
      if(options.kind!=='brush')options.seedColor=appearance?.sample(options.seed,options.weights);
      const faces=selectConnected(topology,options,appearance?.colors);
      self.postMessage({id,type:'selection',faces},[faces.buffer]);
    }
  }catch(e){self.postMessage({id,type:'error',message:e.message||String(e)});}
};
