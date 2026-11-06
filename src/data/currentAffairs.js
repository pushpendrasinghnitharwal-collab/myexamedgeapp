// EXAMEDGE — Daily Current Affairs capsule (bilingual) + CA quiz items
// Dates are generated relative to "today" so the app always feels live.

const DAY = 86400000

export const CA_ITEMS = [
  {
    id: 'ca-1',
    cat: 'national',
    title: {
      en: 'Cabinet approves 5% interest subvention scheme for small exporters',
      hi: 'मंत्रिमंडल ने छोटे निर्यातकों के लिए 5% ब्याज छूट योजना को मंजूरी दी',
    },
    body: {
      en: 'The Cabinet Committee on Economic Affairs approved a 5% interest subvention scheme worth Rs. 4,500 crore for the MSME export sector. The benefit will be available for three years on eligible export credit and will benefit roughly 1,800 MSME exporters.',
      hi: 'आर्थिक मामलों की मंत्रिमंडल समिति ने MSME निर्यातक क्षेत्र के लिए 4,500 करोड़ रुपये की 5% ब्याज छूट योजना को मंजूरी दी। लाभ पात्र निर्यात ऋण पर तीन वर्ष के लिए उपलब्ध होगा और लगभग 1,800 MSME निर्यातकों को लाभ होगा।',
    },
    tag: { en: 'Economy', hi: 'अर्थव्यवस्था' },
    impact: 'Boosts MSME export competitiveness; RBI has been asked to operationalise the credit window through SIDBI and ECGC.',
  },
  {
    id: 'ca-2',
    cat: 'national',
    title: {
      en: 'India–France summit concludes with comprehensive strategic partnership roadmap',
      hi: 'भारत-फ्रांस शिखर सम्मेलन व्यापक रणनीतिक साझेदारी रोडमैप पर समाप्त',
    },
    body: {
      en: 'The India–France Summit 2026 closed with a roadmap covering defence cooperation, nuclear energy, critical minerals and 50 million euros of additional support for India’s climate action. A bilateral trade target of USD 25 billion by 2030 was reaffirmed.',
      hi: 'भारत-फ्रांस शिखर सम्मेलन 2026 रक्षा सहयोग, परमाणु ऊर्जा, महत्वपूर्ण खनिजों और भारत की जलवायु कार्रवाई के लिए 50 मिलियन यूरो अतिरिक्त सहायता को कवर करते एक रोडमैप के साथ समाप्त हुआ। 2030 तक 250 अरब डॉलर द्विपक्षीय व्यापार लक्ष्य पुनः पुष्ट किया गया।',
    },
    tag: { en: 'International', hi: 'अंतर्राष्ट्रीय' },
    impact: 'Defence offset partnerships and critical mineral sourcing tie-ups are likely to be operationalised within 18 months.',
  },
  {
    id: 'ca-3',
    cat: 'economy',
    title: {
      en: 'RBI holds repo rate at 6.50%, revises growth projection upward',
      hi: 'RBI ने रेपो दर 6.50% पर बरकरार रखी, वृद्धि अनुमान ऊपर संशोधित किया',
    },
    body: {
      en: 'The Monetary Policy Committee kept the repo rate unchanged at 6.50% for the eighth consecutive meeting while raising the FY27 GDP growth projection to 7.1% from 6.8%. The standing deposit facility rate was also left unchanged at 3.35%.',
      hi: 'मौद्रिक नीति समिति ने लगातार आठवीं बार रेपो दर 6.50% पर अपरिवर्तित रखी जबकि FY27 जीडीपी वृद्धि अनुमान 6.8% से बढ़ाकर 7.1% कर दिया। स्टैंडिंग डिपॉजिट सुविधा दर भी 3.35% पर अपरिवर्तित रही।',
    },
    tag: { en: 'Economy', hi: 'अर्थव्यवस्था' },
    impact: 'A stable rate with a growth upgrade favours banking credit expansion and bond markets; deposit rates may start rising.',
  },
  {
    id: 'ca-4',
    cat: 'national',
    title: {
      en: 'Parliament passes Digital Personal Data Protection Amendment Bill',
      hi: 'संसद ने डिजिटल व्यक्तिगत डेटा संरक्षण संशोधन विधेयक पारित किया',
    },
    body: {
      en: 'The Rajya Sabha approved the Digital Personal Data Protection (Amendment) Bill, tightening consent requirements for data collection by notified significant data fiduciarys and raising penalties for breaches.',
      hi: 'राज्य सभा ने डिजिटल व्यक्तिगत डेटा संरक्षण (संशोधन) विधेयक को मंजूरी दी, जिसमें अधिसूचित महत्वपूर्ण डेटा फ़िडेशियरी द्वारा डेटा संग्रहण के लिए सहमति की आवश्यकताएँ कठोर की गईं और उल्लंघन के लिए जुर्माना बढ़ाया गया।',
    },
    tag: { en: 'Governance', hi: 'शासन' },
    impact: 'Impacts ed-tech, fintech and government digital services that collect behavioural data from students.',
  },
  {
    id: 'ca-5',
    cat: 'international',
    title: {
      en: 'Quad grouping launches Critical Minerals Coordination Mechanism',
      hi: 'क्वाड समूह ने महत्वपूर्ण खनिज समन्वय तंत्र शुरू किया',
    },
    body: {
      en: 'The Quad partners announced a Critical Minerals Coordination Mechanism to share geological data, fund exploration in the Indo-Pacific and create a joint procurement pipeline, reducing reliance on single-source supply chains.',
      hi: 'क्वाड भागीदारों ने भूगर्भीय आंकड़ा साझा करने, इंडो-पैसिफिक में अन्वेषण हेतु धन जुटाने और संयुक्त खरीद पाइपलाइन बनाने के लिए महत्वपूर्ण खनिज समन्वय तंत्र की घोषणा की।',
    },
    tag: { en: 'International', hi: 'अंतर्राष्ट्रीय' },
    impact: 'Opens a question in General Studies II and supports India’s critical minerals mission.',
  },
  {
    id: 'ca-6',
    cat: 'economy',
    title: {
      en: 'India’s forex reserves cross USD 720 billion mark',
      hi: 'भारत के विदेशी मुद्रा भंडार ने 720 अरब डॉलर का पार किया',
    },
    body: {
      en: 'RBI weekly statistical supplement reported foreign exchange reserves at USD 721.4 billion, with the forward book at USD 6.2 billion, giving a total of USD 727.6 billion — a record high.',
      hi: 'RBI के साप्ताहिक सांख्यिकी परिशिष्ट में विदेशी मुद्रा भंडार 721.4 अरब डॉलर दर्ज किया गया, फॉरवर्ड बुक 6.2 अरब डॉलर के साथ कुल 727.6 अरब डॉलर — रिकॉर्ड उच्चतम।',
    },
    tag: { en: 'Economy', hi: 'अर्थव्यवस्था' },
    impact: 'Signifies comfortable external buffer and strong capital inflows; a favourite one-liner for banking GA.',
  },
  {
    id: 'ca-7',
    cat: 'national',
    title: {
      en: 'National Education Policy 2.0 draft released for public consultation',
      hi: 'राष्ट्रीय शिक्षा नीति 2.0 का मसौदा जन परामर्श हेतु जारी',
    },
    body: {
      en: 'A draft National Education Policy 2.0 proposes competency-based assessment in Grades 3 and 5, a three-year foundational literacy and numeracy programme and expanded school health and nutrition coverage.',
      hi: 'राष्ट्रीय शिक्षा नीति 2.0 का मसौदा ग्रेड 3 और 5 में कम्पेटेंसी-आधारित मूल्यांकन, तीन वर्षीय आधारभूत साक्षरता एवं संख्यात्मकता कार्यक्रम और विस्तृत विद्यालय स्वास्थ्य एवं पोषण कवरेज का प्रस्ताव करता है।',
    },
    tag: { en: 'Education', hi: 'शिक्षा' },
    impact: 'Directly relevant for CTET, TET and teaching-exam aspirants.',
  },
  {
    id: 'ca-8',
    cat: 'international',
    title: {
      en: 'BRICS expands with three new members; India to host summit in Goa',
      hi: 'ब्रिक्स में तीन नए सदस्य शामिल; भारत गोवा में शिखर सम्मेलन की मेजबानी करेगा',
    },
    body: {
      en: 'BRICS formally admitted three new members at the Kazan summit. India confirmed it will host the 2026 BRICS summit and the related Youth Council and Women’s Business Alliance events.',
      hi: 'कज़ान शिखर सम्मेलन में ब्रिक्स ने औपचारिक रूप से तीन नए सदस्यों को शामिल किया। भारत ने 2026 का ब्रिक्स शिखर सम्मेलन तथा संबंधित यूथ परिषद और महिला व्यापार संगठन कार्यक्रमों की मेजबानी की पुष्टि की।',
    },
    tag: { en: 'International', hi: 'अंतर्राष्ट्रीय' },
    impact: 'High-yield for GS II — appears frequently in SSC, IBPS and UPSC prelims.',
  },
]

