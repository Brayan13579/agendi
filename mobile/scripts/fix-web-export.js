// Vercel ignora cualquier carpeta llamada "node_modules" al subir archivos estáticos,
// lo que rompe los assets de @expo/vector-icons (quedan en 404 -> iconos invisibles).
// Este script renombra esa carpeta dentro de dist/assets y actualiza las referencias
// en el bundle para que los archivos sí se suban y se sirvan correctamente.
const fs = require('fs')
const path = require('path')

const distDir = path.join(__dirname, '..', 'dist')
const oldDir = path.join(distDir, 'assets', 'node_modules')
const newDir = path.join(distDir, 'assets', 'vendor')
const oldRef = 'assets/node_modules'
const newRef = 'assets/vendor'

if (!fs.existsSync(oldDir)) {
  console.log('Nada que arreglar: no existe', oldDir)
  process.exit(0)
}

fs.cpSync(oldDir, newDir, { recursive: true })
fs.rmSync(oldDir, { recursive: true, force: true })
console.log(`Renombrado: ${oldDir} -> ${newDir}`)

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, callback)
    else callback(full)
  }
}

let filesPatched = 0
let totalReplacements = 0
walk(distDir, (file) => {
  if (!/\.(js|json)$/.test(file)) return
  const content = fs.readFileSync(file, 'utf-8')
  if (!content.includes(oldRef)) return
  const count = content.split(oldRef).length - 1
  fs.writeFileSync(file, content.split(oldRef).join(newRef))
  filesPatched++
  totalReplacements += count
  console.log(`Parcheado (${count}x): ${path.relative(distDir, file)}`)
})

console.log(`Listo. ${filesPatched} archivo(s) actualizados, ${totalReplacements} referencia(s) reemplazadas.`)

// Agrega flex-direction: column al #root para que React Native Web llene la pantalla completa
// en navegadores móviles (sin esto queda espacio blanco debajo del contenido).
// También fuerza el fondo oscuro en <body> para que no haya flash blanco mientras carga el JS.
const indexPath = path.join(distDir, 'index.html')
if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8')

  // 1. flex-direction: column en #root
  const withFlex = html.replace(
    /#root\s*\{([^}]*)\}/,
    (match, inner) => {
      if (inner.includes('flex-direction')) return match
      return `#root {${inner}  flex-direction: column;\n      }`
    }
  )

  // 2. Fondo oscuro en body/html para que no aparezca blanco mientras JS carga
  const BG = '#121110'
  const bgTag = `<style>html,body{background:${BG};margin:0;padding:0}</style>`
  const withBg = withFlex.includes(BG)
    ? withFlex
    : withFlex.replace('</head>', `${bgTag}</head>`)

  if (withBg !== html) {
    fs.writeFileSync(indexPath, withBg)
    console.log('Parcheado index.html: flex-direction + fondo oscuro')
  }
}
