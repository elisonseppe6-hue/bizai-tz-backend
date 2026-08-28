import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const COSTS = { caption: 1, ad: 2, poster: 3, script: 3 };

// DEMO ONLY: in production, token balance must live in a database
const demoUsers = new Map();

app.get("/api/health", (_, res) => res.json({ ok: true, app: "BIZAI TZ" }));

app.post("/api/register", (req,res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error:"Email inahitajika" });
  if (demoUsers.has(email)) return res.status(409).json({ error:"Account tayari ipo" });
  demoUsers.set(email, { email, tokens: 30 });
  res.json({ email, tokens: 30 });
});

app.get("/api/wallet/:email", (req,res) => {
  const user=demoUsers.get(req.params.email);
  if (!user) return res.status(404).json({error:"User hajapatikana"});
  res.json({tokens:user.tokens});
});

app.post("/api/generate", async (req,res) => {
  const { email, type, business, product, price, details } = req.body;
  const cost=COSTS[type];
  if (!cost) return res.status(400).json({error:"Huduma si sahihi"});
  const user=demoUsers.get(email);
  if (!user) return res.status(404).json({error:"User hajapatikana"});
  if (user.tokens < cost) return res.status(402).json({error:"Tokeni hazitoshi"});
  try {
    const prompt=`Wewe ni msaidizi wa biashara Tanzania. Andika ${type} kwa Kiswahili sanifu na cha kuvutia.
Biashara: ${business||"haijatajwa"}
Bidhaa/huduma: ${product||"haijatajwa"}
Bei: ${price||"haijatajwa"}
Maelekezo: ${details||"hakuna"}
Toa jibu tayari kutumika bila maelezo marefu ya ziada.`;
    const response=await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5",
      input: prompt
    });
    user.tokens -= cost;
    res.json({ content: response.output_text, tokens:user.tokens, cost });
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"AI imeshindwa kutengeneza content. Tokeni hazijakatwa."});
  }
});

app.listen(process.env.PORT||3000,()=>console.log("BIZAI TZ API running"));
