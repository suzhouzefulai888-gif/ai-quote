export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.json({ status: 'ok', version: '2.1-vercel' });
  const API_KEY = process.env.CLAUDE_API_KEY || '';
  if (!API_KEY) return res.status(500).json({ error: 'No API Key' });
  try {
    const body = req.body;
    let messages = [];
    if (body.action === 'ocr') {
      let img = body.image || '';
      if (img.includes(',')) img = img.split(',')[1];
      messages = [{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:body.media_type||'image/jpeg',data:img}},
        {type:'text',text:'请识别这张询价单/报价单中的产品信息。\n\n请严格按以下JSON格式返回，不要包含其他文字或代码块标记：\n{"products":[{"名称":"产品名称如法兰/弯头/三通","规格":"规格如DN100-PN16","材质":"材质如304/316L/20#","数量":10,"标准":"执行标准"}]}\n\n注意：数量必须是数字，无法识别的字段用空字符串""，尽可能识别所有产品行。规格要保持原始写法。'}
      ]}];
    } else if (body.action === 'parse_text') {
      messages = [{role:'user',content:'你是法兰管件产品识别专家。提取产品信息。\n\n文本：\n'+(body.text||'').substring(0,8000)+'\n\n返回JSON：{"products":[{"名称":"","规格":"","材质":"","数量":0,"标准":""}]}\n数量是数字，无法识别用""。只返回JSON。'}];
    } else { return res.status(400).json({error:'未知操作'}); }
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:4000,messages})
    });
    if (!response.ok) return res.json({success:false,error:'AI识别失败:HTTP'+response.status,products:[]});
    const result = await response.json();
    let text = result.content[0].text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) return res.json({success:true,products:JSON.parse(m[0]).products||[]});
    } catch(e){}
    return res.json({success:false,error:'未识别到产品',products:[]});
  } catch(e) { return res.status(500).json({error:'服务器错误:'+e.message}); }
}
