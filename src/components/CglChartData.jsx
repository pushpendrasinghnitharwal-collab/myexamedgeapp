import React from 'react'
import {chartTable,displayCell,localizedCell} from '../lib/cglChartData'
import './cgl-chart-data.css'

const fieldName = value => String(value).replaceAll('_',' ')
function DataTree({value,lang}) {
  if (value === null || typeof value !== 'object' || localizedCell(value)) return <span>{displayCell(value,lang)}</span>
  if (Array.isArray(value)) return value.length ? <ol>{value.map((item,index)=><li key={index}><DataTree value={item} lang={lang}/></li>)}</ol> : <span>—</span>
  const entries=Object.entries(value)
  return entries.length ? <dl>{entries.map(([key,item])=><div key={key}><dt>{fieldName(key)}</dt><dd><DataTree value={item} lang={lang}/></dd></div>)}</dl> : <span>—</span>
}

export default function CglChartData({data,lang='en'}) {
  const table=chartTable(data),extra=table?.extra && Object.keys(table.extra).length ? table.extra : null
  return <section className="cgl-data-display" aria-label="Data provided">
    <strong>Data provided</strong>
    {table ? <><div className="cgl-data-table-scroll"><table>
      {table.columns && <thead><tr>{table.columns.map((column,index)=><th key={index} scope="col">{displayCell(column,lang)}</th>)}</tr></thead>}
      <tbody>{table.rows.map((row,index)=><tr key={index}>{row.map((value,cellIndex)=><td key={cellIndex}>{displayCell(value,lang)}</td>)}</tr>)}</tbody>
    </table></div>{extra && <div className="cgl-data-extra"><DataTree value={extra} lang={lang}/></div>}</> : <DataTree value={data} lang={lang}/>}
  </section>
}
