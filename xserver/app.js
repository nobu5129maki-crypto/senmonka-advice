    const experts = {
      psych: { name: '臨床心理士', icon: '🧠', color: '#7c9a9e' },
      law: { name: '弁護士', icon: '⚖️', color: '#8b7355' },
      fp: { name: 'ファイナンシャルプランナー', icon: '💰', color: '#6b8e6f' },
      career: { name: 'キャリアカウンセラー', icon: '📋', color: '#9b7b8e' },
      same_age: { name: '同い年', icon: '🤝', color: '#8b9dc3' },
      younger: { name: '年下', icon: '✨', color: '#b8a9c9' },
      teens: { name: '10代', icon: '🌱', color: '#a8d5ba' },
      twenties: { name: '20代', icon: '🌟', color: '#f5c77a' },
      thirties: { name: '30代', icon: '💼', color: '#e8a87c' },
      forties: { name: '40代', icon: '📊', color: '#85c1e9' },
      fifties: { name: '50代', icon: '🍂', color: '#c38d9e' },
      dad: { name: '近所のお父さん', icon: '👨', color: '#7eb8b8' },
      mom: { name: '近所のお母さん', icon: '👩', color: '#d4a5a5' }
    };

    /** APIが選んだ「ボタン外」専門家の表示用（api/consult.js の OFF_BUTTON_EXPERTS.id と対応） */
    const offListDisplay = {
      zeirishi: { icon: '📑', color: '#4a6b4d' },
      sharoshi: { icon: '📋', color: '#3d4f6b' },
      gyosei: { icon: '📝', color: '#6b5a4a' },
      shiho: { icon: '📜', color: '#5c4a6b' },
      eiyo: { icon: '🥗', color: '#6b8e5c' },
      rinho: { icon: '🏃', color: '#4a7a8c' },
      kyoiku: { icon: '🎓', color: '#8b6b4a' },
      iryo_senmon: { icon: '🩺', color: '#5a6b7c' },
      fudosan: { icon: '🏠', color: '#8b7355' },
      kaigo: { icon: '🤝', color: '#7a6b8e' },
      koshininka: { icon: '💬', color: '#6b8e9e' }
    };

    const worryInput = document.getElementById('worry-input');
    const ageInput = document.getElementById('age-input');
    const responseSection = document.getElementById('response-section');
    const responseIcon = document.getElementById('response-icon');
    const responseTitle = document.getElementById('response-title');
    const responseNote = document.getElementById('response-note');
    const responseContent = document.getElementById('response-content');
    const expertBtns = document.querySelectorAll('.expert-btn');

    async function fetchAIResponse(worry, expertKey, age) {
      const body = { worry, expert: expertKey };
      if (age) body.age = age;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      let res;
      try {
        res = await fetch('./api/consult.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } catch (err) {
        if (err && err.name === 'AbortError') {
          throw new Error('応答に時間がかかっています。少し待ってから、もう一度お試しください。');
        }
        throw new Error('通信できませんでした。接続を確認して、もう一度お試しください。');
      } finally {
        clearTimeout(timer);
      }

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error('回答を受け取れませんでした。もう一度お試しください。');
      }

      if (!res.ok) {
        throw new Error(data.error || 'エラーが発生しました');
      }
      return data;
    }

    function showMessage(expert, message, isError) {
      responseIcon.textContent = expert.icon;
      responseIcon.style.background = expert.color;
      responseTitle.textContent = expert.name + 'からのアドバイス';
      responseNote.hidden = true;
      responseNote.textContent = '';
      responseContent.textContent = message;
      responseContent.classList.toggle('response-placeholder', !isError);
      responseContent.classList.toggle('error-msg', isError);
      responseSection.classList.add('visible');
      responseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setLoading(loading) {
      expertBtns.forEach(btn => {
        btn.disabled = loading;
      });
    }

    expertBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const expertKey = btn.dataset.expert;
        const expert = experts[expertKey];
        const worry = worryInput.value.trim();
        expertBtns.forEach((item) => item.classList.remove('is-selected'));
        btn.classList.add('is-selected');

        if (!worry) {
          showMessage(expert, '悩みを入力してから、相談したい人を選んでください。', false);
          return;
        }
        if (worry.length > 2000) {
          showMessage(expert, '悩みは2000文字以内で入力してください。', true);
          return;
        }

        responseIcon.textContent = expert.icon;
        responseIcon.style.background = expert.color;
        responseTitle.textContent = expert.name + 'からのアドバイス';
        responseNote.hidden = true;
        responseContent.classList.remove('response-placeholder', 'error-msg');
        responseContent.innerHTML = '<span class="loading loading-dots">考え中</span>';
        responseSection.classList.add('visible');
        responseSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setLoading(true);

        try {
          const rawAge = ageInput.value.trim();
          const age = rawAge ? parseInt(rawAge, 10) : null;
          const data = await fetchAIResponse(worry, expertKey, Number.isInteger(age) ? age : null);
          const reply = typeof data.reply === 'string' ? data.reply : '';
          const picked = data.pickedExpert;

          if (picked && picked.name) {
            const ui = offListDisplay[picked.id] || { icon: '💡', color: '#6b7c8e' };
            responseIcon.textContent = ui.icon;
            responseIcon.style.background = ui.color;
            responseTitle.textContent = picked.name + 'からのアドバイス';
            responseNote.textContent = '悩みの内容に合わせ、画面上のボタンにはない専門家の視点を自動で選びました。';
            responseNote.hidden = false;
          } else {
            responseIcon.textContent = expert.icon;
            responseIcon.style.background = expert.color;
            responseTitle.textContent = expert.name + 'からのアドバイス';
            responseNote.hidden = true;
          }

          responseContent.classList.remove('error-msg', 'response-placeholder');
          responseContent.textContent = reply;
        } catch (err) {
          responseNote.hidden = true;
          responseContent.classList.remove('response-placeholder');
          responseContent.classList.add('error-msg');
          responseContent.textContent = err.message || 'エラーが発生しました';
        } finally {
          setLoading(false);
        }
      });
    });
  