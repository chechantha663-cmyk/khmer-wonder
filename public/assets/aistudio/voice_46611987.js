// សម្លេងនិយាយ ៣ បែប៖
//   🤖 azure  = Microsoft Azure Neural (សម្លេង AI ល្អ មានខ្មែរ ច្រើនភាសា ត្រូវការ key ឥតគិតថ្លៃ)
//   🌐 google = សេវាអនឡាញឥតគិតថ្លៃ (មិនផ្លូវការ អាចដាច់)
//   💻 device = សម្លេងក្នុងឧបករណ៍
// API: VoicePicker.speak(text, lang, {pitch,onstart,onend}) / .stop() / .langProvider
(function () {
  const K = { engine: "voiceEngine2", voice: "voicePick", rate: "voiceRate", key: "azKey", region: "azRegion", gender: "azGender" };
  const synth = window.speechSynthesis;
  const box = document.getElementById("voice-picker");
  let engineSel, voiceSel, rateSel, genderSel, keyInp, regionInp;
  let currentAudio = null, token = 0;

  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
  function note(msg) { const n = document.getElementById("voice-note"); if (n) n.textContent = msg || ""; }
  function langName(code) {
    try { return new Intl.DisplayNames(["km", "en"], { type: "language", languageDisplay: "standard" }).of(code.replace("_", "-")) || code; }
    catch (e) { return code; }
  }
  const SAMPLES = { km: "សួស្តី នេះជាសម្លេងសាកល្បង។", en: "Hello, this is a voice test.", fr: "Bonjour, ceci est un test.",
    es: "Hola, esto es una prueba de voz.", th: "สวัสดี นี่คือการทดสอบเสียง", vi: "Xin chào, đây là thử giọng nói.",
    zh: "你好,这是语音测试。", ja: "こんにちは、音声テストです。", ko: "안녕하세요, 음성 테스트입니다." };
  const AZ = { // [ស្រី, ប្រុស]
    "km-KH": ["km-KH-SreymomNeural", "km-KH-PisethNeural"], "en-US": ["en-US-AnaNeural", "en-US-GuyNeural"],
    "fr-FR": ["fr-FR-DeniseNeural", "fr-FR-HenriNeural"], "es-ES": ["es-ES-ElviraNeural", "es-ES-AlvaroNeural"],
    "th-TH": ["th-TH-PremwadeeNeural", "th-TH-NiwatNeural"], "vi-VN": ["vi-VN-HoaiMyNeural", "vi-VN-NamMinhNeural"],
    "zh-CN": ["zh-CN-XiaoxiaoNeural", "zh-CN-YunxiNeural"], "ja-JP": ["ja-JP-NanamiNeural", "ja-JP-KeitaNeural"],
    "ko-KR": ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural"]
  };
  function fullLang(lang) {
    if (AZ[lang]) return lang;
    const base = (lang || "en").slice(0, 2).toLowerCase();
    return Object.keys(AZ).find(function (k) { return k.slice(0, 2) === base; }) || "en-US";
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function stopAudio() {
    if (currentAudio) { try { currentAudio.pause(); } catch (e) {} currentAudio.onended = currentAudio.onerror = currentAudio.onplaying = null; currentAudio = null; }
  }
  function playBlobUrl(url, my, opts, rate, fail) {
    const a = new Audio(url);
    a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
    a.playbackRate = rate || 1;
    let started = false;
    a.onplaying = function () { if (!started) { started = true; if (opts.onstart) opts.onstart(); } };
    a.onended = function () { if (my === token && opts.onend) opts.onend(); };
    a.onerror = function () { if (my !== token) return; if (!started) fail("ចាក់ឯកសារសម្លេងមិនបាន"); else if (opts.onend) opts.onend(); };
    currentAudio = a;
    const p = a.play();
    if (p && p.catch) p.catch(function () { if (my === token && !started) fail("កម្មវិធីរុករកមិនអនុញ្ញាតឱ្យចាក់សម្លេង (សូមចុចប៊ូតុងម្តងទៀត)"); });
  }

  // ===== 🤖 Azure Neural =====
  function speakAzure(text, lang, opts, fail) {
    const key = keyInp.value.trim(), region = (regionInp.value.trim() || "southeastasia").toLowerCase();
    if (!key) { fail("សូមបញ្ចូល Azure key ជាមុនសិន"); return; }
    const L = fullLang(lang), voice = AZ[L][genderSel.value === "male" ? 1 : 0];
    const pitch = Math.max(-40, Math.min(60, Math.round(((opts.pitch || 1) - 1) * 60)));
    const rate = Math.round((parseFloat(rateSel.value) - 1) * 100);
    const ssml = "<speak version='1.0' xml:lang='" + L + "'><voice xml:lang='" + L + "' name='" + voice + "'>" +
      "<prosody pitch='" + (pitch >= 0 ? "+" : "") + pitch + "%' rate='" + (rate >= 0 ? "+" : "") + rate + "%'>" + esc(text) + "</prosody></voice></speak>";
    const my = ++token;
    stopAudio();
    fetch("https://" + region + ".tts.speech.microsoft.com/cognitiveservices/v1", {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3" },
      body: ssml
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "Key ឬ Region មិនត្រឹមត្រូវ (" + r.status + ")" : "Azure ឆ្លើយកំហុស " + r.status);
      return r.blob();
    }).then(function (blob) {
      if (my !== token) return;
      playBlobUrl(URL.createObjectURL(blob), my, opts, 1, fail);
    }).catch(function (e) {
      if (my === token) fail(e.message && e.message.indexOf("Failed to fetch") < 0 ? e.message : "ភ្ជាប់ Azure មិនបាន (ពិនិត្យអ៊ីនធឺណិត ឬ Region)");
    });
  }

  // ===== 🌐 Google អនឡាញ (មិនផ្លូវការ) =====
  function chunkText(t) {
    const parts = t.replace(/\s+/g, " ").match(/[^.!?។៕,，。！？\n]+[.!?។៕,，。！？]*/g) || [t];
    const out = []; let cur = "";
    parts.forEach(function (p) { if ((cur + p).length > 160) { if (cur) out.push(cur.trim()); cur = p; } else cur += p; });
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function speakGoogle(text, lang, opts, fail) {
    const my = ++token;
    stopAudio();
    const tl = /^zh/i.test(lang) ? "zh-CN" : lang.split("-")[0].toLowerCase();
    const chunks = chunkText(text);
    const pitch = opts.pitch || 1;
    const rate = Math.min(1.6, Math.max(0.7, (1 + (pitch - 1) * 0.45) * parseFloat(rateSel.value)));
    let i = 0, startedAny = false;
    function next() {
      if (my !== token) return;
      if (i >= chunks.length) { if (opts.onend) opts.onend(); return; }
      const url = "https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=" + encodeURIComponent(tl) + "&q=" + encodeURIComponent(chunks[i++]);
      const a = new Audio();
      a.referrerPolicy = "no-referrer";
      a.preservesPitch = false; a.mozPreservesPitch = false; a.webkitPreservesPitch = false;
      a.src = url; a.playbackRate = rate;
      a.onplaying = function () { if (!startedAny) { startedAny = true; if (opts.onstart) opts.onstart(); } };
      a.onended = next;
      a.onerror = function () { if (my !== token) return; if (!startedAny) fail("សេវា Google ឥតគិតថ្លៃមិនឆ្លើយតប (ប្រហែលជាត្រូវបានរារាំង)"); else if (opts.onend) opts.onend(); };
      currentAudio = a;
      const p = a.play();
      if (p && p.catch) p.catch(function () { if (my === token && !startedAny) fail("សេវា Google ឥតគិតថ្លៃមិនឆ្លើយតប"); });
    }
    next();
  }

  // ===== 💻 ឧបករណ៍ =====
  function getDeviceVoice() {
    if (!voiceSel || voiceSel.value === "auto") return null;
    return synth.getVoices().find(function (v) { return v.voiceURI === voiceSel.value; }) || null;
  }
  function speakDevice(text, lang, opts) {
    if (!synth) { note("កម្មវិធីរុករកនេះមិនគាំទ្រការអានជាសម្លេងទេ។"); if (opts.onend) opts.onend(); return; }
    const u = new SpeechSynthesisUtterance(text);
    let voice = getDeviceVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    else {
      u.lang = lang;
      voice = synth.getVoices().find(function (v) { return v.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()); });
      if (voice) u.voice = voice;
      else note((note.last ? note.last + " " : "") + "ឧបករណ៍នេះគ្មានសម្លេងភាសា " + lang + " ទេ ដូច្នេះអាចស្ងាត់។ សូមប្រើ 🤖 Azure ដើម្បីបានសម្លេងខ្មែរ។");
    }
    u.rate = parseFloat(rateSel.value);
    u.pitch = opts.pitch || 1;
    if (opts.onstart) u.onstart = opts.onstart;
    if (opts.onend) { u.onend = opts.onend; u.onerror = opts.onend; }
    synth.cancel();
    synth.speak(u);
  }

  // ===== ប្រអប់ជ្រើសរើស =====
  function build() {
    if (!box) return;
    box.innerHTML =
      '<label for="engine-select">ប្រភេទសម្លេង</label>' +
      '<select id="engine-select">' +
      '<option value="azure">🤖 AI Azure (សម្លេងល្អ ខ្មែរ+ច្រើនភាសា)</option>' +
      '<option value="google">🌐 Google អនឡាញ (ឥតគិតថ្លៃ មិនស្ថិតស្ថេរ)</option>' +
      '<option value="device">💻 សម្លេងក្នុងឧបករណ៍</option></select>' +
      '<label for="az-key" class="arow">Azure key</label><input id="az-key" class="arow" type="password" placeholder="បិទភ្ជាប់ key នៅទីនេះ" autocomplete="off">' +
      '<label for="az-region" class="arow">Region</label><input id="az-region" class="arow" type="text" placeholder="southeastasia" autocomplete="off">' +
      '<label for="az-gender" class="arow">សម្លេង</label><select id="az-gender" class="arow"><option value="female">ស្រី</option><option value="male">ប្រុស</option></select>' +
      '<label for="voice-select" class="vrow">សម្លេង</label><select id="voice-select" class="vrow"></select>' +
      '<label for="rate-select">ល្បឿន</label>' +
      '<select id="rate-select"><option value="0.8">យឺត</option><option value="1">ធម្មតា</option><option value="1.25">លឿន</option></select>' +
      '<button type="button" id="voice-test">▶ សាកល្បង</button>';
    engineSel = document.getElementById("engine-select");
    voiceSel = document.getElementById("voice-select");
    rateSel = document.getElementById("rate-select");
    genderSel = document.getElementById("az-gender");
    keyInp = document.getElementById("az-key");
    regionInp = document.getElementById("az-region");
    keyInp.value = load(K.key, ""); regionInp.value = load(K.region, "southeastasia");
    genderSel.value = load(K.gender, "female"); rateSel.value = load(K.rate, "1");
    engineSel.value = load(K.engine, keyInp.value ? "azure" : "device");
    engineSel.addEventListener("change", function () { store(K.engine, engineSel.value); syncRows(); });
    keyInp.addEventListener("change", function () { store(K.key, keyInp.value.trim()); });
    regionInp.addEventListener("change", function () { store(K.region, regionInp.value.trim()); });
    genderSel.addEventListener("change", function () { store(K.gender, genderSel.value); });
    voiceSel.addEventListener("change", function () { store(K.voice, voiceSel.value); });
    rateSel.addEventListener("change", function () { store(K.rate, rateSel.value); });
    document.getElementById("voice-test").addEventListener("click", function () {
      store(K.key, keyInp.value.trim()); store(K.region, regionInp.value.trim());
      const lang = api.langProvider();
      api.speak(SAMPLES[(/^zh/i.test(lang) ? "zh" : lang.slice(0, 2))] || SAMPLES.en, lang);
    });
    syncRows(); fillVoices();
  }
  function syncRows() {
    const e = engineSel.value;
    box.querySelectorAll(".arow").forEach(function (el) { el.style.display = e === "azure" ? "" : "none"; });
    box.querySelectorAll(".vrow").forEach(function (el) { el.style.display = e === "device" ? "" : "none"; });
  }
  function fillVoices() {
    if (!voiceSel || !synth) return;
    const voices = synth.getVoices(), saved = load(K.voice, "auto");
    voiceSel.innerHTML = '<option value="auto">ស្វ័យប្រវត្តិ (តាមភាសា)</option>';
    const groups = {};
    voices.forEach(function (v) { (groups[v.lang] = groups[v.lang] || []).push(v); });
    Object.keys(groups).sort(function (a, b) {
      const k = function (x) { return x.toLowerCase().startsWith("km") ? 0 : x.toLowerCase().startsWith("en") ? 1 : 2; };
      return k(a) - k(b) || a.localeCompare(b);
    }).forEach(function (lang) {
      const g = document.createElement("optgroup");
      g.label = langName(lang) + " (" + lang + ")";
      groups[lang].forEach(function (v) { const o = document.createElement("option"); o.value = v.voiceURI; o.textContent = v.name; g.appendChild(o); });
      voiceSel.appendChild(g);
    });
    voiceSel.value = Array.from(voiceSel.options).some(function (o) { return o.value === saved; }) ? saved : "auto";
  }

  const api = {
    langProvider: function () { return "km-KH"; },
    stop: function () { token++; stopAudio(); if (synth) synth.cancel(); },
    speak: function (text, lang, opts) {
      opts = opts || {};
      lang = lang || api.langProvider();
      note("");
      const e = engineSel ? engineSel.value : "device";
      const fail = function (why) {
        note.last = "⚠️ " + why + " → ប្រើសម្លេងឧបករណ៍ជំនួស។";
        note(note.last);
        speakDevice(text, lang, opts);
        note.last = "";
      };
      if (e === "azure") speakAzure(text, lang, opts, fail);
      else if (e === "google") speakGoogle(text, lang, opts, fail);
      else speakDevice(text, lang, opts);
    }
  };
  window.VoicePicker = api;

  build();
  if (synth) {
    if (synth.addEventListener) synth.addEventListener("voiceschanged", fillVoices); else synth.onvoiceschanged = fillVoices;
    setTimeout(fillVoices, 500); setTimeout(fillVoices, 1500);
  }
})();
