import { useState, useCallback } from "react";
import { analyze } from "../src/analyze";
import type { AnalyzeResult, StrategyName } from "../src/analyze";
import type { SentimentLabel } from "../src/types";

type Scores = Record<SentimentLabel, number>;

const PRESETS = [
  { label: "JA positive", lang: "ja", text: "本当に素晴らしい作品です。美しい映像と見事な演出に感銘を受けました。" },
  { label: "JA negative", lang: "ja", text: "最悪の体験でした。酷いサービスで不快な思いをしました。二度と行きたくない。" },
  { label: "EN positive", lang: "en", text: "This movie is absolutely wonderful and beautiful. An excellent masterpiece." },
  { label: "EN negative", lang: "en", text: "Terrible experience. Awful service and horrible quality. Never going back." },
  { label: "Scunthorpe EN", lang: "en", text: "Scunthorpe is a wonderful town with excellent cocktail bars." },
  { label: "カスタマー (safe)", lang: "ja", text: "カスタマーサポートが素晴らしい対応で感銘を受けました。" },
  { label: "カス (toxic)", lang: "ja", text: "あいつはカスだ" },
];

function labelColor(label: SentimentLabel): string {
  if (label === "positive") {
    return "#22c55e";
  }
  if (label === "negative") {
    return "#ef4444";
  }
  return "#a3a3a3";
}

function ScoreBar({ scores }: { scores: Scores }) {
  const pos = Math.round(scores.positive * 100);
  const neg = Math.round(scores.negative * 100);
  const neu = 100 - pos - neg;
  return (
    <div style={{ display: "flex", height: 20, borderRadius: 4, overflow: "hidden", width: "100%" }}>
      {pos > 0 && (
        <div style={{ width: `${pos}%`, background: "#22c55e", color: "#fff", fontSize: 11, textAlign: "center" }}>
          {pos}%
        </div>
      )}
      {neu > 0 && (
        <div style={{ width: `${neu}%`, background: "#d4d4d4", color: "#525252", fontSize: 11, textAlign: "center" }}>
          {neu}%
        </div>
      )}
      {neg > 0 && (
        <div style={{ width: `${neg}%`, background: "#ef4444", color: "#fff", fontSize: 11, textAlign: "center" }}>
          {neg}%
        </div>
      )}
    </div>
  );
}

export function App() {
  const [text, setText] = useState("");
  const [language, setLanguage] = useState("ja");
  const [strategy, setStrategy] = useState<StrategyName>("naive-bayes");
  const [ensemble, setEnsemble] = useState(false);
  const [categories, setCategories] = useState(true);
  const [toxic, setToxic] = useState(true);
  const [result, setResult] = useState<AnalyzeResult | null>(null);

  const runAnalysis = useCallback(() => {
    if (!text.trim()) {
      return;
    }
    const r = analyze(text, language, {
      strategy,
      ensemble: ensemble ? {} : undefined,
      categories,
      toxic,
    });
    setResult(r);
  }, [text, language, strategy, ensemble, categories, toxic]);

  const applyPreset = useCallback((p: (typeof PRESETS)[number]) => {
    setText(p.text);
    setLanguage(p.lang);
  }, []);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 800, margin: "0 auto", padding: "24px 16px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>nega-posi demo</h1>
      <p style={{ color: "#737373", marginBottom: 24 }}>
        Multilingual sentiment analysis with Scunthorpe-safe tokenization
      </p>

      {/* Presets */}
      <div style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "1px solid #d4d4d4",
              background: "#fafafa",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text to analyze..."
        rows={4}
        style={{
          width: "100%",
          padding: 12,
          borderRadius: 6,
          border: "1px solid #d4d4d4",
          fontSize: 15,
          resize: "vertical",
          boxSizing: "border-box",
        }}
      />

      {/* Controls */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} style={selectStyle}>
          <option value="ja">Japanese</option>
          <option value="en">English</option>
        </select>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyName)} style={selectStyle}>
          <option value="naive-bayes">Naive Bayes</option>
          <option value="tfidf">TF-IDF</option>
          <option value="ncd">NCD</option>
        </select>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={ensemble} onChange={(e) => setEnsemble(e.target.checked)} />
          Ensemble
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={categories} onChange={(e) => setCategories(e.target.checked)} />
          Categories
        </label>
        <label style={checkboxStyle}>
          <input type="checkbox" checked={toxic} onChange={(e) => setToxic(e.target.checked)} />
          Toxic
        </label>
        <button onClick={runAnalysis} disabled={!text.trim()} style={buttonStyle(!text.trim())}>
          Analyze
        </button>
      </div>

      {/* Results */}
      {result && (
        <div style={{ marginTop: 24 }}>
          {/* Sentiment */}
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 32, fontWeight: 700, color: labelColor(result.sentiment.label) }}>
                {result.sentiment.label.toUpperCase()}
              </span>
              <span style={{ fontSize: 14, color: "#737373" }}>
                {(result.sentiment.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <ScoreBar scores={result.sentiment.scores} />
          </div>

          {/* Toxic */}
          {result.toxic && (
            <div
              style={{
                ...cardStyle,
                background: result.toxic.toxic ? "#fef2f2" : "#f0fdf4",
              }}
            >
              <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>
                Toxic: {result.toxic.toxic ? "DETECTED" : "Clean"}
              </h3>
              {result.toxic.matches.length > 0 && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {result.toxic.matches.map((m) => (
                    <span key={m.word} style={{ padding: "2px 8px", background: "#fca5a5", borderRadius: 4, fontSize: 13 }}>
                      {m.word} ({m.category}, {(m.severity * 100).toFixed(0)}%)
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {result.categories && Object.keys(result.categories).length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Categories</h3>
              {Object.entries(result.categories).map(([cat, res]) => (
                <div key={cat} style={{ marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, width: 80 }}>{cat}</span>
                    <span style={{ fontSize: 13, color: labelColor(res.label), fontWeight: 600 }}>{res.label}</span>
                  </div>
                  <ScoreBar scores={res.scores} />
                </div>
              ))}
            </div>
          )}

          {/* Tokens */}
          <div style={cardStyle}>
            <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>Tokens ({result.tokens.length})</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {result.tokens.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  style={{ padding: "2px 6px", background: "#e5e7eb", borderRadius: 3, fontSize: 12, fontFamily: "monospace" }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const selectStyle = { padding: "6px 10px", borderRadius: 4, border: "1px solid #d4d4d4", fontSize: 13, background: "#fff" };
const checkboxStyle = { fontSize: 13, display: "flex" as const, alignItems: "center" as const, gap: 4 };
const cardStyle = { padding: 16, background: "#f9fafb", borderRadius: 8, marginBottom: 16 };

function buttonStyle(disabled: boolean) {
  return {
    padding: "8px 20px",
    borderRadius: 6,
    border: "none",
    background: disabled ? "#a3a3a3" : "#2563eb",
    color: "#fff",
    fontWeight: 600 as const,
    cursor: disabled ? ("default" as const) : ("pointer" as const),
    fontSize: 14,
  };
}
