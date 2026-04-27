import { useState, useEffect, useRef, useCallback } from "react";

// --- LocalStorage persistence ---
const todayKey = () => new Date().toISOString().slice(0, 10); // "2026-04-27"

function loadToday() {
  try {
    const raw = localStorage.getItem(`fuellog_${todayKey()}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem("fuellog_settings");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

const MACRO_COLORS = {
  calories: "#E8572A",
  protein: "#3B82F6",
  carbs: "#F59E0B",
  fat: "#A855F7",
};

const COMMON_FOODS = [
  { name: "Greek Yogurt", servingG: 100, cal: 304, protein: 10, carbs: 4, fat: 0.7 },
  { name: "Chicken Breast", servingG: 100, cal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Brown Rice", servingG: 100, cal: 112, protein: 2.6, carbs: 24, fat: 0.9 },
  { name: "Banana", servingG: 120, cal: 105, protein: 1.3, carbs: 27, fat: 0.4 },
  { name: "Egg", servingG: 50, cal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: "Oatmeal", servingG: 40, cal: 154, protein: 5, carbs: 27, fat: 2.6 },
  { name: "Almonds", servingG: 30, cal: 173, protein: 6, carbs: 6, fat: 15 },
  { name: "Salmon", servingG: 100, cal: 208, protein: 20, carbs: 0, fat: 13 },
  { name: "Avocado", servingG: 100, cal: 160, protein: 2, carbs: 9, fat: 15 },
  { name: "Apple", servingG: 180, cal: 95, protein: 0.5, carbs: 25, fat: 0.3 },
  { name: "Bread (Whole Wheat)", servingG: 30, cal: 69, protein: 3.6, carbs: 12, fat: 1 },
  { name: "Cottage Cheese", servingG: 100, cal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { name: "Sweet Potato", servingG: 130, cal: 112, protein: 2, carbs: 26, fat: 0.1 },
  { name: "Broccoli", servingG: 100, cal: 34, protein: 2.8, carbs: 7, fat: 0.4 },
  { name: "Tuna (canned)", servingG: 100, cal: 116, protein: 26, carbs: 0, fat: 0.8 },
];

const CircularProgress = ({ value, max, size = 180, stroke = 12, color, children }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / max, 1);
  const offset = circumference * (1 - pct);
  const overLimit = value > max;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--ring-bg)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={overLimit ? "#EF4444" : color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.4,0,.2,1), stroke 0.3s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        {children}
      </div>
    </div>
  );
};

const MacroBar = ({ label, value, max, color, unit = "g" }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ flex: 1, minWidth: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-dim)" }}>
        <span>{label}</span>
        <span style={{ color: "var(--text-main)" }}>{Math.round(value)}/{max}{unit}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--ring-bg)", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, background: color, width: `${pct}%`,
          transition: "width 0.5s cubic-bezier(.4,0,.2,1)"
        }} />
      </div>
    </div>
  );
};

export default function CalorieTracker() {
  const savedSettings = loadSettings();
  const [dailyLimit, setDailyLimit] = useState(savedSettings?.dailyLimit ?? 1400);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState(String(savedSettings?.dailyLimit ?? 1400));
  const [macroGoals, setMacroGoals] = useState(savedSettings?.macroGoals ?? { protein: 120, carbs: 150, fat: 50 });
  const [entries, setEntries] = useState(loadToday);
  const [foodName, setFoodName] = useState("");
  const [grams, setGrams] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef(null);
  const suggestRef = useRef(null);

  const [selectedFood, setSelectedFood] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Persist entries to localStorage
  useEffect(() => {
    localStorage.setItem(`fuellog_${todayKey()}`, JSON.stringify(entries));
  }, [entries]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem("fuellog_settings", JSON.stringify({ dailyLimit, macroGoals }));
  }, [dailyLimit, macroGoals]);

  const filteredFoods = COMMON_FOODS.filter(f =>
    f.name.toLowerCase().includes(foodName.toLowerCase())
  ).slice(0, 6);

  const selectFood = (food) => {
    setSelectedFood(food);
    setFoodName(food.name);
    setGrams(String(food.servingG));
    const ratio = food.servingG / food.servingG;
    setCal(String(Math.round(food.cal * ratio)));
    setProtein(String(Math.round(food.protein * ratio * 10) / 10));
    setCarbs(String(Math.round(food.carbs * ratio * 10) / 10));
    setFat(String(Math.round(food.fat * ratio * 10) / 10));
    setShowSuggestions(false);
    setManualMode(false);
  };

  useEffect(() => {
    if (selectedFood && grams) {
      const g = parseFloat(grams) || 0;
      const ratio = g / selectedFood.servingG;
      setCal(String(Math.round(selectedFood.cal * ratio)));
      setProtein(String(Math.round(selectedFood.protein * ratio * 10) / 10));
      setCarbs(String(Math.round(selectedFood.carbs * ratio * 10) / 10));
      setFat(String(Math.round(selectedFood.fat * ratio * 10) / 10));
    }
  }, [grams, selectedFood]);

  const addEntry = () => {
    if (!foodName.trim() || !cal) return;
    const entry = {
      id: Date.now(),
      name: foodName.trim(),
      grams: parseFloat(grams) || 0,
      cal: parseFloat(cal) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setEntries(prev => [entry, ...prev]);
    setFoodName(""); setGrams(""); setCal(""); setProtein(""); setCarbs(""); setFat("");
    setSelectedFood(null); setManualMode(false);
    inputRef.current?.focus();
  };

  const removeEntry = (id) => setEntries(prev => prev.filter(e => e.id !== id));

  const totals = entries.reduce((acc, e) => ({
    cal: acc.cal + e.cal,
    protein: acc.protein + e.protein,
    carbs: acc.carbs + e.carbs,
    fat: acc.fat + e.fat,
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 });

  const remaining = dailyLimit - totals.cal;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });

  return (
    <div style={{
      "--bg": "#0F0F0F",
      "--card": "#1A1A1A",
      "--card-hover": "#222",
      "--border": "#2A2A2A",
      "--text-main": "#F0EDE6",
      "--text-dim": "#7A756D",
      "--accent": MACRO_COLORS.calories,
      "--ring-bg": "#252220",
      "--font-display": "'DM Serif Display', Georgia, serif",
      "--font-body": "'DM Sans', 'Helvetica Neue', sans-serif",
      "--font-mono": "'JetBrains Mono', 'SF Mono', monospace",
      fontFamily: "var(--font-body)",
      background: "var(--bg)",
      color: "var(--text-main)",
      minHeight: "100vh",
      maxWidth: 480,
      margin: "0 auto",
      padding: "24px 16px 80px",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Serif+Display&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400,
            margin: 0, letterSpacing: "-0.01em", lineHeight: 1.1,
          }}>
            Fuel Log
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
            {today.toUpperCase()}
          </p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "8px 12px", color: "var(--text-dim)",
            cursor: "pointer", fontSize: 13, fontFamily: "var(--font-mono)",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--accent)"; }}
          onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-dim)"; }}
        >
          ⚙
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 14, padding: 20, marginBottom: 20,
          animation: "slideDown 0.25s ease",
        }}>
          <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 14, marginTop: 0 }}>
            Daily Goals
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Calories", key: "cal", value: dailyLimit, setter: (v) => setDailyLimit(v), unit: "kcal", color: MACRO_COLORS.calories },
              { label: "Protein", key: "protein", value: macroGoals.protein, setter: (v) => setMacroGoals(p => ({ ...p, protein: v })), unit: "g", color: MACRO_COLORS.protein },
              { label: "Carbs", key: "carbs", value: macroGoals.carbs, setter: (v) => setMacroGoals(p => ({ ...p, carbs: v })), unit: "g", color: MACRO_COLORS.carbs },
              { label: "Fat", key: "fat", value: macroGoals.fat, setter: (v) => setMacroGoals(p => ({ ...p, fat: v })), unit: "g", color: MACRO_COLORS.fat },
            ].map(g => (
              <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 4, height: 28, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{g.label}</label>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
                    <input
                      type="number"
                      value={g.value}
                      onChange={e => g.setter(parseInt(e.target.value) || 0)}
                      style={{
                        background: "transparent", border: "none", borderBottom: "1px solid var(--border)",
                        color: "var(--text-main)", fontSize: 16, fontFamily: "var(--font-body)",
                        width: 60, padding: "2px 0", outline: "none",
                      }}
                    />
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{g.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Ring */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
        <CircularProgress value={totals.cal} max={dailyLimit} size={190} stroke={10} color={MACRO_COLORS.calories}>
          <span style={{ fontSize: 34, fontFamily: "var(--font-display)", lineHeight: 1, color: remaining < 0 ? "#EF4444" : "var(--text-main)" }}>
            {Math.round(totals.cal)}
          </span>
          <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)", letterSpacing: "0.1em", marginTop: 4, textTransform: "uppercase" }}>
            of {dailyLimit} kcal
          </span>
          <span style={{
            fontSize: 12, fontFamily: "var(--font-body)", fontWeight: 500, marginTop: 6,
            color: remaining < 0 ? "#EF4444" : remaining < 200 ? "#F59E0B" : "#4ADE80",
            background: remaining < 0 ? "#EF444415" : remaining < 200 ? "#F59E0B15" : "#4ADE8015",
            padding: "2px 10px", borderRadius: 20,
          }}>
            {remaining >= 0 ? `${Math.round(remaining)} left` : `${Math.abs(Math.round(remaining))} over`}
          </span>
        </CircularProgress>
      </div>

      {/* Macro Bars */}
      <div style={{ display: "flex", gap: 14, marginBottom: 28, padding: "0 4px" }}>
        <MacroBar label="Protein" value={totals.protein} max={macroGoals.protein} color={MACRO_COLORS.protein} />
        <MacroBar label="Carbs" value={totals.carbs} max={macroGoals.carbs} color={MACRO_COLORS.carbs} />
        <MacroBar label="Fat" value={totals.fat} max={macroGoals.fat} color={MACRO_COLORS.fat} />
      </div>

      {/* Add Food */}
      <div style={{
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 18, marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", marginBottom: 14, marginTop: 0 }}>
          Add Food
        </p>

        <div style={{ position: "relative", marginBottom: 12 }} ref={suggestRef}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search food or type custom..."
            value={foodName}
            onChange={e => {
              setFoodName(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
              if (selectedFood && e.target.value !== selectedFood.name) {
                setSelectedFood(null);
                setCal(""); setProtein(""); setCarbs(""); setFat("");
              }
            }}
            onFocus={() => foodName.length > 0 && setShowSuggestions(true)}
            onKeyDown={e => e.key === "Enter" && addEntry()}
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#111", border: "1px solid var(--border)",
              borderRadius: 10, padding: "12px 14px",
              color: "var(--text-main)", fontSize: 14,
              fontFamily: "var(--font-body)", outline: "none",
              transition: "border-color 0.2s",
            }}
            onFocusCapture={e => e.target.style.borderColor = "var(--accent)"}
            onBlurCapture={e => e.target.style.borderColor = "var(--border)"}
          />

          {showSuggestions && filteredFoods.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "#1E1E1E", border: "1px solid var(--border)",
              borderRadius: 10, marginTop: 4, overflow: "hidden",
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}>
              {filteredFoods.map(f => (
                <div
                  key={f.name}
                  onClick={() => selectFood(f)}
                  style={{
                    padding: "10px 14px", cursor: "pointer",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    transition: "background 0.15s",
                    borderBottom: "1px solid #252525",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#282828"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{f.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                    {f.cal}kcal / {f.servingG}g
                  </span>
                </div>
              ))}
              <div
                onClick={() => { setShowSuggestions(false); setManualMode(true); setSelectedFood(null); }}
                style={{
                  padding: "10px 14px", cursor: "pointer",
                  fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#282828"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                + Enter manually
              </div>
            </div>
          )}
        </div>

        {/* Quantity + Macros row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
          {[
            { label: "Grams", val: grams, set: setGrams, ph: "g", disabled: false },
            { label: "Kcal", val: cal, set: setCal, ph: "kcal", disabled: !!selectedFood },
            { label: "Protein", val: protein, set: setProtein, ph: "g", disabled: !!selectedFood },
            { label: "Carbs", val: carbs, set: setCarbs, ph: "g", disabled: !!selectedFood },
            { label: "Fat", val: fat, set: setFat, ph: "g", disabled: !!selectedFood },
          ].map(f => (
            <div key={f.label}>
              <label style={{
                fontSize: 9, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                letterSpacing: "0.08em", color: "var(--text-dim)", display: "block", marginBottom: 4,
              }}>{f.label}</label>
              <input
                type="number"
                placeholder={f.ph}
                value={f.val}
                onChange={e => f.set(e.target.value)}
                disabled={f.disabled && !manualMode}
                onKeyDown={e => e.key === "Enter" && addEntry()}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: f.disabled && !manualMode ? "#0D0D0D" : "#111",
                  border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 6px",
                  color: f.disabled && !manualMode ? "var(--text-dim)" : "var(--text-main)",
                  fontSize: 13, fontFamily: "var(--font-mono)",
                  outline: "none", textAlign: "center",
                }}
              />
            </div>
          ))}
        </div>

        <button
          onClick={addEntry}
          disabled={!foodName.trim() || !cal}
          style={{
            width: "100%", padding: "12px",
            background: !foodName.trim() || !cal ? "#1E1E1E" : "var(--accent)",
            color: !foodName.trim() || !cal ? "var(--text-dim)" : "#fff",
            border: "none", borderRadius: 10, fontSize: 13,
            fontFamily: "var(--font-mono)", fontWeight: 500,
            cursor: !foodName.trim() || !cal ? "not-allowed" : "pointer",
            letterSpacing: "0.05em", textTransform: "uppercase",
            transition: "all 0.2s",
          }}
        >
          + Add Entry
        </button>
      </div>

      {/* Entries List */}
      {entries.length > 0 && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 12, padding: "0 4px",
          }}>
            <p style={{ fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-dim)", margin: 0 }}>
              Today's Log
            </p>
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {entries.map((e, i) => (
              <div
                key={e.id}
                style={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 12, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 12,
                  animation: i === 0 ? "fadeIn 0.3s ease" : "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={ev => ev.currentTarget.style.background = "var(--card-hover)"}
                onMouseLeave={ev => ev.currentTarget.style.background = "var(--card)"}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${MACRO_COLORS.calories}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, flexShrink: 0,
                }}>
                  🍽
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.name}
                    </span>
                    <span style={{ fontSize: 14, fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--accent)", flexShrink: 0, marginLeft: 8 }}>
                      {Math.round(e.cal)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 4, fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
                    <span>{e.grams}g</span>
                    <span style={{ color: MACRO_COLORS.protein }}>P:{e.protein}g</span>
                    <span style={{ color: MACRO_COLORS.carbs }}>C:{e.carbs}g</span>
                    <span style={{ color: MACRO_COLORS.fat }}>F:{e.fat}g</span>
                    <span style={{ marginLeft: "auto" }}>{e.time}</span>
                  </div>
                </div>
                <button
                  onClick={() => removeEntry(e.id)}
                  style={{
                    background: "none", border: "none", color: "var(--text-dim)",
                    cursor: "pointer", fontSize: 16, padding: 4, lineHeight: 1,
                    transition: "color 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={ev => ev.target.style.color = "#EF4444"}
                  onMouseLeave={ev => ev.target.style.color = "var(--text-dim)"}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div style={{
          textAlign: "center", padding: "40px 20px",
          color: "var(--text-dim)", fontSize: 13,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🥗</div>
          <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.05em" }}>
            No entries yet — start logging your meals
          </p>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button {
          -webkit-appearance: none; margin: 0;
        }
        input[type="number"] { -moz-appearance: textfield; }
        input::placeholder { color: #444; }
      `}</style>
    </div>
  );
}
