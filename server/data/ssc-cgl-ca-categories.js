// These are editorial selection weights, NOT measured TCS/SSC frequencies.
// They can guide diversity until the operator supplies defensible frequency data.
export const CA_CATEGORIES = Object.freeze([
  {code:'Schemes',label:'Government Schemes',editorial_weight:5},
  {code:'Sports',label:'Sports and Tournaments',editorial_weight:4},
  {code:'Awards',label:'Padma, National and International Awards',editorial_weight:5},
  {code:'Appointments',label:'Appointments',editorial_weight:4},
  {code:'Military_Exercises',label:'Military Exercises',editorial_weight:4},
  {code:'Rankings_Indexes',label:'Rankings and Indexes',editorial_weight:4},
  {code:'Budget_Economy',label:'Union Budget and Economic Survey',editorial_weight:5},
  {code:'Science_Space',label:'Science, Space, ISRO and DRDO',editorial_weight:4},
])
export const CA_CATEGORY_CODES=CA_CATEGORIES.map(c=>c.code)
export const AWARD_GROUPS=['Padma','National','International','Other']
export const CA_EDITORIAL_WEIGHT_VERSION='ca-editorial-v1'
