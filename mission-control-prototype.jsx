import { useState, useEffect, useRef } from "react";

const darkTheme = {
  bgVoid: "#07080F",
  bgBase: "#0C0E1A",
  bgElevated: "#131627",
  bgHover: "#1A1E35",
  bgActive: "#222845",
  accentCyan: "#00F0FF",
  accentCyanMuted: "#00F0FF20",
  accentMagenta: "#FF2D78",
  accentMagentaMuted: "#FF2D7826",
  accentGreen: "#00FF88",
  accentGreenMuted: "#00FF8826",
  accentAmber: "#FFB800",
  accentPurple: "#A855F7",
  accentPurpleMuted: "#A855F726",
  textPrimary: "#E8ECF4",
  textSecondary: "#8891A5",
  textTertiary: "#4A5268",
  textOnAccent: "#07080F",
  borderSubtle: "#1E2340",
  borderDefault: "#2A3055",
  borderAccent: "#00F0FF30",
  providerAnthropic: "#D4A574",
  providerOpenai: "#10A37F",
  providerGoogle: "#4285F4",
};

const lightTheme = {
  bgVoid: "#F0F2F8",
  bgBase: "#F7F8FC",
  bgElevated: "#FFFFFF",
  bgHover: "#ECEEF5",
  bgActive: "#E0E3F0",
  accentCyan: "#0099AA",
  accentCyanMuted: "#0099AA18",
  accentMagenta: "#D6245E",
  accentMagentaMuted: "#D6245E18",
  accentGreen: "#00A858",
  accentGreenMuted: "#00A85818",
  accentAmber: "#C48800",
  accentPurple: "#8B3FD4",
  accentPurpleMuted: "#8B3FD418",
  textPrimary: "#131627",
  textSecondary: "#5A6178",
  textTertiary: "#9CA3B8",
  textOnAccent: "#FFFFFF",
  borderSubtle: "#E5E7EE",
  borderDefault: "#D0D3DE",
  borderAccent: "#0099AA30",
  providerAnthropic: "#B8895A",
  providerOpenai: "#0D8A6A",
  providerGoogle: "#3B78E0",
};

const agents = [
  { name: "PRD Drafter", emoji: "📋", description: "Generates product requirements documents from problem statements. Follows Blue Tees NPD process.", provider: "anthropic", model: "Claude Sonnet", lastActive: "2 hours ago", skills: 4, templates: 2 },
  { name: "Competitive Intel", emoji: "🔍", description: "Researches golf technology competitors. Produces comparison matrices and market insights.", provider: "anthropic", model: "Claude Sonnet", lastActive: "5 hours ago", skills: 1, templates: 1 },
  { name: "Brand Voice", emoji: "✍️", description: "Writes and reviews copy for Blue Tees brand alignment. Enforces PLAY DIFFERENT voice.", provider: "openai", model: "GPT-4o", lastActive: "1 day ago", skills: 0, templates: 0 },
  { name: "Tech Spec Writer", emoji: "⚙️", description: "Creates hardware and software technical specifications from product requirements.", provider: "anthropic", model: "Claude Sonnet", lastActive: "3 hours ago", skills: 1, templates: 0 },
  { name: "QA Reviewer", emoji: "✅", description: "Reviews documents and deliverables for completeness, consistency, and quality.", provider: "anthropic", model: "Claude Sonnet", lastActive: "6 hours ago", skills: 1, templates: 1 },
];

const chatMessages = [
  { role: "user", content: "I need a PRD for a new portable launch monitor. Target price point is $399, uses doppler radar, and should have a companion app with shot tracking." },
  { role: "assistant", content: "I'll draft a PRD for this. Before I start, a few clarifying questions:\n\n**Technology**: At $399 with doppler radar, are you targeting K-band (24GHz) or X-band (10GHz)? K-band gives better spin accuracy but higher BOM.\n\n**Accuracy targets**: What tier are we competing in? Garmin R10 level (±2% ball speed) or Rapsodo MLM2 level (±1%)?\n\n**Form factor**: Tripod-mounted behind the ball (like R10) or ground-level beside the ball?\n\nOnce I know these, I can use the **MS1 PRD template** to structure the output. Want me to activate it?" },
  { role: "user", content: "K-band, R10 accuracy tier or better, tripod mounted. Yes use the MS1 template." },
];

const sidebarNav = [
  { icon: "⬡", label: "Dashboard", active: false },
  { icon: "◈", label: "Agents", active: false },
  { icon: "⚡", label: "Skills", active: false },
  { icon: "◧", label: "Templates", active: false },
  { icon: "◫", label: "Scratchpad", active: false },
  { icon: "⊛", label: "Settings", active: false },
];

