import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app=express();
app.use(cors());
app.use(express.json());

const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const COSTS={caption:1,ad:2,poster:3,script:3};

app.get("/api/health",(_,res)=>res.json({ok:true,app:"BIZAI TZ",database:"supabase"}));

app.post("/api/register",async(req,res)=>{
  const {email,password}=req.body;
  if(!email||!password)return res.status(400).json({error:"Email na password vinahitajika"});
  const {data,error}=await supabase.auth.admin.createUser({email,password,email_confirm:true});
  if(error)return res.status(400).json({error:error.message});
  const {error:pe}=await supabase.from("profiles").insert({id:data.user.id,email,tokens:30});
  if(pe)return res.status(400).json({error:pe.message});
  res.json({userId:data.user.id,email,tokens:30});
});

app.post("/api/login",async(req,res)=>{
  const {email,password}=req.body;
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error)return res.status(401).json({error:error.message});
  const {data:profile}=await supabase.from("profiles").select("tokens").eq("id",data.user.id).single();
  res.json({accessToken:data.session.access_token,userId:data.user.id,email:data.user.email,tokens:profile?.tokens??0});
});

async function getUser(req){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer "))return null;
  const {data}=await supabase.auth.getUser(h.slice(7));
  return data.user||null;
}

app.get("/api/wallet",async(req,res)=>{
  const user=await getUser(req);
  if(!user)return res.status(401).json({error:"Unauthorized"});
  const {data,error}=await supabase.from("profiles").select("tokens").eq("id",user.id).single();
  if(error)return res.status(400).json({error:error.message});
  res.json({tokens:data.tokens});
});

app.post("/api/generate",async(req,res)=>{
  const user=await getUser(req);
  if(!user)return res.status(401).json({error:"Unauthorized"});
  const {type,business,product,price,details}=req.body;
  const cost=COSTS[type];
  if(!cost)return res.status(400).json({error:"Huduma si sahihi"});
  const {data:profile,error:pe}=await supabase.from("profiles").select("tokens").eq("id",user.id).single();
  if(pe)return res.status(400).json({error:pe.message});
  if(profile.tokens<cost)return res.status(402).json({error:"Tokeni hazitoshi"});
  try{
    const prompt=`Wewe ni msaidizi wa biashara Tanzania. Tengeneza ${type} kwa Kiswahili sanifu, kifupi na cha kuvutia.
Biashara: ${business||"haijatajwa"}
Bidhaa/huduma: ${product||"haijatajwa"}
Bei: ${price||"haijatajwa"}
Maelekezo: ${details||"hakuna"}
Jibu liwe tayari kutumika na mteja.`;
    const r=await openai.responses.create({model:process.env.OPENAI_MODEL||"gpt-5",input:prompt});
    const output=r.output_text;
    const {data:newBalance,error:te}=await supabase.rpc("change_tokens",{p_user_id:user.id,p_amount:-cost});
    if(te)return res.status(500).json({error:"Imeshindikana kukata tokeni."});
    await supabase.from("token_transactions").insert({user_id:user.id,amount:-cost,type:"usage",description:`AI ${type}`});
    await supabase.from("generations").insert({user_id:user.id,service:type,tokens_used:cost,input_data:{business,product,price,details},output});
    res.json({content:output,tokens:newBalance,cost});
  }catch(e){console.error(e);res.status(500).json({error:"AI imeshindwa kutengeneza content. Tokeni hazijakatwa."});}
});

app.listen(process.env.PORT||3000,()=>console.log("BIZAI TZ Supabase backend running"));
