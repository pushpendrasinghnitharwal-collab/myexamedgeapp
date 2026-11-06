// EXAMEDGE — Study material library: notes, formula sheets, revision PDFs, e-books

export const MATERIALS = [
  {
    id: 'mat-1',
    type: 'notes',
    title: { en: 'Quantitative Aptitude — Complete Formula Sheet', hi: 'संख्यात्मक अभियोग्यता — पूर्ण सूत्र पत्रक' },
    subject: 'quant',
    pages: 18,
    size: '1.4 MB',
    rating: 4.8,
    downloads: 48213,
    updated: '2 days ago',
    free: true,
    tags: ['formula', 'revision', 'quick'],
    sections: [
      {
        h: { en: 'Percentage', hi: 'प्रतिशत' },
        rows: [
          ['% change', '((New − Old) / Old) × 100'],
          ['% of X =', 'X × (P/100)'],
          ['A% more than B', 'B + (B × A/100)'],
          ['Successive % change', 'x + y + xy/100'],
        ],
      },
      {
        h: { en: 'Profit & Loss', hi: 'लाभ एवं हानि' },
        rows: [
          ['Profit %', '((SP − CP)/CP) × 100'],
          ['SP when marked M', 'M × (1 − D/100)'],
          ['Discount on CP', 'MP − CP'],
          ['Two articles at same SP', 'Net % = ±(x²/100)'],
        ],
      },
      {
        h: { en: 'Time & Work', hi: 'समय एवं कार्य' },
        rows: [
          ['A+B together', 'ab / (a + b)'],
          ['Efficiency ratio', 'Time inverse ratio'],
          ['A leaves after d days', 'Remaining work / A’s rate'],
        ],
      },
      {
        h: { en: 'Speed & Distance', hi: 'चाल एवं दूरी' },
        rows: [
          ['km/h → m/s', '× 5/18'],
          ['m/s → km/h', '× 18/5'],
          ['Boat & stream', 'Down = (b + s)/2, Up = (b − s)/2'],
          ['Average speed', 'Total distance / Total time'],
        ],
      },
    ],
  },
  {
    id: 'mat-2',
    type: 'notes',
    title: { en: 'Reasoning Ability — Shortcut Tricks', hi: 'तर्कशक्ति — शॉर्टकट ट्रिक्स' },
    subject: 'reasoning',
    pages: 22,
    size: '1.9 MB',
    rating: 4.7,
    downloads: 38904,
    updated: '5 days ago',
    free: true,
    tags: ['shortcuts', 'exam-day'],
    sections: [
      {
        h: { en: 'Coding–Decoding', hi: 'कूटलेखन' },
        rows: [
          ['Opposite letter coding', 'A↔Z, B↔Y (+1 / −1 rules)'],
          ['Letter value', 'A=1 … Z=26'],
          ['Reverse-alphabet value', 'A=26 … Z=1'],
          ['Word number trick', 'Sum of letter values'],
        ],
      },
      {
        h: { en: 'Series', hi: 'श्रृंखला' },
        rows: [
          ['Difference series', '2nd difference constant'],
          ['Multiplicative', '×2 ±1, ×3 ±2'],
          ['Prime-based', '+2, +3, +5, +7'],
          ['Square/cube', '1,4,9,16 / 1,8,27,64'],
        ],
      },
      {
        h: { 'en': 'Syllogism Rules', 'hi': 'न्यायवाक्य नियम' },
        rows: [
          ['A → B', 'One statement, no converse'],
          ['Either–or', 'Exactly one is true'],
          ['Possibility case', 'Check each option individually'],
        ],
      },
    ],
  },
  {
    id: 'mat-3',
    type: 'notes',
    title: { en: 'English Grammar & Error Spotting Rules', hi: 'अंग्रेज़ी व्याकरण एवं त्रुटि अनुसन्धान नियम' },
    subject: 'english',
    pages: 15,
    size: '1.1 MB',
    rating: 4.6,
    downloads: 51220,
    updated: '1 week ago',
    free: true,
    tags: ['grammar', 'error-spotting'],
    sections: [
      {
        h: { en: 'Tense Rules', hi: 'काल नियम' },
        rows: [
          ['Since / for', 'Present perfect / perfect continuous'],
          ['By the time', 'Past perfect'],
          ['Since last…', 'Present perfect continuous'],
        ],
      },
      {
        h: { en: 'Subject–Verb Agreement', hi: 'कर्ता-क्रिया अन्विति' },
        rows: [
          ['One of the + plural noun', 'plural verb'],
          ['Each / Every / None', 'singular verb'],
          ['A pair of / a couple of', 'singular verb'],
        ],
      },
    ],
  },
  {
    id: 'mat-4',
    type: 'pdf',
    title: { en: 'General Knowledge & Current Affairs — Monthly Magazine (English)', hi: 'सामान्य ज्ञान एवं समसामयिक घटनाक्रम — मासिक पत्रिका' },
    subject: 'current',
    pages: 64,
    size: '8.6 MB',
    rating: 4.9,
    downloads: 92640,
    updated: 'today',
    free: true,
    tags: ['magazine', 'monthly', 'ca'],
    sections: [
      {
        h: { en: 'Inside this issue', hi: 'इस अंक में' },
        rows: [
          ['National', 'Policy round-up — 6 key decisions explained'],
          ['International', 'BRICS expansion & Quad critical minerals'],
          ['Economy', 'MPC hold, forex reserves, MSHI scheme'],
          ['One-liners', '40 exam-ready facts with mnemonics'],
          ['Quiz', '30 MCQs with answer key at page 58'],
        ],
      },
    ],
  },
  {
    id: 'mat-5',
    type: 'notes',
    title: { en: 'Indian Polity — Constitution Master Notes', hi: 'भारतीय राजव्यवस्था — संविधान मास्टर नोट्स' },
    subject: 'polity',
    pages: 34,
    size: '2.7 MB',
    rating: 4.8,
    downloads: 41533,
    updated: '3 days ago',
    free: false,
    tags: ['polity', 'upsc', 'prelims'],
    sections: [
      {
        h: { en: 'Key Articles', hi: 'मुख्य अनुच्छेद' },
        rows: [
          ['Art. 14–32', 'Fundamental Rights'],
          ['Art. 110', 'Money Bill, introduced only in Lok Sabha'],
          ['Art. 226', 'Writs — High Courts'],
          ['Art. 280', 'Finance Commission'],
          ['Art. 312', 'All India Services'],
        ],
      },
      {
        h: { en: 'Schedules', hi: 'अनुसूचियाँ' },
        rows: [
          ['1st', 'States & UTs'],
          ['2nd', 'Salaries of constitutional authorities'],
          ['7th', 'Union / State / Concurrent lists'],
          ['8th', '22 recognised languages'],
        ],
      },
    ],
  },
  {
    id: 'mat-6',
    type: 'ebook',
    title: { en: 'Modern History — Spectrum Style Timeline (1877–1947)', hi: 'आधुनिक इतिहास — टाइमलाइन (1877–1947)' },
    subject: 'history',
    pages: 48,
    size: '4.2 MB',
    rating: 4.7,
    downloads: 28741,
    updated: '2 weeks ago',
    free: false,
    tags: ['history', 'timeline', 'upsc'],
    sections: [
      {
        h: { en: 'Famous years', hi: 'प्रसिद्ध वर्ष' },
        rows: [
          ['1857', 'First War of Independence'],
          ['1885', 'Indian National Congress founded'],
          ['1919', 'Rowlatt Act & Jallianwala Bagh'],
          ['1930', 'Dandi March & Civil Disobedience'],
          ['1942', 'Quit India Movement'],
          ['1947', 'Independence & Partition'],
        ],
      },
    ],
  },
  {
    id: 'mat-7',
    type: 'notes',
    title: { en: 'Environment & Ecology — Biodiversity & Conventions', hi: 'पर्यावरण एवं पारिस्थितिकी — जैव विविधता एवं समझौते' },
    subject: 'env',
    pages: 21,
    size: '1.8 MB',
    rating: 4.6,
    downloads: 21408,
    updated: '4 days ago',
    free: false,
    tags: ['environment', 'upsc', 'gs3'],
    sections: [
      {
        h: { en: 'Must-remember lists', hi: 'याद रखने योग्य सूचियाँ' },
        rows: [
          ['36 hotspots', 'India: Himalaya, Western Ghats, Indo-Burma, Sundaland, Nicobar'],
          ['5 Ramsar', 'Keoladeo, Chilika, Vembanad, Loktak, Dal Lake'],
          ['World Heritage (36)', 'Taj Mahal, Kaziranga, Sun Temple…'],
          ['Conventions', 'CBD, CITES, Ramsar, UNFCCC, Kyoto, Montreal'],
        ],
      },
    ],
  },
  {
    id: 'mat-8',
    type: 'pdf',
    title: { en: 'SSC CGL Tier-I Previous Year Papers (2019–2025)', hi: 'एसएससी सीजीएल टियर-I पिछले वर्षों के प्रश्नपत्र (2019–2025)' },
    subject: 'quant',
    pages: 96,
    size: '6.4 MB',
    rating: 4.9,
    downloads: 134502,
    updated: '3 weeks ago',
    free: false,
    tags: ['pyq', 'ssc', 'bundle'],
    sections: [
      {
        h: { en: 'Bundle contents', hi: 'बंडल में' },
        rows: [
          ['7 papers', '2019, 2020, 2021, 2022, 2023, 2024, 2025'],
          ['Shift-wise', 'Shift 1 & Shift 2 each year'],
          ['Answer keys', 'With topic-wise difficulty analysis'],
          ['Cut-off', 'Previous year category-wise cut-offs'],
        ],
      },
    ],
  },
]

export const MATERIAL_TYPES = [
  { id: 'all', label: { en: 'All', hi: 'सभी' }, icon: '📚' },
  { id: 'notes', label: { en: 'Notes', hi: 'नोट्स' }, icon: '📝' },
  { id: 'pdf', label: { en: 'PDFs', hi: 'पीडीएफ' }, icon: '📄' },
  { id: 'ebook', label: { en: 'E-Books', hi: 'ई-बुक' }, icon: '📖' },
]
