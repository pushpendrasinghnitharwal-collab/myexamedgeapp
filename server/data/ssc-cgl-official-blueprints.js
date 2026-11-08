export const NOTICE_URL = 'https://ssc.gov.in/api/attachment/uploads/masterData/NoticeBoards/Notice_of_adv_cgl_2026.pdf'
export const MINIMUMS = { UR: 30, OBC_EWS: 25, Others: 20 }
const module = (code, name, subject, questions, marks, seconds, counts_for_merit) => ({
  code, name, subject, questions, marks, time_limit_seconds: seconds,
  navigation: 'subject_locked', counts_for_merit,
})

// SSC CGL 2026 notice paras 13.8–13.9 and 16.1. Standard durations; eligible
// candidates may receive compensatory time. These are minimum percentages,
// not final/category/post-specific computer cut-offs.
export const officialBlueprints = [
  {
    blueprint_key: 'ssc-cgl-2026-tier-1', blueprint_name: 'SSC CGL 2026 Tier I — full paper',
    category: 'Full_Tier1', exam_stage: 'Tier_1', notice_year: 2026, source_url: NOTICE_URL,
    total_questions: 100, total_marks: 200, duration_seconds: 3600,
    marking: { correct: 2, wrong: -0.5, unanswered: 0 },
    navigation: { free_section_switching: false, lock_scope: 'subject', note: '15 minutes per subject; standard duration.' },
    merit: { contributes_to_final_merit: false, screening_score_out_of: 200, merit_out_of: null },
    qualification: { minimum_percentages: MINIMUMS, applies_to: ['Tier_I'], note: 'Minimum only; shortlisting cut-offs may be higher.' },
    sessions: [{ code: 'Tier_I', name: 'Tier I', duration_seconds: 3600, sections: [
      { code: 'Part_A', name: 'General Intelligence and Reasoning', duration_seconds: 900, modules: [module('Part_A','General Intelligence and Reasoning','Reasoning',25,50,900,false)] },
      { code: 'Part_B', name: 'General Awareness', duration_seconds: 900, modules: [module('Part_B','General Awareness','General_Awareness',25,50,900,false)] },
      { code: 'Part_C', name: 'Quantitative Aptitude', duration_seconds: 900, modules: [module('Part_C','Quantitative Aptitude','Quant',25,50,900,false)] },
      { code: 'Part_D', name: 'English Comprehension', duration_seconds: 900, modules: [module('Part_D','English Comprehension','English',25,50,900,false)] },
    ] }],
    exclusions: ['Compensatory time for eligible candidates is not modelled in these standard timers.'],
  },
  {
    blueprint_key: 'ssc-cgl-2026-tier-2-paper-1', blueprint_name: 'SSC CGL 2026 Tier II Paper I — full paper',
    category: 'Full_Tier2', exam_stage: 'Tier_2', notice_year: 2026, source_url: NOTICE_URL,
    total_questions: 150, total_marks: 450, duration_seconds: 8100,
    totals_scope: 'Session I multiple-choice sections only', duration_scope: 'Session I multiple-choice sections', full_paper_i_active_duration_seconds: 9000,
    marking: { correct: 3, wrong: -1, unanswered: 0 },
    navigation: { free_section_switching: false, lock_scope: 'subject', note: 'Section I: 30+30 minutes; Section II: 40+20 minutes; Computer: 15 minutes.' },
    merit: { contributes_to_final_merit: true, merit_out_of: 390, qualifying_computer_marks: 60, note: 'Paper I merit component is Sections I and II only; additional post-specific papers may also apply.' },
    qualification: { minimum_percentages: MINIMUMS, applies_to: ['Section_I','Section_II','Section_III'], note: 'These are minimums, not final cut-offs. SSC may set higher computer standards for specified posts; qualification remains pending until applicable standards are known.' },
    sessions: [
      { code: 'Session_I', name: 'Session I', duration_seconds: 8100, sections: [
        { code: 'Section_I', name: 'Mathematical Abilities and Reasoning', duration_seconds: 3600, questions: 60, marks: 180, modules: [
          module('Section_I_A','Mathematical Abilities','Quant',30,90,1800,true),
          module('Section_I_B','Reasoning and General Intelligence','Reasoning',30,90,1800,true),
        ] },
        { code: 'Section_II', name: 'English and General Awareness', duration_seconds: 3600, questions: 70, marks: 210, modules: [
          module('Section_II_A','English Language and Comprehension','English',45,135,2400,true),
          module('Section_II_B','General Awareness','General_Awareness',25,75,1200,true),
        ] },
        { code: 'Section_III', name: 'Computer Knowledge Test', duration_seconds: 900, questions: 20, marks: 60, qualifying_only: true, modules: [
          module('Section_III','Computer Knowledge Test','Computer_Knowledge',20,60,900,false),
        ] },
      ] },
      { code: 'Session_II', name: 'Session II', duration_seconds: 900, sections: [{ code: 'Section_IV', name: 'Data Entry Speed Test (DEST)', duration_seconds: 900, qualifying_only: true, task_count: 1, supported_by_question_engine: false, note: 'Mandatory for posts subject to notice exemptions; higher post-specific standards may apply.', modules: [] }] },
    ],
    exclusions: ['Session-II DEST is recorded as qualifying metadata, not a multiple-choice mock.', 'Post-specific Papers II and III and compensatory-time rules are not modelled.', 'The full Paper I duration excludes the re-registration break between sessions.'],
  },
]