function ProviderBadge({ provider, t }) {
  const colors = {
    anthropic: { bg: `${t.providerAnthropic}20`, color: t.providerAnthropic, label: "CLAUDE" },
    openai: { bg: `${t.providerOpenai}20`, color: t.providerOpenai, label: "GPT" },
    google: { bg: `${t.providerGoogle}20`, color: t.providerGoogle, label: "GEMINI" },
  };
  const p = colors[provider];
  return (
    <span style={{ background: p.bg, color: p.color, padding: "2px 10px", borderRadius: 999, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", fontFamily: '"JetBrains Mono", monospace' }}>
      {p.label}
    </span>
  );
}

function SkillBadge({ count, t }) {
  if (!count) return null;
  return (
    <span style={{ background: t.accentCyanMuted, color: t.accentCyan, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", fontFamily: '"JetBrains Mono", monospace' }}>
      ⚡ {count} SKILL{count > 1 ? "S" : ""}
    </span>
  );
}

function TemplateBadge({ count, t }) {
  if (!count) return null;
  return (
    <span style={{ background: t.accentPurpleMuted, color: t.accentPurple, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 500, letterSpacing: "0.05em", fontFamily: '"JetBrains Mono", monospace' }}>
      ◧ {count} TMPL{count > 1 ? "S" : ""}
    </span>
  );
}

function AgentCard({ agent, t, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t.bgElevated,
        border: `1px solid ${hovered ? t.accentCyan : t.borderSubtle}`,
        borderRadius: 12,
        padding: 20,
        cursor: "pointer",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered ? `0 0 30px ${t.accentCyan}20, 0 8px 32px rgba(0,0,0,0.3)` : "0 2px 8px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 28 }}>{agent.emoji}</span>
        <ProviderBadge provider={agent.provider} t={t} />
      </div>
      <div>
        <div style={{ fontFamily: '"Orbitron", sans-serif', fontWeight: 500, fontSize: 15, color: t.textPrimary, letterSpacing: "0.03em", marginBottom: 6 }}>
          {agent.name}
        </div>
        <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: t.textSecondary, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {agent.description}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <SkillBadge count={agent.skills} t={t} />
        <TemplateBadge count={agent.templates} t={t} />
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: t.textTertiary, letterSpacing: "0.03em", textTransform: "uppercase", marginTop: "auto", paddingTop: 4, borderTop: `1px solid ${t.borderSubtle}` }}>
        Active {agent.lastActive}
      </div>
    </div>
  );
}

function StreamingCursor({ t }) {
  return (
    <span style={{
      display: "inline-block",
      width: 7,
      height: 17,
      background: t.accentCyan,
      borderRadius: 2,
      animation: "pulse-glow 1.2s ease-in-out infinite",
      verticalAlign: "text-bottom",
      marginLeft: 2,
    }} />
  );
}

function ChatView({ t, onBack }) {
  const [inputVal, setInputVal] = useState("");
  const [templateActive, setTemplateActive] = useState(true);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const conversations = [
    { title: "Portable Launch Monitor PRD", time: "2h ago", active: true },
    { title: "Rangefinder V3 feature scoping", time: "1d ago", active: false },
    { title: "BLE protocol questions", time: "3d ago", active: false },
  ];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Conversation sidebar */}
      <div style={{ width: 240, background: t.bgBase, borderRight: `1px solid ${t.borderSubtle}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "16px 12px" }}>
          <button style={{
            width: "100%", background: "transparent", border: `1px solid ${t.accentCyan}`, color: t.accentCyan,
            padding: "8px 12px", borderRadius: 6, fontFamily: '"JetBrains Mono", monospace', fontSize: 11,
            fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer"
          }}>
            + NEW CONVERSATION
          </button>
        </div>
        {conversations.map((c, i) => (
          <div key={i} style={{
            padding: "10px 16px", cursor: "pointer", borderLeft: c.active ? `2px solid ${t.accentCyan}` : "2px solid transparent",
            background: c.active ? t.accentCyanMuted : "transparent",
          }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: c.active ? t.accentCyan : t.textSecondary, marginBottom: 4 }}>{c.title}</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: t.textTertiary, textTransform: "uppercase" }}>{c.time}</div>
          </div>
        ))}
      </div>

      {/* Chat main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Agent header */}
        <div style={{ padding: "14px 24px", borderBottom: `1px solid ${t.borderSubtle}`, display: "flex", alignItems: "center", gap: 12, background: t.bgBase, flexShrink: 0 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: t.textSecondary, cursor: "pointer", fontSize: 16, padding: "4px 8px" }}>←</button>
          <span style={{ fontSize: 24 }}>📋</span>
          <div>
            <div style={{ fontFamily: '"Orbitron", sans-serif', fontWeight: 500, fontSize: 14, color: t.textPrimary, letterSpacing: "0.03em" }}>PRD Drafter</div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, color: t.textSecondary }}>Blue Tees NPD process specialist</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <ProviderBadge provider="anthropic" t={t} />
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflow: "auto", padding: "24px 24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
          {chatMessages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: msg.role === "user" ? "70%" : "80%",
                background: msg.role === "user" ? t.accentCyanMuted : t.bgElevated,
                border: `1px solid ${msg.role === "user" ? t.borderAccent : t.borderSubtle}`,
                borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                padding: "12px 16px",
              }}>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: t.textPrimary, lineHeight: 1.65,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.content.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                    if (part.startsWith("**") && part.endsWith("**")) {
                      return <strong key={j} style={{ color: t.accentCyan, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
                    }
                    return <span key={j}>{part}</span>;
                  })}
                </div>
              </div>
            </div>
          ))}
          {/* Streaming response */}
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              maxWidth: "80%", background: t.bgElevated, border: `1px solid ${t.borderSubtle}`,
              borderRadius: "12px 12px 12px 2px", padding: "12px 16px",
            }}>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: t.textPrimary, lineHeight: 1.65 }}>
                Starting the MS1 PRD for the portable launch monitor. With K-band doppler at the $399 price point, here's my initial assessment of feasibility
                <StreamingCursor t={t} />
              </div>
            </div>
          </div>
          <div ref={messagesEnd} />
        </div>

        {/* Input area */}
        <div style={{ padding: "12px 24px 20px", borderTop: `1px solid ${t.borderSubtle}`, background: t.bgBase, flexShrink: 0 }}>
          {templateActive && (
            <div style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px",
                background: t.accentPurpleMuted, border: `1px solid ${t.accentPurple}`, borderRadius: 999,
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: t.accentPurple,
                letterSpacing: "0.05em", textTransform: "uppercase",
              }}>
                📄 MS1 PRD TEMPLATE
                <span onClick={() => setTemplateActive(false)} style={{ cursor: "pointer", opacity: 0.7, fontSize: 12 }}>✕</span>
              </span>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{
              flex: 1, background: t.bgVoid, border: `1px solid ${t.borderDefault}`, borderRadius: 10,
              padding: "10px 14px", display: "flex", alignItems: "center",
            }}>
              <input
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Message PRD Drafter..."
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  color: t.textPrimary, fontFamily: '"JetBrains Mono", monospace', fontSize: 13,
                }}
              />
            </div>
            <button title="Skills" style={{
              width: 38, height: 38, borderRadius: 8, background: t.bgElevated, border: `1px solid ${t.borderDefault}`,
              color: t.accentCyan, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
            }}>⚡</button>
            <button title="Templates" style={{
              width: 38, height: 38, borderRadius: 8, background: t.bgElevated, border: `1px solid ${t.borderDefault}`,
              color: t.accentPurple, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: '"JetBrains Mono", monospace', fontWeight: 700,
            }}>◧</button>
            <button style={{
              width: 38, height: 38, borderRadius: 8, background: t.accentCyan, border: "none",
              color: t.textOnAccent, fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
            }}>➤</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MissionControl() {
  const [isDark, setIsDark] = useState(true);
  const [currentView, setCurrentView] = useState("dashboard");
  const [activeNav, setActiveNav] = useState("Dashboard");
  const t = isDark ? darkTheme : lightTheme;

  const navClick = (label) => {
    setActiveNav(label);
    if (label === "Dashboard") setCurrentView("dashboard");
  };

  return (
    <div style={{
      width: "100%", height: "100vh", display: "flex", fontFamily: '"JetBrains Mono", monospace',
      background: t.bgVoid, color: t.textPrimary, overflow: "hidden",
      backgroundImage: isDark
        ? `radial-gradient(ellipse at 20% 50%, #00F0FF06 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, #FF2D7806 0%, transparent 50%)`
        : "none",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@500;700&display=swap');
        @keyframes pulse-glow {
          0%, 100% { opacity: 0.4; box-shadow: 0 0 8px ${t.accentCyan}; }
          50% { opacity: 1; box-shadow: 0 0 20px ${t.accentCyan}; }
        }
        @keyframes page-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${t.bgBase}; }
        ::-webkit-scrollbar-thumb { background: ${t.borderDefault}; border-radius: 3px; }
        ::placeholder { color: ${t.textTertiary}; }
      `}</style>

      {/* Sidebar */}
      <div style={{
        width: 260, background: t.bgBase, borderRight: `1px solid ${t.borderSubtle}`,
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Wordmark */}
        <div style={{ padding: "24px 20px 20px" }}>
          <div style={{ fontFamily: '"Orbitron", sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            <span style={{ color: t.textPrimary }}>MISSION</span>{" "}
            <span style={{ color: t.accentCyan }}>CONTROL</span>
          </div>
          <div style={{ fontSize: 10, color: t.textTertiary, marginTop: 4, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            AI Agent Dashboard
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding: "8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
          {sidebarNav.map((item) => {
            const isActive = activeNav === item.label;
            return (
              <div
                key={item.label}
                onClick={() => navClick(item.label)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 6,
                  cursor: "pointer", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase",
                  fontWeight: 500,
                  color: isActive ? t.accentCyan : t.textSecondary,
                  background: isActive ? t.accentCyanMuted : "transparent",
                  borderLeft: isActive ? `2px solid ${t.accentCyan}` : "2px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <span style={{ fontSize: 14, width: 20, textAlign: "center" }}>{item.icon}</span>
                {item.label}
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ margin: "12px 20px", height: 1, background: t.borderSubtle }} />

        {/* Recent conversations */}
        <div style={{ padding: "0 12px", flex: 1 }}>
          <div style={{ fontSize: 10, color: t.textTertiary, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 8px", marginBottom: 4 }}>
            RECENT
          </div>
          {[
            { emoji: "📋", title: "Launch Monitor PRD", time: "2h" },
            { emoji: "🔍", title: "R10 vs MLM2 analysis", time: "5h" },
            { emoji: "✍️", title: "Website copy review", time: "1d" },
          ].map((c, i) => (
            <div key={i} onClick={() => { setCurrentView("chat"); setActiveNav(""); }} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 6,
              cursor: "pointer", fontSize: 11, color: t.textSecondary, transition: "background 0.15s ease",
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = t.bgHover}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span>{c.emoji}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ fontSize: 10, color: t.textTertiary }}>{c.time}</span>
            </div>
          ))}
        </div>

        {/* Theme toggle + user */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: t.accentCyan, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: t.textOnAccent }}>
              D
            </div>
            <span style={{ fontSize: 11, color: t.textSecondary }}>Danny</span>
          </div>
          <button
            onClick={() => setIsDark(!isDark)}
            style={{
              background: t.bgElevated, border: `1px solid ${t.borderDefault}`, borderRadius: 6,
              padding: "4px 8px", cursor: "pointer", fontSize: 14, color: t.textSecondary,
              transition: "all 0.2s ease",
            }}
          >
            {isDark ? "☀" : "☾"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {currentView === "dashboard" && (
          <div style={{ flex: 1, overflow: "auto", animation: "page-enter 0.3s ease-out" }}>
            {/* Header */}
            <div style={{ padding: "28px 32px 0" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                <div>
                  <h1 style={{ fontFamily: '"Orbitron", sans-serif', fontWeight: 500, fontSize: 22, letterSpacing: "0.04em", color: t.textPrimary, marginBottom: 4 }}>
                    Welcome, Danny
                  </h1>
                  <p style={{ fontSize: 12, color: t.textSecondary }}>
                    5 agents online · 3 conversations today
                  </p>
                </div>
                <button style={{
                  background: t.accentCyan, color: t.textOnAccent, border: "none", borderRadius: 8,
                  padding: "10px 20px", fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600,
                  letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: `0 0 20px ${t.accentCyan}30`,
                }}>
                  + NEW AGENT
                </button>
              </div>
            </div>

            {/* Agent grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16, padding: "0 32px 32px",
            }}>
              {agents.map((agent, i) => (
                <AgentCard
                  key={i}
                  agent={agent}
                  t={t}
                  onClick={() => { setCurrentView("chat"); setActiveNav(""); }}
                />
              ))}
              {/* Ghost card for "create new" */}
              <div
                onClick={() => {}}
                style={{
                  border: `1px dashed ${t.borderDefault}`, borderRadius: 12, padding: 20,
                  display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                  gap: 8, cursor: "pointer", transition: "all 0.2s ease", minHeight: 180,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.accentCyan; e.currentTarget.style.background = t.accentCyanMuted; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.borderDefault; e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 28, color: t.textTertiary }}>+</span>
                <span style={{ fontSize: 11, color: t.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em" }}>Create Agent</span>
              </div>
            </div>
          </div>
        )}

        {currentView === "chat" && (
          <ChatView t={t} onBack={() => { setCurrentView("dashboard"); setActiveNav("Dashboard"); }} />
        )}
      </div>
    </div>
  );
}
