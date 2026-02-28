# SiMoner - Sistem Monitoring dan Reporting

SiMoner (Sistem Monitoring dan Reporting) adalah aplikasi web modern untuk monitoring dan reporting traffic jaringan berbasis Next.js. Aplikasi ini terintegrasi dengan sistem monitoring Mikrotik & PPPoE untuk menampilkan statistik interface jaringan secara real-time.

## 🚀 Fitur

- **Dashboard Interface**: Tampilan grid interface jaringan dengan status online/offline
- **Detail Interface**: Halaman detail untuk setiap interface dengan 4 jenis grafik (Daily, Weekly, Monthly, Yearly)
- **Real-time Monitoring**: Auto-refresh setiap 5 detik untuk halaman detail dan 10 detik untuk halaman utama
- **Status Online/Offline**: Indikator status real-time berdasarkan last update (threshold diatur di env)
- **Search Interface**: Pencarian interface di seluruh halaman dengan debouncing
- **Pagination**: Navigasi halaman yang responsif
- **Hover Tooltip**: Informasi cepat (status & last update) saat hover pada interface card
- **Responsive Design**: Desain yang optimal untuk desktop, tablet, dan mobile
- **Dark Mode**: Dukungan dark mode otomatis

## 🛠️ Teknologi

- **Framework**: Next.js 16.1.6
- **UI Library**: React 19.2.3
- **Styling**: Tailwind CSS 4
- **Language**: JavaScript (ES6+)

## 📋 Prerequisites

- Node.js 18+ 
- npm atau yarn

## 🔧 Instalasi

1. Clone repository:
```bash
git clone <repository-url>
cd SiMoner
```

2. Install dependencies:
```bash
npm install
```

3. Jalankan development server:
```bash
npm run dev
```

4. Buka browser di `http://localhost:3000`

## 🏗️ Struktur Project

```
SiMoner/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── interfaces/          # API untuk list interfaces
│   │   │   ├── interface/[name]/    # API untuk detail interface
│   │   │   └── search/              # API untuk search interfaces
│   │   ├── interface/[name]/        # Halaman detail interface
│   │   ├── page.js                  # Halaman utama (list interfaces)
│   │   ├── layout.js                # Root layout
│   │   └── globals.css              # Global styles
│   ├── components/
│   │   └── GraphImage.js            # Component untuk menampilkan grafik
│   └── lib/
│       └── utils.js                 # Utility functions (online/offline check)
├── package.json
└── README.md
``` 

## 📡 Integrasi Data

Aplikasi ini mengambil data dari:
- `http://103.184.xx.x:xxxx/graphs/` - Halaman utama list interfaces
- `http://103.184.xx.x:xxxx/graphs/iface/[name]/` - Detail interface dengan grafik GIF
- `http://103.184.xx.x:xxxx/graphs/ipage/[page]/` - Pagination interfaces

## 🎨 Fitur UI/UX

### Halaman Utama
- Grid layout responsif (2-7 kolom tergantung ukuran layar)
- Card interface dengan tinggi tetap (2 baris untuk nama)
- Hover tooltip menampilkan status dan last update
- Auto-refresh setiap 10 detik (silent, tanpa loading)
- Search dengan debouncing 300ms

### Halaman Detail Interface
- 4 grafik: Daily, Weekly, Monthly, Yearly
- Statistik lengkap: Max In/Out, Average In/Out, Current In/Out
- Status online/offline dengan indikator visual
- Auto-refresh setiap 5 detik
- Update waktu real-time setiap detik

## 🔄 Auto-Refresh

- **Halaman Utama**: Setiap 10 detik (background, tanpa loading spinner)
- **Halaman Detail**: Setiap 5 detik (background, tanpa loading spinner)
- Manual refresh selalu menampilkan loading spinner

## 📱 Responsive Breakpoints

- **Mobile**: 2 kolom grid
- **SM (640px)**: 3 kolom
- **MD (768px)**: 4 kolom
- **LG (1024px)**: 5 kolom
- **XL (1280px)**: 6 kolom
- **2XL (1536px)**: 7 kolom

## 🎯 Status Online/Offline

Interface dianggap **ONLINE** jika:
- Last update ≤ threshold dari waktu sekarang

Threshold diatur lewat env (`NEXT_PUBLIC_OFFLINE_THRESHOLD_SECONDS`, default 3600 detik). Bisa override per kategori: `NEXT_PUBLIC_OFFLINE_THRESHOLD_DESA_SECONDS`, `NEXT_PUBLIC_OFFLINE_THRESHOLD_OPD_SECONDS`, `NEXT_PUBLIC_OFFLINE_THRESHOLD_SYSTEM_SECONDS`.

Interface dianggap **OFFLINE** jika:
- Last update > threshold dari waktu sekarang
- Data tidak dapat diambil

## 📝 Scripts

```bash
# Development
npm run dev

# Build production
npm run build

# Start production
npm start

# Lint
npm run lint
```

## 👨‍💻 Developer

**By: NPMA**  
Website: [https://npma.my.id](https://npma.my.id)
GitHub: [https://github.com/npma7](https://github.com/npma7)

## 📄 License

Private project - All rights reserved

## 🔗 Links

- **Monitoring System**: Mikrotik & PPPoE
- **Developer**: [NPMA](https://npma.my.id)

---

**SiMoner** - Sistem Monitoring dan Reporting untuk Mikrotik & PPPoE
