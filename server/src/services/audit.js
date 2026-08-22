import crypto from "crypto";
import AuditLog from "../models/AuditLog.js";
export async function writeAudit({event,actor="system",actorRole="system",patientId,payload={}}){const previous=await AuditLog.findOne().sort({createdAt:-1}).lean();const previousHash=previous?.hash||"GENESIS";const body=JSON.stringify({event,actor,actorRole,patientId,payload,previousHash});const hash=crypto.createHash("sha256").update(body).digest("hex");return AuditLog.create({event,actor,actorRole,patientId,payload,previousHash,hash})}
