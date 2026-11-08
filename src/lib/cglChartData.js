// Convert common DI formats into tables without guessing scales or changing
// values. Unknown structures remain available through the generic renderer.
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const primitive = value => value === null || ['string','number','boolean'].includes(typeof value)
export const localizedCell = value => record(value) && Object.keys(value).length > 0 && Object.keys(value).every(key => ['en','hi'].includes(key)) && Object.values(value).every(v => typeof v === 'string')
const cell = value => primitive(value) || localizedCell(value)
export function displayCell(value, lang = 'en') {
  if (localizedCell(value)) return value[lang] ?? value.en ?? value.hi ?? ''
  return value == null ? '—' : String(value)
}
const rest = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)))

export function chartTable(data) {
  if (Array.isArray(data)) {
    if (!data.length) return null
    if (data.every(row => record(row) && Object.values(row).every(cell))) {
      const columns = [...new Set(data.flatMap(row => Object.keys(row)))]
      if (!columns.length) return null
      return { columns, rows: data.map(row => columns.map(key => row[key] ?? null)), extra: null }
    }
    if (data.every(row => Array.isArray(row) && row.every(cell))) {
      return { columns: null, rows: data, extra: null }
    }
    return null
  }
  if (!record(data)) return null
  const headersKey = Array.isArray(data.headers) ? 'headers' : Array.isArray(data.columns) ? 'columns' : null
  if (headersKey && data[headersKey].every(cell) && Array.isArray(data.rows) && data.rows.every(row => Array.isArray(row) && row.every(cell))) {
    return { columns: data[headersKey], rows: data.rows, extra: rest(data, [headersKey,'rows']) }
  }
  if (Array.isArray(data.labels) && data.labels.every(cell) && Array.isArray(data.datasets) && data.datasets.length && data.datasets.every(series => record(series) && (series.label == null || cell(series.label)) && Array.isArray(series.data) && series.data.length === data.labels.length && series.data.every(cell))) {
    const seriesExtras = data.datasets.map(series => rest(series, ['label','data']))
    const extra = rest(data, ['labels','datasets'])
    if (seriesExtras.some(item => Object.keys(item).length)) extra.series_details = seriesExtras
    return {
      columns: ['Category', ...data.datasets.map((series,index) => series.label ?? `Series ${index+1}`)],
      rows: data.labels.map((label,index) => [label, ...data.datasets.map(series => series.data[index])]),
      extra,
    }
  }
  return null
}