export const CA_QUIZ = [
  {
    id: 'caq-1',
    q: { en: 'Which body approves the Monetary Policy Statement in India?', hi: 'भारत में मौद्रिक नीति वक्तव्य कौन अनुमोदित करता है?' },
    o: [
      { en: 'Ministry of Finance', hi: 'वित्त मंत्रालय' },
      { en: 'RBI Monetary Policy Committee', hi: 'RBI मौद्रिक नीति समिति' },
      { en: 'SEBI', hi: 'सेबी' },
      { en: 'NITI Aayog', hi: 'नीति आयोग' },
    ],
    a: 1,
    exp: {
      en: 'The MPC of the Reserve Bank of India approves and issues the Monetary Policy Statement.',
      hi: 'भारतीय रिज़र्व बैंक की मौद्रिक नीति समिति मौद्रिक नीति वक्तव्य को अनुमोदित और जारी करती है।',
    },
  },
  {
    id: 'caq-2',
    q: { en: 'Where will India host the 2026 BRICS summit?', hi: 'भारत 2026 का ब्रिक्स शिखर सम्मेलन कहाँ आयोजित करेगा?' },
    o: [
      { en: 'Goa', hi: 'गोवा' },
      { en: 'Jaipur', hi: 'जयपुर' },
      { en: 'Chennai', hi: 'चेन्नई' },
      { en: 'Lucknow', hi: 'लखनऊ' },
    ],
    a: 0,
    exp: { en: 'India will host the 2026 BRICS summit in Goa.', hi: 'भारत 2026 का ब्रिक्स शिखर सम्मेलन गोवा में आयोजित करेगा।' },
  },
  {
    id: 'caq-3',
    q: { en: 'What was the repo rate after the latest MPC review?', hi: 'ताज़ा MPC समीक्षा के बाद रेपो दर क्या थी?' },
    o: [
      { en: '6.25%', hi: '6.25%' },
      { en: '6.50%', hi: '6.50%' },
      { en: '6.75%', hi: '6.75%' },
      { en: '7.00%', hi: '7.00%' },
    ],
    a: 1,
    exp: { en: 'The MPC held the repo rate at 6.50% for the eighth straight meeting.', hi: 'MPC ने लगातार आठवीं बार रेपो दर 6.50% पर बरकरार रखी।' },
  },
  {
    id: 'caq-4',
    q: { en: 'The NDP Coalition is governed under which model of governance?', hi: 'NDP गठबंधन किस शासन मॉडल पर चलता है?' },
    o: [
      { en: 'Presidential system', hi: 'राष्ट्रपति प्रणाली' },
      { en: 'Parliamentary system', hi: 'संसदीय प्रणाली' },
      { en: 'Federal system', hi: 'संघवादी प्रणाली' },
      { en: 'Semi-presidential system', hi: 'अर्ध-राष्ट्रपति प्रणाली' },
    ],
    a: 1,
    exp: { en: 'The Indian polity follows the parliamentary system of governance.', hi: 'भारतीय राजव्यवस्था संसदीय शासन प्रणाली पर कार्य करती है।' },
  },
  {
    id: 'caq-5',
    q: { en: 'Which of the following is the nodal agency for disaster management in India?', hi: 'भारत में आपदा प्रबंधन के लिए केंद्रीय संस्था कौनसी है?' },
    o: [
      { en: 'NDMA', hi: 'NDMA' },
      { en: 'NDRF', hi: 'NDRF' },
      { en: 'IMD', hi: 'IMD' },
      { en: 'CSIR', hi: 'CSIR' },
    ],
    a: 0,
    exp: { en: 'The National Disaster Management Authority (NDMA) is the nodal agency; NDRF is the responder.', hi: 'राष्ट्रीय आपदा प्रबंधन प्राधिकरण (NDMA) केंद्रीय संस्था है; NDRF प्रतिक्रियाकर्ता है।' },
  },
]

export function daysAgo(n) {
  return new Date(Date.now() - n * DAY)
}

export function caForDate(date = new Date()) {
  const key = date.toDateString()
  const seed = [...key].reduce((a, c) => a + c.charCodeAt(0), 0)
  return CA_ITEMS[seed % CA_ITEMS.length]
}
