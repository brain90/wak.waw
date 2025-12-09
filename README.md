# Wak.Waw
Semua bot yang beredar overkill. Sony hanya butuh daemon. yang :
* Bisa kirim ratusan pesan text / attachment per hari
* Mendukung simple Fault Tolerance
* Tidak terdeteksi sebagai spammer oleh w/a pusat

# Instalasi
* npm install 
* npm install pm2@latest -g
* pm2 start wa.js
* pm2 logs --timestamp

# Penggunaan
* Hit /qr via app. scan qr via perangkat 
* hit /sync . untuk menyalin semua nomor di phonebook ke db
* Kirim pesan :
  * insert pesan dengan status 0 ke tabel antrian. atau
  * hit /send endpoint. dgn param: {number: text, message: text}  
* status - 0: diantrikan, 1: terkirim, 2: error. 
* Pesan dalam antrian akan dikirim dengan interval random.
* Selengkapnya lihat direktori /examples

# Web Proxy
Agar bisa melayani pengiriman dari internet. Expose wak.waw via reverse proxy. Lihat `/examples/apache-proxy.conf` untuk konfig apache.
   
# Motivasi
Sony ingin broadcast ke 3000 lebih pelanggan. Namun semua bot beredar tidak ada yang memuaskan. Sony memutuskan membuat bot pribadi. Setelah jalan dan stabil. Sony Berpikir. Jika semua user base ada di telegram. Sony tidaklah perlu membuang waktu membuat bot ini. 

# Tribute
All Hail Junjungan Kami. 

<img width="400" height="300" alt="image" src="https://github.com/user-attachments/assets/65b5ce99-6f5f-4bb4-859a-b6b85555e8ff" />


