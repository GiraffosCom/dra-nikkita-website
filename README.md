# Dra Nikkita - Sitio Web

Sitio web oficial de Dra Nikkita - Clínica e Instituto de Armonización Facial.

## 🌐 URLs

- **Sitio principal:** https://dranikkita.com
- **Linktree:** https://dranikkita.com/links

## 📁 Estructura

```
dra-nikkita-website/
├── public/
│   ├── index.html      # Landing page principal
│   └── links.html      # Página tipo Linktree
├── package.json
├── vercel.json         # Configuración de Vercel
└── README.md
```

## 🚀 Deploy en Vercel (Paso a Paso)

### Opción A: Deploy directo (más fácil)

1. **Ir a [vercel.com](https://vercel.com)** y crear cuenta con GitHub

2. **Subir el proyecto:**
   - Click en "Add New Project"
   - Seleccionar "Import Git Repository"
   - Si no tienes repo, usa "Import Third-Party Git Repository" o sube manualmente

3. **Configurar:**
   - Framework Preset: `Other`
   - Root Directory: `./`
   - Build Command: (dejar vacío)
   - Output Directory: `public`

4. **Deploy!**

### Opción B: Con GitHub (recomendado)

1. **Crear repositorio en GitHub:**
   ```bash
   # En tu computador local
   git init
   git add .
   git commit -m "Initial commit - Dra Nikkita website"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/dra-nikkita-website.git
   git push -u origin main
   ```

2. **Conectar con Vercel:**
   - Ir a [vercel.com/new](https://vercel.com/new)
   - Importar el repositorio de GitHub
   - Click en "Deploy"

3. **Cada vez que hagas push a GitHub, Vercel actualizará automáticamente**

## 🔗 Configurar Dominio (dranikkita.com)

### En Vercel:
1. Ir a tu proyecto en Vercel
2. Settings → Domains
3. Agregar `dranikkita.com`
4. Vercel te dará los DNS records

### En tu proveedor de dominio:
Agregar estos registros DNS:

| Tipo | Nombre | Valor |
|------|--------|-------|
| A | @ | 76.76.19.19 |
| CNAME | www | cname.vercel-dns.com |

⏱️ **Propagación:** 5-30 minutos (puede tardar hasta 48h)

## 🛠️ Desarrollo Local

```bash
# Instalar dependencias (opcional, solo para servidor local)
npm install

# Correr servidor local
npm run dev
# o simplemente abrir public/index.html en el navegador
```

## 📱 Páginas

### Landing Page (index.html)
- Hero con propuesta de valor
- Servicios para pacientes
- Servicios para médicos (cursos/pasantías)
- Proceso de transformación
- Bot Fullface (pre-evaluación)
- Testimonios
- Sucursales (Vitacura, Ñuñoa, Providencia, Melipilla)
- CTA y contacto

### Linktree (links.html)
- Perfil con redes sociales
- Reserva tu hora
- WhatsApp
- Grid de servicios
- Sucursales
- Link para profesionales

## 📞 Contacto

- **Web:** dranikkita.com
- **WhatsApp:** +56 9 1234 5678
- **Email:** contacto@dranikkita.com
- **Instagram:** @dranikkita.cl

---

© 2025 Dra Nikkita. Todos los derechos reservados.
