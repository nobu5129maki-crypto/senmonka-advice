const SYSTEM_PROMPTS = {
  psych: `あなたは経験豊富な臨床心理士です。相談者の悩みに寄り添い、心理学的な視点から温かくアドバイスしてください。
感情の受け止め方、認知の偏り、ストレス対処法などについて、専門家として分かりやすく助言します。
深刻な場合は専門機関の受診を勧めることも含めて、200〜400字程度で回答してください。`,
  law: `あなたは経験豊富な弁護士です。相談者の悩みを法的な観点から分析し、アドバイスしてください。
契約、労働問題、トラブル対応など、法的な権利や手続きについて分かりやすく説明します。
「これは法的助言ではなく一般的な情報です。具体的な案件は弁護士に直接ご相談ください」という趣旨を必ず含めて、200〜400字程度で回答してください。`,
  fp: `あなたは経験豊富なファイナンシャルプランナーです。相談者の悩みを家計・資産形成・お金の観点からアドバイスしてください。
貯蓄、保険、ローン、老後資金など、お金に関する一般的なアドバイスを分かりやすく提供します。
具体的な数値がなくても、考え方やチェックポイントを示して、200〜400字程度で回答してください。`,
  career: `あなたは経験豊富なキャリアカウンセラーです。相談者の悩みを仕事・キャリアの観点からアドバイスしてください。
転職、スキルアップ、仕事と生活のバランス、人間関係など、キャリア形成に関する助言を提供します。
具体的な行動のヒントを含めて、200〜400字程度で回答してください。`
};

const EXPERT_NAMES = {
  psych: '臨床心理士',
  law: '弁護士',
  fp: 'ファイナンシャルプランナー',
  career: 'キャリアカウンセラー'
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'APIキーが設定されていません。Vercelの環境変数に GEMINI_API_KEY を設定してください。'
    });
  }

  const { worry, expert } = req.body || {};
  if (!worry || !expert || !SYSTEM_PROMPTS[expert]) {
    return res.status(400).json({ error: '悩みと専門家の指定が必要です。' });
  }

  const systemPrompt = SYSTEM_PROMPTS[expert];
  const expertName = EXPERT_NAMES[expert];

  try {
    const userMessage = `以下の悩みについて、${expertName}としてアドバイスをお願いします。\n\n${worry}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({
        error: data.error.message || 'APIエラーが発生しました'
      });
    }

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!reply) {
      return res.status(500).json({
        error: data.candidates?.[0]?.finishReason === 'SAFETY' ? '安全フィルターにより回答を生成できませんでした。' : 'APIから有効な回答を取得できませんでした。'
      });
    }
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'サーバーエラーが発生しました'
    });
  }
}
