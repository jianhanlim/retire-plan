import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ms" | "zh";

const LS_KEY = "retire-plan:lang";

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  ms: "Bahasa Malaysia",
  zh: "中文",
};

type Dict = Record<string, string>;

const en: Dict = {}; // EN is the identity — key === value

const ms: Dict = {
  // Header
  "Money Runway": "Money Runway",
  "A retirement simulator that takes real life seriously.":
    "Simulator persaraan yang mengambil kira realiti hidup.",
  "Most calculators flatten everything to one inflation rate and one savings account. Money Runway models":
    "Kebanyakan kalkulator meratakan semua kepada satu kadar inflasi dan satu akaun simpanan. Money Runway memodelkan",
  "per-line expense inflation": "inflasi setiap baris perbelanjaan",
  "per-account return rates": "kadar pulangan setiap akaun",
  "contribution caps": "had sumbangan",
  "(e.g. EPF RM100k/yr)": "(cth. KWSP RM100k/tahun)",
  "cascade savings": "simpanan berlapis",
  "(preferred → next-highest-rate → cash)": "(akaun pilihan → kadar tertinggi seterusnya → tunai)",
  "withdrawal drain order": "susunan pengeluaran",
  "sellable assets": "aset boleh dijual",
  "with linked loans": "dengan pinjaman berkaitan",
  "and": "dan",
  "life-phase income changes": "perubahan pendapatan ikut fasa hidup",
  "(career → semi-retirement → retirement)": "(kerjaya → separa-persaraan → persaraan)",
  "All math runs in your browser — no signup, no data leaves your device.":
    "Semua pengiraan berjalan dalam pelayar anda — tiada pendaftaran, data tidak meninggalkan peranti anda.",

  // Buttons / actions
  "Help": "Bantuan",
  "Hide": "Sembunyi",
  "Show": "Papar",
  "Save": "Simpan",
  "Share": "Kongsi",
  "XLSX": "XLSX",
  "Reset": "Set Semula",
  "Profile:": "Profil:",
  "Strategy:": "Strategi:",
  "Choose your profile…": "Pilih profil anda…",

  // Profile descriptions hint
  "Pick a profile": "Pilih profil",
  "to load realistic starting numbers, or just start editing the cards below.":
    "untuk memuatkan angka permulaan realistik, atau terus edit kad di bawah.",

  // Sections
  "⚙️ Settings": "⚙️ Tetapan",
  "💰 Your money": "💰 Wang Anda",
  "📅 Your life": "📅 Hidup Anda",
  "📈 Results": "📈 Keputusan",

  // Settings cards
  "Time horizon": "Jangka Masa",
  "Start age": "Umur Mula",
  "End age": "Umur Akhir",
  "Assumption toggles": "Andaian",
  "Top-ups earn interest in the year they're deposited":
    "Tambahan menerima faedah pada tahun ia didepositkan",
  "Pay liability through its end age inclusive":
    "Bayar liabiliti sehingga umur akhir (termasuk)",
  "Both options together shift the \"money runs out\" age by several years. Bracket the range.":
    "Kedua-dua pilihan ini boleh menggeser umur \"wang habis\" beberapa tahun. Anggap sebagai julat.",

  // Account card
  "Accounts": "Akaun",
  "Name": "Nama",
  "Balance": "Baki",
  "Rate %": "Kadar %",
  "Drain": "Pengeluaran",
  "Max Top-up": "Had Tambahan",
  "+ Add account": "+ Tambah akaun",

  // Expense card
  "Expenses (monthly)": "Perbelanjaan (bulanan)",
  "Monthly": "Bulanan",
  "Infl %": "Inflasi %",
  "Cap": "Had",
  "+ Add expense": "+ Tambah perbelanjaan",
  "Total (today)": "Jumlah (hari ini)",

  // Liability card
  "Liabilities": "Liabiliti",
  "Start Age": "Umur Mula",
  "End Age": "Umur Tamat",
  "+ Add liability": "+ Tambah liabiliti",

  // Fixed Assets card
  "🏠 Fixed assets": "🏠 Aset Tetap",
  "Current Value": "Nilai Semasa",
  "Apprec %": "Penghargaan %",
  "Linked Loan": "Pinjaman Berkait",
  "Sell Age": "Umur Jual",
  "Sell Price": "Harga Jual",
  "+ Add fixed asset": "+ Tambah aset tetap",
  "— none —": "— tiada —",

  // Phases card
  "Phases": "Fasa",
  "Start": "Mula",
  "End": "Tamat",
  "Monthly Income": "Pendapatan Bulanan",
  "Income Infl %": "Inflasi Pendapatan %",
  "Save Surplus To": "Simpan Lebihan ke",
  "— consumed —": "— dihabiskan —",

  // Snapshot
  "Milestone snapshot": "Petikan Penanda Aras",
  "Year-by-year detail": "Perincian Tahun demi Tahun",
  "Show every year": "Papar setiap tahun",
  "Show milestones only": "Papar penanda aras sahaja",
  "Age": "Umur",
  "Phase": "Fasa",
  "Total": "Jumlah",
  "Income (yr)": "Pendapatan (thn)",
  "Living costs (yr)": "Kos sara hidup (thn)",
  "Liability (yr)": "Liabiliti (thn)",
  "Total Spend (yr)": "Jumlah Belanja (thn)",
  "Drained (yr)": "Dikeluarkan (thn)",

  // Verdict
  "Peak Wealth": "Kekayaan Puncak",
  "at age": "pada umur",
  "End of Plan": "Akhir Pelan",
  "Outcome": "Hasil",
  "Solvent through": "Solven sehingga",
  "Runs out @": "Habis @",

  // Asset trajectory
  "Asset trajectory": "Trajektori Aset",
  "Total Assets": "Jumlah Aset",

  // Welcome modal — vocabulary
  "Salary": "Gaji",
  "Expenses": "Perbelanjaan",
  "Loan": "Pinjaman",
  "Stocks": "Saham",
  "Cash": "Tunai",
  "cap": "had",
  "Settings": "Tetapan",
  "Your money": "Wang Anda",
  "Your life": "Hidup Anda",
  "Results": "Keputusan",

  // Welcome modal
  "How Money Runway works": "Cara Money Runway berfungsi",
  "A 30-second tour of the math.": "Lawatan 30-saat tentang matematik di sebaliknya.",
  "Surplus → save": "Lebihan → simpan",
  "Shortfall → drain": "Kekurangan → keluarkan",
  "Year after year → ": "Tahun demi tahun → ",
  "Asset trajectory chart": "Carta Trajektori Aset",
  "shows your runway": "menunjukkan runway anda",
  "To use this app:": "Cara menggunakan aplikasi ini:",
  "(or skip and edit freely)": "(atau langkau dan edit bebas)",
  "Tweak the": "Ubah suai",
  "sections": "bahagian",
  "Watch the": "Tonton",
  "panel update live": "panel kemas kini langsung",
  "🔒 Your data never leaves this browser.": "🔒 Data anda tidak pernah meninggalkan pelayar ini.",
  "Don't show this again": "Jangan papar lagi",
  "Got it, let's plan!": "Faham, mari rancang!",

  // Saved scenarios
  "Saved scenarios": "Senario disimpan",
  "No saved scenarios yet. Use": "Belum ada senario disimpan. Guna",
  "in the header to store the current setup. Scenarios live in your browser only — they're never uploaded.":
    "di pengepala untuk menyimpan persediaan semasa. Senario hanya wujud dalam pelayar anda — tidak pernah dimuat naik.",
  "Load": "Muat",
  "Delete": "Padam",

  // How does this work (collapsed banner)
  "How does this work?": "Bagaimana ini berfungsi?",

  // Help
  "ⓘ What do these columns mean?": "ⓘ Apa maksud lajur ini?",

  // Scope section
  "What this tool does & doesn't model":
    "Apa yang alat ini boleh & tidak boleh modelkan",
  "✓ Handles": "✓ Boleh urus",
  "✗ Does not handle": "✗ Tidak boleh urus",
  "Treat the verdict as a baseline. Add a buffer for what isn't modeled.":
    "Anggap keputusan sebagai garis dasar. Tambah penampan untuk perkara yang tidak dimodelkan.",

  // Footer
  "Built by": "Dibina oleh",
  "a PhD": "seorang PhD",
  "Open source on": "Sumber terbuka di",
  "All calculations are local; nothing is sent to a server.":
    "Semua pengiraan adalah tempatan; tiada apa dihantar ke pelayan.",
};

