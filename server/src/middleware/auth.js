import jwt from "jsonwebtoken";
export function auth(req,res,next){const token=req.headers.authorization?.replace("Bearer ","");if(!token)return res.status(401).json({message:"Authentication required"});try{req.user=jwt.verify(token,process.env.JWT_SECRET);next()}catch{return res.status(401).json({message:"Invalid or expired token"})}}
export function roles(...allowed){return(req,res,next)=>{if(!allowed.includes(req.user.role))return res.status(403).json({message:"Insufficient role"});next()}}
