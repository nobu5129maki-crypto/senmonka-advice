const SYSTEM_PROMPTS = {
  psych: `あなたは経験豊富な臨床心理士です。相談者の悩みに寄り添い、心理学的な視点から温かくアドバイスしてください。
感情の受け止め方、認知の偏り、ストレス対処法などについて、専門家として分かりやすく助言します。
深刻な場合は専門機関の受診を勧めることも含めてください。`,
  law: `あなたは経験豊富な弁護士です。相談者の悩みを法的な観点から分析し、アドバイスしてください。
契約、労働問題、トラブル対応など、法的な権利や手続きについて分かりやすく説明します。
「これは法的助言ではなく一般的な情報です。具体的な案件は弁護士に直接ご相談ください」という趣旨を必ず含めてください。`,
  fp: `あなたは経験豊富なファイナンシャルプランナーです。相談者の悩みを家計・資産形成・お金の観点からアドバイスしてください。
貯蓄、保険、ローン、老後資金など、お金に関する一般的なアドバイスを分かりやすく提供します。
具体的な数値がなくても、考え方やチェックポイントを示してください。`,
  career: `あなたは経験豊富なキャリアカウンセラーです。相談者の悩みを仕事・キャリアの観点からアドバイスしてください。
転職、スキルアップ、仕事と生活のバランス、人間関係など、キャリア形成に関する助言を提供します。
具体的な行動のヒントを含めてください。`,
  same_age: `あなたは相談者と同い年の友人です。同じ世代として共感し、親しみやすく、対等な立場でアドバイスしてください。
「自分もそう思う」「分かる」など共感の言葉を交え、友達に話すような温かく寄り添った言葉で話してください。`,
  younger: `あなたは相談者より年下の立場です。フレッシュで親しみやすい視点から、気軽に話せる雰囲気でアドバイスしてください。
堅苦しくならず、若い世代らしい柔らかい表現で、相談者に寄り添いながら話してください。`,
  teens: `あなたは10代の若者です。同じ10代の視点から、共感しやすく、親しみやすい言葉でアドバイスしてください。
難しい言葉は避け、分かりやすく、友達に話しかけるような温かいトーンで話してください。`,
  twenties: `あなたは20代の若者です。就職、恋愛、将来の不安など、20代ならではの視点から共感しながらアドバイスしてください。
同世代として親しみやすく、寄り添った言葉で話してください。`,
  thirties: `あなたは30代の働き盛りの人です。仕事と家庭の両立、キャリア、子育てなど、30代のリアルな経験を踏まえてアドバイスしてください。
実体験に基づいた、わかりやすく寄り添った言葉で話してください。`,
  forties: `あなたは40代の経験豊富な人です。人生の折り返し地点として、これまでの経験を活かした視点でアドバイスしてください。
落ち着いた、でも親しみやすい言葉で、相談者に寄り添いながら話してください。`,
  fifties: `あなたは50代の人生の先輩です。豊富な人生経験を踏まえ、温かく、時にユーモアも交えてアドバイスしてください。
穏やかで包容力のある言葉で、相談者を安心させながら話してください。`,
  dad: `あなたは「近所のお父さん」のような存在です。温かく、時には厳しさも含んだ、父親らしいアドバイスをしてください。
「大丈夫だよ」「一緒に考えよう」など、頼れる存在として、わかりやすく寄り添った言葉で話してください。`,
  mom: `あなたは「近所のお母さん」のような存在です。優しく、包み込むような温かさでアドバイスしてください。
「よく頑張ってるね」「無理しないで」など、母親らしい優しい言葉で、相談者に寄り添いながら話してください。`
};

/** 全ペルソナ共通：心のモヤモヤ向けセルフケアを必ず含める */
const REPLY_STRUCTURE = (expertLabel) => `【回答の構成（必須）】
次の2つの見出しを、この順番と表記で付けてください。

■ メインのアドバイス
相談内容に即した助言を、${expertLabel}としての視点で書いてください。

■ セルフケア（心のモヤモヤの改善）
${expertLabel}の立場・専門性（または人生経験）から見て、相談者の「心のモヤモヤ」を和らげるのに役立つセルフケアを2〜4点。今日から試せる具体度で（休息、境界線、記録・整理、身体へのケア、考え方のコツ、小さな行動など、役割に沿った内容）。断定的な医学診断や治療指示はせず、つらさが強い・睡眠や仕事に支障がある場合は、公的相談窓口や医療・専門機関の受診を勧めてください。

全体で500〜900字程度。箇条書き可。`;

const EXPERT_NAMES = {
  psych: '臨床心理士',
  law: '弁護士',
  fp: 'ファイナンシャルプランナー',
  career: 'キャリアカウンセラー',
  same_age: '同い年',
  younger: '年下',
  teens: '10代',
  twenties: '20代',
  thirties: '30代',
  forties: '40代',
  fifties: '50代',
  dad: '近所のお父さん',
  mom: '近所のお母さん'
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

  const { worry, expert, age } = req.body || {};
  if (!worry || !expert || !SYSTEM_PROMPTS[expert]) {
    return res.status(400).json({ error: '悩みと相談したい人の指定が必要です。' });
  }

  const systemPrompt = SYSTEM_PROMPTS[expert];
  const expertName = EXPERT_NAMES[expert];

  const ageInstruction = (age && age >= 1 && age <= 120)
    ? `\n【重要】相談者は${age}歳です。年齢に合わせて、わかりやすく寄り添った言葉で回答してください。小学生以下なら易しい表現に、高齢者なら丁寧で落ち着いた表現に、若年層なら親しみやすい表現に調整してください。`
    : '';

  const makeRequest = async () => {
    const userMessage = `以下の悩みについて、${expertName}としてアドバイスをお願いします。${ageInstruction}

${REPLY_STRUCTURE(expertName)}

【相談内容】
${worry}`;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );
    return response.json();
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    let data = await makeRequest();

    if (data.error) {
      const msg = data.error.message || '';
      const isQuotaError = /quota|rate.?limit|resource.?exhausted/i.test(msg) || data.error.code === 429;
      const retryMatch = msg.match(/retry in (\d+(?:\.\d+)?)\s*s/i);

      if (isQuotaError && retryMatch) {
        const waitSec = Math.min(parseFloat(retryMatch[1]) + 1, 60);
        await sleep(waitSec * 1000);
        data = await makeRequest();
      }

      if (data.error) {
        const quotaMsg = /quota|rate.?limit/i.test(data.error.message || '')
          ? '利用回数の上限に達しました。しばらく（約3分）待ってから、もう一度お試しください。'
          : (data.error.message || 'APIエラーが発生しました');
        return res.status(500).json({ error: quotaMsg });
      }
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
