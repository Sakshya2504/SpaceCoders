import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAuth(req,res,next){try{const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null;if(!token)return res.status(401).json({success:false,message:'Authentication required'});const payload=jwt.verify(token,process.env.JWT_SECRET);const user=await User.findById(payload.sub).select('-passwordHash');if(!user||!user.active)return res.status(401).json({success:false,message:'Invalid session'});req.user=user;next();}catch(e){return res.status(401).json({success:false,message:'Invalid or expired token'});}}
export const allowRoles=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({success:false,message:'Insufficient permissions'});
export const auth=requireAuth;
