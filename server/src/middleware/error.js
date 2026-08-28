export function notFound(req,res){return res.status(404).json({success:false,data:null,message:'Route not found',error:{code:'NOT_FOUND'}});}
export function errorHandler(err,req,res,next){console.error(err);return res.status(err.status||500).json({success:false,data:null,message:err.status?err.message:'Internal server error',error:{code:err.code||'INTERNAL_ERROR'}});}