const zh: Dict = {
  // Header
  "Money Runway": "Money Runway",
  "A retirement simulator that takes real life seriously.":
    "认真对待现实的退休模拟器。",
  "Most calculators flatten everything to one inflation rate and one savings account. Money Runway models":
    "多数计算器只用单一通胀率和单一储蓄账户。Money Runway 模拟了",
  "per-line expense inflation": "逐项支出通胀",
  "per-account return rates": "各账户收益率",
  "contribution caps": "缴款上限",
  "(e.g. EPF RM100k/yr)": "(例如 EPF 每年 RM100k)",
  "cascade savings": "级联储蓄",
  "(preferred → next-highest-rate → cash)": "(首选 → 次高收益 → 现金)",
  "withdrawal drain order": "提款顺序",
  "sellable assets": "可售资产",
  "with linked loans": "及关联贷款",
  "and": "及",
  "life-phase income changes": "人生阶段收入变化",
  "(career → semi-retirement → retirement)": "(职业 → 半退休 → 退休)",
  "All math runs in your browser — no signup, no data leaves your device.":
    "所有计算都在您的浏览器中运行 — 无需注册,数据不会离开您的设备。",

  // Buttons / actions
  "Help": "帮助",
  "Hide": "隐藏",
  "Show": "显示",
  "Save": "保存",
  "Share": "分享",
  "XLSX": "XLSX",
  "Reset": "重置",
  "Profile:": "档案:",
  "Strategy:": "策略:",
  "Choose your profile…": "选择您的档案…",

  // Profile descriptions hint
  "Pick a profile": "选择一个档案",
  "to load realistic starting numbers, or just start editing the cards below.":
    "以加载真实起始数据,或直接编辑下方卡片。",

  // Sections
  "⚙️ Settings": "⚙️ 设置",
  "💰 Your money": "💰 您的钱",
  "📅 Your life": "📅 您的人生",
  "📈 Results": "📈 结果",

  // Settings cards
  "Time horizon": "时间范围",
  "Start age": "起始年龄",
  "End age": "结束年龄",
  "Assumption toggles": "假设开关",
  "Top-ups earn interest in the year they're deposited":
    "存款当年即开始计息",
  "Pay liability through its end age inclusive":
    "缴付负债至结束年龄(包含)",
  "Both options together shift the \"money runs out\" age by several years. Bracket the range.":
    "两个选项一起可使\"钱用完\"的年龄相差数年。将其视为范围。",

  // Account card
  "Accounts": "账户",
  "Name": "名称",
  "Balance": "余额",
  "Rate %": "利率 %",
  "Drain": "提取顺序",
  "Max Top-up": "充值上限",
  "+ Add account": "+ 添加账户",

  // Expense card
  "Expenses (monthly)": "支出 (每月)",
  "Monthly": "每月",
  "Infl %": "通胀 %",
  "Cap": "上限",
  "+ Add expense": "+ 添加支出",
  "Total (today)": "总计 (今日)",

  // Liability card
  "Liabilities": "负债",
  "Start Age": "起始年龄",
  "End Age": "结束年龄",
  "+ Add liability": "+ 添加负债",

  // Fixed Assets card
  "🏠 Fixed assets": "🏠 固定资产",
  "Current Value": "当前价值",
  "Apprec %": "增值 %",
  "Linked Loan": "关联贷款",
  "Sell Age": "出售年龄",
  "Sell Price": "出售价格",
  "+ Add fixed asset": "+ 添加固定资产",
  "— none —": "— 无 —",

  // Phases card
  "Phases": "阶段",
  "Start": "开始",
  "End": "结束",
  "Monthly Income": "月收入",
  "Income Infl %": "收入通胀 %",
  "Save Surplus To": "盈余存入",
  "— consumed —": "— 全数消费 —",

  // Snapshot
  "Milestone snapshot": "里程碑快照",
  "Year-by-year detail": "逐年详情",
  "Show every year": "显示每一年",
  "Show milestones only": "仅显示里程碑",
  "Age": "年龄",
  "Phase": "阶段",
  "Total": "总计",
  "Income (yr)": "收入 (年)",
  "Living costs (yr)": "生活开支 (年)",
  "Liability (yr)": "负债 (年)",
  "Total Spend (yr)": "总支出 (年)",
  "Drained (yr)": "提取 (年)",

  // Verdict
  "Peak Wealth": "财富峰值",
  "at age": "于年龄",
  "End of Plan": "计划结束",
  "Outcome": "结果",
  "Solvent through": "可支撑至",
  "Runs out @": "用尽于 @",

  // Asset trajectory
  "Asset trajectory": "资产轨迹",
  "Total Assets": "总资产",

  // Welcome modal — vocabulary
  "Salary": "薪水",
  "Expenses": "支出",
  "Loan": "贷款",
  "Stocks": "股票",
  "Cash": "现金",
  "cap": "上限",
  "Settings": "设置",
  "Your money": "您的钱",
  "Your life": "您的人生",
  "Results": "结果",

  // Welcome modal
  "How Money Runway works": "Money Runway 如何运作",
  "A 30-second tour of the math.": "30 秒了解背后的数学。",
  "Surplus → save": "盈余 → 储蓄",
  "Shortfall → drain": "不足 → 提取",
  "Year after year → ": "年复一年 → ",
  "Asset trajectory chart": "资产轨迹图",
  "shows your runway": "显示您的资金跑道",
  "To use this app:": "使用本应用:",
  "(or skip and edit freely)": "(或跳过,自由编辑)",
  "Tweak the": "调整",
  "sections": "部分",
  "Watch the": "查看",
  "panel update live": "面板实时更新",
  "🔒 Your data never leaves this browser.": "🔒 您的数据不会离开此浏览器。",
  "Don't show this again": "不再显示",
  "Got it, let's plan!": "明白了,开始规划!",

  // Saved scenarios
  "Saved scenarios": "已保存方案",
  "No saved scenarios yet. Use": "尚无已保存方案。使用",
  "in the header to store the current setup. Scenarios live in your browser only — they're never uploaded.":
    "(标头中) 保存当前设置。方案仅存在于您的浏览器中 — 永不上传。",
  "Load": "加载",
  "Delete": "删除",

  // How does this work
  "How does this work?": "这是如何运作的?",

  // Help
  "ⓘ What do these columns mean?": "ⓘ 这些列是什么意思?",

  // Scope section
  "What this tool does & doesn't model":
    "本工具能与不能模拟什么",
  "✓ Handles": "✓ 能处理",
  "✗ Does not handle": "✗ 不能处理",
  "Treat the verdict as a baseline. Add a buffer for what isn't modeled.":
    "将结果视为基准线。为未建模的因素留出缓冲。",

  // Footer
  "Built by": "由",
  "a PhD": "一位博士",
  "Open source on": "开源于",
  "All calculations are local; nothing is sent to a server.":
    "所有计算都在本地进行;不会发送任何数据至服务器。",
};

const dictionaries: Record<Lang, Dict> = { en, ms, zh };

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored === "en" || stored === "ms" || stored === "zh") return stored;
    } catch {
      /* ignore */
    }
    return "en";
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      /* ignore */
    }
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
  }

  function t(key: string): string {
    if (lang === "en") return key;
    return dictionaries[lang][key] ?? key;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
