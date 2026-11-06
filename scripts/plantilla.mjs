// Genera public/plantilla-presupuesto-familiar-luka.xlsx (plantilla gratis de presupuesto familiar).
// Uso: node scripts/plantilla.mjs
import ExcelJS from 'exceljs'

const GREEN = 'FF037F3D'
const GREEN_LIGHT = 'FFE9F7EF'
const NAVY = 'FF0A3254'
const INPUT = 'FFFFF8E1' // celdas para llenar
const GRAY = 'FF64748B'
const COP = '"$" #,##0;[Red]-"$" #,##0'

const wb = new ExcelJS.Workbook()
wb.creator = 'Luka'
wb.title = 'Presupuesto familiar mensual'

// ---------------------------------------------------------------------
// Hoja 1: Presupuesto
// ---------------------------------------------------------------------
const ws = wb.addWorksheet('Presupuesto', { views: [{ showGridLines: false }], properties: { defaultRowHeight: 20 } })
ws.columns = [{ width: 3 }, { width: 38 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }, { width: 30 }]

const title = ws.getCell('B2')
title.value = 'Presupuesto familiar mensual'
title.font = { size: 20, bold: true, color: { argb: NAVY } }
const sub = ws.getCell('B3')
sub.value = 'Plantilla gratis de Luka · llena las celdas amarillas · holaluka.vercel.app'
sub.font = { size: 10, color: { argb: GRAY } }
ws.getCell('B4').value = 'Mes:'
ws.getCell('B4').font = { bold: true, color: { argb: NAVY } }
ws.getCell('C4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }

let r = 6
const header = (titleText, cols) => {
  const row = ws.getRow(r)
  row.getCell(2).value = titleText
  cols.forEach((c, i) => (row.getCell(3 + i).value = c))
  for (let c = 2; c <= 2 + cols.length; c++) {
    const cell = row.getCell(c)
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'center' }
  }
  row.height = 24
  r++
}
const input = (cell) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
  cell.numFmt = COP
  cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } }
}
const totalRow = (label, formulas) => {
  const row = ws.getRow(r)
  row.getCell(2).value = label
  formulas.forEach((f, i) => {
    if (!f) return
    const cell = row.getCell(3 + i)
    cell.value = { formula: f }
    cell.numFmt = COP
  })
  for (let c = 2; c <= 2 + formulas.length; c++) {
    row.getCell(c).font = { bold: true, color: { argb: NAVY } }
    row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } }
  }
  const at = r
  r += 2
  return at
}

// Ingresos
header('INGRESOS', ['Monto mensual', '', '', '', 'Notas'])
const incomeStart = r
for (const name of ['Salario 1', 'Salario 2', 'Arriendos o rentas', 'Trabajos extra / ventas', 'Otros ingresos']) {
  ws.getCell(`B${r}`).value = name
  input(ws.getCell(`C${r}`))
  r++
}
const incomeTotal = totalRow('Total ingresos', [`SUM(C${incomeStart}:C${r - 1})`])

// Gastos
header('GASTOS', ['Presupuesto', 'Gastado real', 'Diferencia', '% usado', 'Qué incluye'])
const expenseStart = r
const expenses = [
  ['Mercado', 'Supermercado, plaza, tienda'],
  ['Hogar', 'Arriendo o administración, aseo, reparaciones'],
  ['Servicios', 'Luz, agua, gas, internet, celulares'],
  ['Transporte', 'Gasolina, peajes, parqueadero, buses, taxis'],
  ['Salud', 'Medicina prepagada, droguería, citas'],
  ['Educación', 'Colegio, universidad, útiles, cursos'],
  ['Restaurantes y domicilios', 'Comidas fuera de casa, domicilios'],
  ['Entretenimiento', 'Salidas, planes, suscripciones (Netflix, Spotify)'],
  ['Ropa y cuidado personal', 'Ropa, zapatos, peluquería'],
  ['Mascotas', 'Comida, veterinario'],
  ['Seguros', 'Vida, hogar, vehículo, SOAT'],
  ['Otros gastos', 'Lo que no encaje arriba'],
]
for (const [name, note] of expenses) {
  ws.getCell(`B${r}`).value = name
  input(ws.getCell(`C${r}`))
  input(ws.getCell(`D${r}`))
  ws.getCell(`E${r}`).value = { formula: `C${r}-D${r}` }
  ws.getCell(`E${r}`).numFmt = COP
  ws.getCell(`F${r}`).value = { formula: `IF(C${r}>0,D${r}/C${r},"")` }
  ws.getCell(`F${r}`).numFmt = '0%'
  ws.getCell(`G${r}`).value = note
  ws.getCell(`G${r}`).font = { size: 9, color: { argb: GRAY } }
  r++
}
const expenseEnd = r - 1
const expenseTotal = totalRow('Total gastos', [`SUM(C${expenseStart}:C${expenseEnd})`, `SUM(D${expenseStart}:D${expenseEnd})`, `C${r}-D${r}`, `IF(C${r}>0,D${r}/C${r},"")`])
ws.getCell(`E${expenseTotal}`).value = { formula: `C${expenseTotal}-D${expenseTotal}` }
ws.getCell(`F${expenseTotal}`).value = { formula: `IF(C${expenseTotal}>0,D${expenseTotal}/C${expenseTotal},"")` }
ws.getCell(`F${expenseTotal}`).numFmt = '0%'
// Alerta visual: rojo si se pasaron, amarillo desde el 80 %
ws.addConditionalFormatting({
  ref: `F${expenseStart}:F${expenseEnd}`,
  rules: [
    { type: 'cellIs', operator: 'greaterThanOrEqual', formulae: ['1'], style: { font: { color: { argb: 'FFB91C1C' }, bold: true } }, priority: 1 },
    { type: 'cellIs', operator: 'between', formulae: ['0.8', '0.9999'], style: { font: { color: { argb: 'FFB45309' }, bold: true } }, priority: 2 },
  ],
})

