import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "ms" | "zh";

const LS_KEY = "retire-plan:lang";

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  ms: "Bahasa Malaysia",
  zh: "中文",
};

type Dict = Record<string, string>;

const en: Dict = {
  // Column-help blocks (keys for nested copy)
  "help.accounts.name": "Label for the account (e.g. EPF, ASM, Stocks, Cash).",
  "help.accounts.balance": "How much is in this account today.",
  "help.accounts.rate": "Annual return rate. EPF ≈ 6%, ASM ≈ 5%, stocks ≈ 4%, cash 0%.",
  "help.accounts.drain": "Order this account is emptied when income falls short. Lower number = drained first. Cash (0) goes first so your highest-compounding account is preserved longest.",
  "help.accounts.maxTopUp": "Annual contribution cap (e.g. EPF self-contribution = RM100,000/yr by law). Leave blank for uncapped. Surplus that exceeds the cap overflows to the next-highest-rate account.",

  "help.expenses.name": "Spending category (food, insurance, subscriptions, etc.).",
  "help.expenses.monthly": "How much you spend per month at today's prices.",
  "help.expenses.infl": "Annual inflation rate for THIS line. Food typically 5%, services 3%, fixed costs 0% — finer than a single \"general inflation\" assumption.",
  "help.expenses.cap": "Optional monthly ceiling after inflation. e.g. Food cap RM8,000/mo means it won't grow past that even with 5%/yr inflation. Leave blank for uncapped.",

  "help.liabilities.name": "What this debt is for (housing loan, car loan, etc.).",
  "help.liabilities.monthly": "Required payment per month at today's value.",
  "help.liabilities.startAge": "When payments begin. Leave blank to start at plan start age.",
  "help.liabilities.endAge": "Last age you'll make a payment (inclusive by default — see Settings → Assumption toggles).",
  "help.liabilities.infl": "Annual growth of the payment. Most fixed loans = 0%.",

  "help.fixedAssets.lead": "Things you own with value (house, car). Not counted in your portfolio until sold. Optionally linked to a liability — selling pays off the loan and deposits the net to your preferred surplus account.",
  "help.fixedAssets.name": "Label (House, Car, Land).",
  "help.fixedAssets.currentValue": "What it's worth today.",
  "help.fixedAssets.apprec": "Annual appreciation rate (Malaysia property ≈ 2–4%/yr).",
  "help.fixedAssets.linkedLoan": "If this asset has a loan against it, pick the Liability. When you sell, that loan is auto-paid off from the proceeds.",
  "help.fixedAssets.sellAge": "When you plan to sell. Leave blank for never.",
  "help.fixedAssets.sellPrice": "Override the projected sale price. Leave blank to use the appreciated value at Sell Age.",

  "help.phases.name": "Label for this life stage (Career, Semi-Retirement, Retirement, etc.).",
  "help.phases.start": "First age in this phase. Auto-locks to previous phase end + 1 (or to plan start for the first phase).",
  "help.phases.end": "Last age in this phase. Auto-locks to plan end for the last phase.",
  "help.phases.monthlyIncome": "Your take-home pay during this phase. Set 0 for retirement / no income.",
  "help.phases.incomeInfl": "Annual raise rate within this phase. 0 = flat salary.",
  "help.phases.surplus": "Where leftover income (income − expenses − liabilities) is deposited. Excess beyond that account's cap cascades to the next-highest-rate account. Pick \"— consumed —\" if you'd rather model lifestyle inflation eating all surplus.",
  "help.phases.transfers": "Transfers (toggle the ▸ on a row) move money between your accounts each year — e.g. ASM → EPF to arbitrage 5% to 6%. This is different from surplus savings, which is new income coming in.",

  "help.snapshot.age": "Your age in that year.",
  "help.snapshot.phase": "Which life phase you're in that year (Career, Semi-Retirement, etc.).",
  "help.snapshot.total": "Sum of all liquid account balances at year-end.",
  "help.snapshot.accountCols.label": "[Account columns]",
  "help.snapshot.accountCols": "Year-end balance in each of your accounts.",
  "help.snapshot.income": "Annual take-home income from the phase you're in.",
  "help.snapshot.livingCosts": "Sum of all personal expenses (food, insurance, etc.) for that year. Excludes liabilities.",
  "help.snapshot.liability": "Loan / mortgage payments for that year.",
  "help.snapshot.totalSpend": "Living costs + Liability.",
  "help.snapshot.drained": "What your portfolio actually paid out (= Total Spend − Income). ⚠ icon means the portfolio couldn't cover the year.",

  // How does this work
  "hiw.eachYear": "Each year: your income covers as much of your expenses + liabilities as it can. Whatever it doesn't cover comes out of your accounts (drained in Drain order).",
  "hiw.surplus": "Leftover income (surplus): deposited via cascade — first into your Save Surplus To account (up to its Max Top-up cap), overflow goes to the next-highest-rate account, finally to Cash (0%) if all caps are hit.",
  "hiw.transfers": "Transfers: move existing balance between accounts each year (e.g. ASM→EPF arbitrage). Different from savings — this doesn't add new money.",
  "hiw.privacy": "Privacy: everything is computed in your browser. Share-link uses the URL hash fragment, which browsers never send to servers. Saved scenarios live only in this browser's local storage.",

  // Saved scenarios empty state
  "saved.empty": "No saved scenarios yet. Use 💾 Save in the header to store the current setup. Scenarios live in your browser only — they're never uploaded.",

  // Drain order hint
  "drain.order.hint": "Drain order: when income falls short, accounts are emptied in ascending Drain number — 0 first, then 1, 2, 3. The preset drains Cash (0%) first, then Stocks (4%), ASM (5%), and finally EPF (6%) — so your highest-compounding account is preserved longest. This is the standard \"lowest-return-first\" withdrawal strategy.",

  // Expense total note
  "expense.total.note": "Some lines inflate; future totals will be higher (see Milestone snapshot).",
  "mo": "mo",
  "yr": "yr",

  // Transfers editor
  "Annual transfers": "Annual transfers",
  "Move existing balance between accounts each year.": "Move existing balance between accounts each year (e.g. ASM→EPF arbitrage). Different from surplus cascade.",
  "Move": "Move",
  "from": "from",
  "+ Add transfer": "+ Add transfer",
  "Remove": "Remove",

  // Add buttons (also default if MS/ZH miss)
  "+ Add account": "+ Add account",
  "+ Add expense": "+ Add expense",
  "+ Add liability": "+ Add liability",
  "+ Add fixed asset": "+ Add fixed asset",

  // Phase warning
  "Snap to contiguous": "Snap to contiguous",

  // Income vs Spend chart
  "Income vs Spend per phase": "Income vs Spend per phase",
  "Income": "Income",
  "Spend": "Spend",
  "incomeVsSpend.hint": "Each phase summed — red bars mean spend exceeded income in that phase. Useful for spotting drain years.",

  "section.settings.intro": "Time horizon (start/end age) and the two modeling toggles. Most users only set these once.",
  "section.money.intro": "Your financial snapshot today — accounts you own, monthly expenses, ongoing loans, and any sellable assets like a house or car.",
  "section.life.intro": "Your life broken into phases (career, semi-retire, full retire). Each phase has a monthly income and where surplus is saved.",
};

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

  // Column-help blocks
  "help.accounts.name": "Label untuk akaun (cth. KWSP, ASM, Saham, Tunai).",
  "help.accounts.balance": "Jumlah dalam akaun ini hari ini.",
  "help.accounts.rate": "Kadar pulangan tahunan. KWSP ≈ 6%, ASM ≈ 5%, saham ≈ 4%, tunai 0%.",
  "help.accounts.drain": "Susunan akaun dikosongkan apabila pendapatan tidak mencukupi. Nombor lebih kecil = dikeluarkan dahulu. Tunai (0) keluar dahulu supaya akaun dengan pulangan tertinggi disimpan paling lama.",
  "help.accounts.maxTopUp": "Had sumbangan tahunan (cth. sumbangan KWSP sendiri = RM100,000/tahun). Kosongkan untuk tiada had. Lebihan yang melebihi had akan dialihkan ke akaun kadar pulangan tertinggi seterusnya.",

  "help.expenses.name": "Kategori perbelanjaan (makanan, insurans, langganan, dll.).",
  "help.expenses.monthly": "Berapa banyak anda belanja setiap bulan pada harga hari ini.",
  "help.expenses.infl": "Kadar inflasi tahunan untuk baris INI. Makanan biasanya 5%, perkhidmatan 3%, kos tetap 0% — lebih tepat daripada satu andaian inflasi am.",
  "help.expenses.cap": "Had bulanan pilihan selepas inflasi. cth. Had makanan RM8,000/bulan bermakna ia tidak akan melebihi itu walaupun dengan inflasi 5%/tahun. Kosongkan untuk tiada had.",

  "help.liabilities.name": "Untuk apa hutang ini (pinjaman rumah, pinjaman kereta, dll.).",
  "help.liabilities.monthly": "Bayaran perlu setiap bulan pada nilai hari ini.",
  "help.liabilities.startAge": "Bila pembayaran bermula. Kosongkan untuk mula pada umur permulaan pelan.",
  "help.liabilities.endAge": "Umur terakhir anda buat pembayaran (termasuk secara lalai — lihat Tetapan → Andaian).",
  "help.liabilities.infl": "Pertumbuhan tahunan pembayaran. Kebanyakan pinjaman tetap = 0%.",

  "help.fixedAssets.lead": "Barang yang anda miliki yang bernilai (rumah, kereta). Tidak dikira dalam portfolio anda sehingga dijual. Boleh dipautkan dengan liabiliti — menjual akan membayar pinjaman dan mendepositkan baki ke akaun lebihan pilihan anda.",
  "help.fixedAssets.name": "Label (Rumah, Kereta, Tanah).",
  "help.fixedAssets.currentValue": "Nilainya hari ini.",
  "help.fixedAssets.apprec": "Kadar penghargaan tahunan (hartanah Malaysia ≈ 2–4%/tahun).",
  "help.fixedAssets.linkedLoan": "Jika aset ini ada pinjaman, pilih Liabiliti. Apabila anda jual, pinjaman itu akan dibayar automatik dari hasil jualan.",
  "help.fixedAssets.sellAge": "Bila anda merancang untuk jual. Kosongkan jika tidak akan dijual.",
  "help.fixedAssets.sellPrice": "Tindih ramalan harga jualan. Kosongkan untuk guna nilai dihargai pada Umur Jual.",

  "help.phases.name": "Label untuk fasa hidup ini (Kerjaya, Separa-Persaraan, Persaraan, dll.).",
  "help.phases.start": "Umur pertama dalam fasa ini. Auto-kunci kepada akhir fasa sebelumnya + 1 (atau mula pelan untuk fasa pertama).",
  "help.phases.end": "Umur terakhir dalam fasa ini. Auto-kunci kepada akhir pelan untuk fasa terakhir.",
  "help.phases.monthlyIncome": "Gaji bersih semasa fasa ini. Tetapkan 0 untuk persaraan / tiada pendapatan.",
  "help.phases.incomeInfl": "Kadar kenaikan tahunan dalam fasa ini. 0 = gaji rata.",
  "help.phases.surplus": "Di mana lebihan pendapatan (pendapatan − perbelanjaan − liabiliti) didepositkan. Lebihan yang melebihi had akaun akan dialihkan ke akaun kadar pulangan tertinggi seterusnya. Pilih \"— dihabiskan —\" jika anda ingin model inflasi gaya hidup yang menghabiskan semua lebihan.",
  "help.phases.transfers": "Pemindahan (klik ▸ pada baris) mengalihkan wang antara akaun anda setiap tahun — cth. ASM → KWSP untuk arbitraj 5% kepada 6%. Ini berbeza daripada simpanan lebihan, iaitu pendapatan baru.",

  "help.snapshot.age": "Umur anda pada tahun itu.",
  "help.snapshot.phase": "Fasa hidup yang anda berada pada tahun itu.",
  "help.snapshot.total": "Jumlah baki semua akaun cair pada akhir tahun.",
  "help.snapshot.accountCols.label": "[Lajur akaun]",
  "help.snapshot.accountCols": "Baki akhir tahun dalam setiap akaun anda.",
  "help.snapshot.income": "Pendapatan tahunan bersih dari fasa anda.",
  "help.snapshot.livingCosts": "Jumlah semua perbelanjaan peribadi (makanan, insurans, dll.) untuk tahun itu. Tidak termasuk liabiliti.",
  "help.snapshot.liability": "Bayaran pinjaman / gadai janji untuk tahun itu.",
  "help.snapshot.totalSpend": "Kos sara hidup + Liabiliti.",
  "help.snapshot.drained": "Apa yang portfolio anda sebenarnya bayar (= Jumlah Belanja − Pendapatan). Ikon ⚠ bermakna portfolio tidak dapat menampung tahun itu.",

  // How does this work
  "hiw.eachYear": "Setiap tahun: pendapatan anda menampung sebanyak mungkin perbelanjaan + liabiliti. Apa yang tidak ditampung diambil dari akaun (dikeluarkan mengikut Susunan Pengeluaran).",
  "hiw.surplus": "Lebihan pendapatan: didepositkan melalui lapisan — pertama ke akaun Simpan Lebihan ke (sehingga Had Tambahan), lebihan pergi ke akaun kadar pulangan tertinggi seterusnya, akhirnya ke Tunai (0%) jika semua had dikenakan.",
  "hiw.transfers": "Pemindahan: alihkan baki sedia ada antara akaun setiap tahun (cth. arbitraj ASM→KWSP). Berbeza daripada simpanan — ini tidak menambah wang baru.",
  "hiw.privacy": "Privasi: semua dikira dalam pelayar anda. Pautan-kongsi menggunakan serpihan hash URL, yang pelayar tidak pernah hantar ke pelayan. Senario disimpan hanya wujud dalam pelayar tempatan ini.",

  // Saved scenarios empty state
  "saved.empty": "Belum ada senario disimpan. Guna 💾 Simpan di pengepala untuk menyimpan persediaan semasa. Senario hanya wujud dalam pelayar anda — tidak pernah dimuat naik.",

  // Drain hint
  "drain.order.hint": "Susunan Pengeluaran: apabila pendapatan kurang, akaun dikosongkan mengikut nombor Pengeluaran menaik — 0 dahulu, kemudian 1, 2, 3. Preset mengeluarkan Tunai (0%) dahulu, kemudian Saham (4%), ASM (5%), dan akhirnya KWSP (6%) — supaya akaun dengan kompaun tertinggi disimpan paling lama. Ini adalah strategi pengeluaran \"pulangan-terendah-dahulu\" standard.",

  "expense.total.note": "Sesetengah baris ada inflasi; jumlah masa depan akan lebih tinggi (lihat Petikan Penanda Aras).",
  "mo": "bln",
  "yr": "thn",

  // Transfers editor
  "Annual transfers": "Pemindahan tahunan",
  "Move existing balance between accounts each year.": "Alihkan baki sedia ada antara akaun setiap tahun (cth. arbitraj ASM→KWSP). Berbeza daripada lapisan lebihan.",
  "Move": "Alih",
  "from": "dari",
  "+ Add transfer": "+ Tambah pemindahan",
  "Remove": "Buang",
  "Snap to contiguous": "Selaraskan",
  "Income vs Spend per phase": "Pendapatan vs Perbelanjaan ikut fasa",
  "Income": "Pendapatan",
  "Spend": "Perbelanjaan",
  "incomeVsSpend.hint": "Setiap fasa dijumlahkan — bar merah bermakna perbelanjaan melebihi pendapatan dalam fasa itu. Berguna untuk mengesan tahun-tahun pengeluaran.",
  "section.settings.intro": "Jangka masa (umur mula/tamat) dan dua andaian model. Kebanyakan pengguna hanya tetapkan ini sekali.",
  "section.money.intro": "Gambaran kewangan anda hari ini — akaun yang anda miliki, perbelanjaan bulanan, pinjaman semasa, dan aset boleh dijual seperti rumah atau kereta.",
  "section.life.intro": "Hidup anda dibahagikan kepada fasa (kerjaya, separa-persaraan, persaraan penuh). Setiap fasa ada pendapatan bulanan dan ke mana lebihan disimpan.",

  // Add buttons
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

  // Column-help blocks
  "help.accounts.name": "账户的标签 (例如 EPF、ASM、股票、现金)。",
  "help.accounts.balance": "今天此账户中的金额。",
  "help.accounts.rate": "年回报率。EPF ≈ 6%、ASM ≈ 5%、股票 ≈ 4%、现金 0%。",
  "help.accounts.drain": "当收入不足时,此账户被清空的顺序。数字越小 = 越先被提取。现金 (0) 最先,以便保留最高复利账户最长时间。",
  "help.accounts.maxTopUp": "年缴款上限 (例如 EPF 自付额 = 每年 RM100,000,法定)。留空表示无上限。超过上限的盈余将级联至下一个最高利率账户。",

  "help.expenses.name": "支出类别 (食物、保险、订阅等)。",
  "help.expenses.monthly": "您每月按今日价格的支出金额。",
  "help.expenses.infl": "此项的年通胀率。食物通常 5%、服务 3%、固定成本 0% — 比单一\"一般通胀\"假设更精细。",
  "help.expenses.cap": "通胀后的可选月度上限。例如食物上限 RM8,000/月表示即使有 5%/年通胀也不会超过此值。留空表示无上限。",

  "help.liabilities.name": "此债务用途 (房贷、车贷等)。",
  "help.liabilities.monthly": "今日价值的每月必需付款。",
  "help.liabilities.startAge": "付款开始的年龄。留空则从计划起始年龄开始。",
  "help.liabilities.endAge": "您最后一次付款的年龄 (默认包含 — 参见 设置 → 假设开关)。",
  "help.liabilities.infl": "付款的年增长率。多数固定贷款 = 0%。",

  "help.fixedAssets.lead": "您拥有的有价值物品 (房屋、汽车)。在出售之前不计入您的投资组合。可选择关联负债 — 出售时偿还贷款并将净额存入您的首选盈余账户。",
  "help.fixedAssets.name": "标签 (房屋、汽车、土地)。",
  "help.fixedAssets.currentValue": "今日的价值。",
  "help.fixedAssets.apprec": "年增值率 (马来西亚房产 ≈ 2–4%/年)。",
  "help.fixedAssets.linkedLoan": "如果此资产有相关贷款,选择该负债。出售时,贷款将自动从所得款项中偿还。",
  "help.fixedAssets.sellAge": "您计划出售的年龄。留空则永不出售。",
  "help.fixedAssets.sellPrice": "覆盖预计售价。留空使用出售年龄时的增值价值。",

  "help.phases.name": "此人生阶段的标签 (职业、半退休、退休等)。",
  "help.phases.start": "此阶段的第一个年龄。自动锁定为上一阶段结束 + 1 (或第一阶段为计划起始)。",
  "help.phases.end": "此阶段的最后一个年龄。最后阶段自动锁定为计划结束。",
  "help.phases.monthlyIncome": "此阶段的实领工资。设为 0 表示退休 / 无收入。",
  "help.phases.incomeInfl": "此阶段内的年加薪率。0 = 工资不变。",
  "help.phases.surplus": "剩余收入 (收入 − 支出 − 负债) 的存放位置。超出该账户上限的部分将级联到下一个最高利率账户。如果您希望模拟生活方式通胀吞噬所有盈余,请选择\"— 全数消费 —\"。",
  "help.phases.transfers": "转账 (点击行上的 ▸) 每年在账户之间转移资金 — 例如 ASM → EPF 以套利 5% 至 6%。这与盈余储蓄不同,后者是新收入。",

  "help.snapshot.age": "您在该年的年龄。",
  "help.snapshot.phase": "您该年所处的人生阶段。",
  "help.snapshot.total": "年终所有流动账户余额之和。",
  "help.snapshot.accountCols.label": "[账户列]",
  "help.snapshot.accountCols": "您每个账户的年终余额。",
  "help.snapshot.income": "您所在阶段的年度实领收入。",
  "help.snapshot.livingCosts": "该年的所有个人支出 (食物、保险等) 之和。不包括负债。",
  "help.snapshot.liability": "该年的贷款/抵押付款。",
  "help.snapshot.totalSpend": "生活开支 + 负债。",
  "help.snapshot.drained": "您的投资组合实际支付的金额 (= 总支出 − 收入)。⚠ 图标表示投资组合无法覆盖该年。",

  "hiw.eachYear": "每年:您的收入尽可能覆盖支出 + 负债。未覆盖的部分从您的账户中提取 (按提取顺序)。",
  "hiw.surplus": "剩余收入 (盈余):通过级联存入 — 首先存入您的\"盈余存入\"账户 (直至最大充值上限),溢出部分进入下一个最高利率账户,所有上限达到时最终进入现金 (0%)。",
  "hiw.transfers": "转账:每年在账户之间转移现有余额 (例如 ASM→EPF 套利)。与储蓄不同 — 这不会增加新资金。",
  "hiw.privacy": "隐私:一切都在您的浏览器中计算。分享链接使用 URL 哈希片段,浏览器永不发送到服务器。已保存方案仅存在于此浏览器的本地存储中。",

  "saved.empty": "尚无已保存方案。使用标头中的 💾 保存按钮存储当前设置。方案仅存在于您的浏览器中 — 永不上传。",

  "drain.order.hint": "提取顺序:当收入不足时,账户按提取编号升序清空 — 0 优先,然后 1、2、3。预设按现金 (0%) 优先提取,然后股票 (4%)、ASM (5%),最后 EPF (6%) — 以便最高复利账户保留最长时间。这是标准的\"最低收益优先\"提取策略。",

  "expense.total.note": "部分项目会通胀;未来总额会更高 (见里程碑快照)。",
  "mo": "月",
  "yr": "年",

  // Transfers editor
  "Annual transfers": "年度转账",
  "Move existing balance between accounts each year.": "每年在账户之间转移现有余额 (例如 ASM→EPF 套利)。与盈余级联不同。",
  "Move": "转移",
  "from": "从",
  "+ Add transfer": "+ 添加转账",
  "Remove": "移除",
  "Snap to contiguous": "对齐为连续",
  "Income vs Spend per phase": "各阶段 收入 vs 支出",
  "Income": "收入",
  "Spend": "支出",
  "incomeVsSpend.hint": "每个阶段汇总 — 红色条形表示该阶段支出超过收入。有助于发现资金流出年份。",
  "section.settings.intro": "时间范围 (起始/结束年龄) 和两个模型假设开关。大多数用户只需设置一次。",
  "section.money.intro": "您今日的财务快照 — 您拥有的账户、每月支出、当前贷款,以及任何可出售资产 (如房屋、汽车)。",
  "section.life.intro": "将您的人生分为不同阶段 (职业、半退休、全退休)。每个阶段都有月收入和盈余存放位置。",
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
    return dictionaries[lang][key] ?? key;
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
