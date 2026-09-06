// Classic Worker: MediaPipe WASM loader requires importScripts.
const base=new URL('./',self.location.href);
let detector;
self.onmessage=async({data})=>{
  if(data.type==='init'){
    try{
      const {FaceLandmarker,FilesetResolver}=await import('./vendor/vision_bundle.mjs');
      const files=await FilesetResolver.forVisionTasks(new URL('./vendor/wasm',base).href);
      detector=await FaceLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/face_landmarker.task',base).href,delegate:'CPU'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true,minFaceDetectionConfidence:.6,minFacePresenceConfidence:.6,minTrackingConfidence:.6});
      self.postMessage({type:'ready'});
    }catch(e){self.postMessage({type:'error',message:String(e)});}
    return;
  }
  if(data.type==='frame'){
    const start=performance.now();
    try{
      const r=detector.detectForVideo(data.bitmap,data.timestamp),face=r.faceLandmarks[0];
      const scores={};for(const s of r.faceBlendshapes[0]?.categories||[])scores[s.categoryName]=s.score;
      self.postMessage({type:'result',timestamp:data.timestamp,ms:performance.now()-start,face:face?[face[234],face[454],face[10],face[152]]:null,smile:((scores.mouthSmileLeft||0)+(scores.mouthSmileRight||0))/2,jaw:scores.jawOpen||0});
    }catch(e){self.postMessage({type:'error',message:String(e)});}
    finally{data.bitmap.close();}
  }
};