// Deudas
header('DEUDAS', ['Cuota mensual', 'Saldo pendiente', 'Tasa E.A. %', 'Día de pago', 'Entidad'])
const debtStart = r
for (const name of ['Tarjeta de crédito', 'Crédito de vehículo', 'Crédito de vivienda / lote', 'Préstamo']) {
  ws.getCell(`B${r}`).value = name
  input(ws.getCell(`C${r}`))
  input(ws.getCell(`D${r}`))
  ws.getCell(`E${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
  ws.getCell(`F${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
  ws.getCell(`G${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
  r++
}
const debtTotal = totalRow('Total cuotas', [`SUM(C${debtStart}:C${r - 1})`, `SUM(D${debtStart}:D${r - 1})`])

// Resumen
header('RESUMEN DEL MES', ['Valor'])
const summary = [
  ['Ingresos', `C${incomeTotal}`],
  ['− Gastos presupuestados', `C${expenseTotal}`],
  ['− Cuotas de deudas', `C${debtTotal}`],
]
for (const [name, f] of summary) {
  ws.getCell(`B${r}`).value = name
  ws.getCell(`C${r}`).value = { formula: f }
  ws.getCell(`C${r}`).numFmt = COP
  r++
}
ws.getCell(`B${r}`).value = 'Queda para ahorro'
ws.getCell(`C${r}`).value = { formula: `C${incomeTotal}-C${expenseTotal}-C${debtTotal}` }
ws.getCell(`C${r}`).numFmt = COP
;['B', 'C'].forEach((c) => {
  ws.getCell(`${c}${r}`).font = { bold: true, size: 13, color: { argb: GREEN } }
  ws.getCell(`${c}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_LIGHT } }
})
r += 2
ws.getCell(`B${r}`).value = 'Referencia 50/30/20: 50 % necesidades · 30 % gustos · 20 % ahorro y deudas'
ws.getCell(`B${r}`).font = { italic: true, size: 9, color: { argb: GRAY } }
r += 2
const cta = ws.getCell(`B${r}`)
cta.value = { text: '👉 ¿Te da pereza llenar el «Gastado real»? Luka lo hace solo desde el chat: holaluka.vercel.app', hyperlink: 'https://holaluka.vercel.app/?src=plantilla' }
cta.font = { bold: true, color: { argb: GREEN }, underline: true }

ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 }

// ---------------------------------------------------------------------
// Hoja 2: Cómo usarla
// ---------------------------------------------------------------------
const help = wb.addWorksheet('Cómo usarla', { views: [{ showGridLines: false }] })
help.columns = [{ width: 3 }, { width: 100 }]
const lines = [
  ['Cómo usar esta plantilla', { size: 18, bold: true, color: { argb: NAVY } }],
  [''],
  ['1. Llena solo las celdas amarillas. Los totales y el resumen se calculan solos.'],
  ['2. Ingresos: lo que entra a la casa cada mes (salarios, arriendos, ventas).'],
  ['3. Gastos: cuánto planeas gastar en cada categoría. Cambia los nombres si quieres o borra las filas que no uses.'],
  ['4. «Gastado real»: lo que de verdad se gastó. El % se pone amarillo al 80 % y rojo al pasarse.'],
  ['5. Deudas: una fila por cada deuda, con su cuota, saldo y tasa (las ves en el extracto del banco).'],
  ['6. Resumen: ingresos − gastos − cuotas = lo que queda para ahorrar.'],
  [''],
  ['¿Quieres que se llene solo?', { size: 14, bold: true, color: { argb: GREEN } }],
  ['Con Luka mandas la foto del recibo al grupo de la familia en Telegram y el gasto se registra y se resta del presupuesto.'],
  ['Para pasar esta plantilla a Luka: crea tu cuenta gratis → Presupuesto → Importar desde Excel → sube este archivo.'],
  ['Luka reconoce las categorías, los ingresos y cada deuda, y te deja revisarlo antes de guardar.'],
  [''],
  ['holaluka.vercel.app · 30 días gratis, sin tarjeta', { bold: true, color: { argb: NAVY } }],
]
lines.forEach(([text, font], i) => {
  const cell = help.getCell(`B${i + 2}`)
  cell.value = text
  if (font) cell.font = font
  cell.alignment = { wrapText: true, vertical: 'top' }
})

await wb.xlsx.writeFile('public/plantilla-presupuesto-familiar-luka.xlsx')
console.log('Plantilla creada: public/plantilla-presupuesto-familiar-luka.xlsx')
