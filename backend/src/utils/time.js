// El servidor corre en UTC pero los `datetime` se guardan con la hora de
// Bogotá representada como si fuera UTC (ej: "3:00 pm" -> ...T15:00:00.000Z).
// Esta función devuelve el "ahora" en esa misma convención, para poder
// comparar correctamente contra los `datetime` guardados.
const BOGOTA_OFFSET_HOURS = 5

function labelNow() {
  return new Date(Date.now() - BOGOTA_OFFSET_HOURS * 60 * 60 * 1000)
}

module.exports = { labelNow }
