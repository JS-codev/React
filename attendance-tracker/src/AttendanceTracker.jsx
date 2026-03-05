import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./output.css";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
const BRANCHES = ["S1", "S2", "S3", "S4", "HQ Coy", "SPP", "Not assigned yet"];

const AnimatedSelect = ({ options, value, onChange, placeholder = "Select...", customStyles = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const selectedOption = options.find(opt => opt.value === value);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
    });
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        menuRef.current && !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    const reposition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuStyle(prev => ({ ...prev, top: rect.bottom + 4, left: rect.left, width: rect.width }));
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

  return (
    <div className="relative w-full">
      <div
        ref={triggerRef}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className={`w-full px-4 py-2 bg-white/5 border border-white/10 text-white rounded-lg cursor-pointer flex justify-between items-center hover:bg-white/10 transition-all duration-200 ${customStyles}`}
      >
        <span className="text-sm">{selectedOption ? selectedOption.label : placeholder}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="w-3 h-3 text-blue-400"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </div>

      {isOpen && createPortal(
        <AnimatePresence>
          <motion.ul
            ref={menuRef}
            style={menuStyle}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="bg-[#0a1a3a] backdrop-blur-xl border border-white/20 rounded-xl overflow-hidden shadow-2xl"
          >
            {options.map((opt, index) => (
              <motion.li
                key={opt.value}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.03 }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-4 py-2 cursor-pointer text-sm transition-colors ${value === opt.value ? "bg-blue-600/40 text-white" : "text-gray-300 hover:bg-white/10"}`}
              >
                {opt.label}
              </motion.li>
            ))}
          </motion.ul>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

const STATUS_OPTIONS = [
  { value: "in", label: "✅ In", color: "bg-emerald-500/20", glow: "shadow-[0_0_12px_rgba(52,211,153,0.4)]" },
  { value: "late", label: "🕐 Late", color: "bg-amber-500/20", glow: "shadow-[0_0_12px_rgba(251,191,36,0.4)]" },
  { value: "rso", label: "📋 RSO", color: "bg-violet-500/20", glow: "shadow-[0_0_12px_rgba(139,92,246,0.4)]" },
  { value: "mc", label: "🏥 MC until...", color: "bg-red-500/20", glow: "shadow-[0_0_12px_rgba(239,68,68,0.4)]" },
];

export default function AttendanceTracker() {
  const [personnel, setPersonnel] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [mcDates, setMcDates] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newRank, setNewRank] = useState("");
  const [newName, setNewName] = useState("");
  const [newBranch, setNewBranch] = useState("Not assigned yet");
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  async function fetchPersonnel() {
    try {
      const data = await supabaseFetch("personnel?select=*&order=created_at.asc");
      setPersonnel(data);
      const initialStatuses = {};
      const initialMcDates = {};
      data.forEach((p) => {
        initialStatuses[p.id] = p.status || "in";
        initialMcDates[p.id] = p.mc_end_date || "";
      });
      setStatuses(initialStatuses);
      setMcDates(initialMcDates);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { fetchPersonnel(); }, []);

  const groupedPersonnel = BRANCHES.reduce((acc, branch) => {
    acc[branch] = personnel.filter(p => (p.branch || "Not assigned yet") === branch);
    return acc;
  }, {});

  async function handleStatusChange(id, value) {
    setStatuses(prev => ({ ...prev, [id]: value }));
    try {
      await supabaseFetch(`personnel?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: value }),
      });
    } catch (e) { console.error(e); }
  }

  async function handleMcDateChange(id, date) {
    setMcDates(prev => ({ ...prev, [id]: date }));
    try {
      await supabaseFetch(`personnel?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify({ mc_end_date: date }),
      });
    } catch (e) { console.error(e); }
  }

  async function handleAddPersonnel() {
    if (!newRank.trim() || !newName.trim()) return;
    setAdding(true);
    try {
      const data = await supabaseFetch("personnel", {
        method: "POST",
        body: JSON.stringify({ rank: newRank.trim(), name: newName.trim(), branch: newBranch, status: "in" }),
      });
      setPersonnel(prev => [...prev, data[0]]);
      setStatuses(prev => ({ ...prev, [data[0].id]: "in" }));
      setNewRank(""); setNewName("");
    } catch (e) { alert("Error adding personnel."); }
    finally { setAdding(false); }
  }

  async function handleDelete(id) {
    try {
      await supabaseFetch(`personnel?id=eq.${id}`, { method: "DELETE" });
      setPersonnel(prev => prev.filter(p => p.id !== id));
    } catch (e) { console.error(e); }
    setDeleteId(null);
  }

  const inCount = Object.values(statuses).filter(s => s === "in").length;
  const absentCount = Object.values(statuses).filter(s => s !== "in").length;

  return (
    <div className="min-h-screen bg-[#050d1a] text-slate-200 font-sans pb-20 overflow-x-hidden">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_10%,_rgba(0,80,160,0.2)_0%,_transparent_60%)]" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <header className="text-center mb-12">
          <span className="inline-block px-4 py-1 rounded-full border border-blue-500/20 bg-blue-500/5 text-[10px] uppercase tracking-[0.3em] text-blue-400 font-bold mb-4">
            Department Overview
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-white to-blue-400 bg-clip-text text-transparent uppercase">
            ATTENDANCE
          </h1>
          <p className="mt-2 text-slate-500 text-sm tracking-[0.2em] uppercase">Status Tracker</p>
        </header>

        <div className="flex flex-wrap justify-center gap-4 mb-10">
          <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
            <span className="text-sm font-semibold tracking-wide">{inCount} Present</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]" />
            <span className="text-sm font-semibold tracking-wide">{absentCount} Absent</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            <span className="text-sm font-semibold tracking-wide">{personnel.length} Total</span>
          </div>
        </div>

        <div className="flex justify-end mb-6">
          <button onClick={() => setShowAdmin(!showAdmin)} className="px-4 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 transition-all text-xs font-bold tracking-widest uppercase text-blue-300">
            {showAdmin ? "✕ Close" : "⊕ Add Personal"}
          </button>
        </div>

        {showAdmin && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-50 mb-8 p-6 rounded-xl bg-blue-900/20 border border-blue-500/20 backdrop-blur-xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-blue-500/50" placeholder="Rank" value={newRank} onChange={e => setNewRank(e.target.value)} />
              <input className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 outline-none focus:border-blue-500/50" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} />
              <AnimatedSelect 
                options={BRANCHES.map(b => ({ value: b, label: b }))} 
                value={newBranch} 
                onChange={setNewBranch} 
                placeholder="Select Branch"
              />
            </div>
            <button onClick={handleAddPersonnel} disabled={adding} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold uppercase text-xs tracking-widest transition-all">
              {adding ? "Adding..." : "Add Entry"}
            </button>
          </motion.div>
        )}

        <div className="space-y-10">
          {loading ? (
             <div className="text-center py-20 animate-pulse text-slate-500 uppercase tracking-widest text-xs">Loading Directory...</div>
          ) : (
            BRANCHES.map(branch => {
              const members = groupedPersonnel[branch];
              if (members.length === 0) return null;

              return (
                <div key={branch} className="space-y-4">
                  <h2 className="flex items-center gap-4 text-xs font-black uppercase tracking-[0.4em] text-blue-400/60">
                    <span>{branch}</span>
                    <div className="h-[1px] w-full bg-gradient-to-r from-blue-500/30 to-transparent" />
                  </h2>

                  <div className="grid gap-3">
                    {members.map((p) => {
                      const currentStatus = STATUS_OPTIONS.find(o => o.value === (statuses[p.id] || "in"));
                      return (
                        <div key={p.id} 
                          className={`relative grid grid-cols-1 md:grid-cols-2 items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all hover:border-white/20 ${currentStatus?.glow}`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="px-2 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-400 uppercase">{p.rank}</span>
                            <span className="text-lg font-medium tracking-tight text-slate-100">{p.name}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <AnimatedSelect 
                              options={STATUS_OPTIONS}
                              value={statuses[p.id] || "in"}
                              onChange={(val) => handleStatusChange(p.id, val)}
                              customStyles={currentStatus?.color}
                            />

                            {statuses[p.id] === "mc" && (
                              <input type="date" className="bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-2 text-xs text-red-300 outline-none" value={mcDates[p.id] || ""} onChange={e => handleMcDateChange(p.id, e.target.value)} />
                            )}

                            {showAdmin && (
                              <button onClick={() => setDeleteId(p.id)} className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AnimatePresence>
        {deleteId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-[#0a1a3a] border border-red-500/30 p-8 rounded-2xl max-w-sm w-full text-center">
              <h2 className="text-xl font-bold mb-6">Remove Entry?</h2>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg bg-white/5 text-xs font-bold uppercase">Cancel</button>
                <button onClick={() => handleDelete(deleteId)} className="flex-1 px-4 py-2 rounded-lg bg-red-600 text-xs font-bold uppercase">Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}