export const ok=(res,data=null,message='OK',status=200)=>res.status(status).json({success:true,data,message,error:null});
export const fail=(res,message,code='BAD_REQUEST',details=null,status=400)=>res.status(status).json({success:false,data:null,message,error:{code,details}});
