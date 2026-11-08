import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {createServer} from 'vite'

// Render the real JSX through Vite's SSR transformer, without a browser or
// real learner/content data. Interactive behavior is covered by browser QA.
test('submitted review renders merit, minimum badges, safe placeholders and accessible solution tabs',async()=>{
  const vite=await createServer({server:{middlewareMode:true},appType:'custom',logLevel:'silent'})
  try{
    const {default:CglReview}=await vite.ssrLoadModule('/src/pages/CglReview.jsx')
    const bucket={questions:0,tracked_questions:0,total_seconds:null,average_seconds:null}
    const assessment=(status,minimum_marks)=>({status,minimum_marks})
    const section=(score,max_score)=>({score,max_score,assessments:{UR:assessment('Not_Qualified',max_score*.3)}})
    const analytics={merit:{score:117,max_score:390,section_i:section(54,180),section_ii:section(63,210)},
      computer:{score:18,max_score:60,assessments:{UR:assessment('Qualified',18)}},
      timing:{by_outcome:{correct:bucket,wrong:bucket,skipped:bucket},time_traps:[]},screening:null}
    const data={mock:{id:'1',title:'Fictional practice',exam_stage:'Tier_2',category:'Full_Tier2'},summary:{score:135,max_score:450,correct:6,wrong:0,skipped:144},analytics,
      results:[{position:1,subject:'Quant',question_text_en:'Fictional question?',options:[{en:'One'},{en:'Two'}],selected_option_index:0,
        correct_option_index:0,is_correct:true,solution_basic:'Fictional concept',solution_trick:'Fictional shortcut'}]}
    const render=()=>renderToStaticMarkup(React.createElement(CglReview,{data,scope:'fictional-account',lang:'en',onLanguage:()=>{}}))
    let html=render()
    assert.match(html,/117\s*<span>\/ 390/);assert.match(html,/QUALIFIED IN COMPUTER/);assert.match(html,/UR minimum: 18 \/ 60/)
    assert.match(html,/role="tablist"/);assert.match(html,/Basic Concept/);assert.match(html,/20-Sec Exam Trick/)
    assert.match(html,/aria-selected="true"/);assert.match(html,/Fictional concept/);assert.match(html,/Ask AI Mentor/);assert.match(html,/Mains Typing Test/)
    analytics.computer.score=17;analytics.computer.assessments.UR=assessment('Not_Qualified',18)
    assert.match(render(),/DISQUALIFIED IN COMPUTER/)
    analytics.computer.assessments.UR=assessment('Not_Assessed',18)
    assert.match(render(),/COMPUTER NOT ASSESSED/)
    data.results=[{position:1,content_withdrawn:true,question_text_en:'PRIVATE WITHDRAWN TEXT',solution_basic:'PRIVATE SOLUTION'}]
    html=render();assert.match(html,/content was withdrawn/);assert.doesNotMatch(html,/PRIVATE WITHDRAWN TEXT|PRIVATE SOLUTION/);assert.match(html,/disabled=""[^>]*><svg[^>]*.*?Ask AI Mentor/)
    data.results=[{position:1,not_delivered:true,question_text_en:'UNDELIVERED TEXT'}]
    html=render();assert.match(html,/not delivered before submission/);assert.doesNotMatch(html,/UNDELIVERED TEXT/)
    data.results=[{position:1,subject:'Quant',answer_status:'Void',selected_option_index:0,question_text_en:'Void question',options:[{en:'One'}]}]
    html=render();assert.match(html,/Void/);assert.match(html,/Your answer/);assert.doesNotMatch(html,/cc-option[^"\n]*is-wrong/)
    data.mock.exam_stage='Tier_1';data.summary={score:1.5,max_score:200,correct:1,wrong:1,skipped:98}
    data.analytics={merit:null,computer:null,screening:{score:1.5,max_score:200,delivered:true,content_available:true,minimums:{UR:60}},
      subject_scores:[{subject:'Quant',score:1.5,max_score:50}],timing:analytics.timing,notice_url:'https://example.invalid/notice',
      projection:{normalization_notice_url:'https://example.invalid/method'}}
    data.results=[{position:1,subject:'Quant',question_text_en:'English fixture?',question_text_hi:'काल्पनिक प्रश्न?',options:[],solution_basic:'English foundation',solution_basic_hi:'हिन्दी समाधान'}]
    html=render();assert.match(html,/personal practice target/);assert.match(html,/ESTIMATED PERCENTILE/);assert.match(html,/not SSC results or predictions/)
    assert.match(html,/English foundation/);assert.doesNotMatch(html,/हिन्दी समाधान/)
    const hindi=renderToStaticMarkup(React.createElement(CglReview,{data,scope:'fictional-account',lang:'hi',onLanguage:()=>{}}))
    assert.match(hindi,/हिन्दी समाधान/);assert.doesNotMatch(hindi,/English foundation/)
  }finally{await vite.close()}
})
