import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  collection, 
  addDoc, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  increment, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  deleteDoc, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';
import { Html5Qrcode } from 'html5-qrcode';

// --- CONFIG FIREBASE ASLI MILIK VICKY ---
const firebaseConfig = {
  apiKey: "AIzaSyBq9lMekzm_aq-2Buvub7E7f7dx1V5kTiA",
  authDomain: "kasir-pintar-93e03.firebaseapp.com",
  projectId: "kasir-pintar-93e03",
  storageBucket: "kasir-pintar-93e03.appspot.com",
  messagingSenderId: "166529415845",
  appId: "1:166529415845:web:1a876202c5de0fb6b62b4c",
  measurementId: "G-P0PNQ3B54B"
};

const app = initializeApp(firebaseConfig);

const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);

// === MESIN SUARA GLOBAL (SINGLETON) AGAR TIDAK DIBLOKIR BROWSER SAAT KLIK CEPAT ===
let globalAudioCtx = null;

function App() {
  // === STATE AUTENTIKASI ===
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  // === STATE GLOBAL ===
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [showOfflineWarning, setShowOfflineWarning] = useState(!window.navigator.onLine);

  // === STATE FITUR BARU (BACKGROUND & SUARA LOKAL) ===
  const [bgLogin, setBgLogin] = useState(() => localStorage.getItem('pos_bgLogin') || '');
  
  const [soundBeep, setSoundBeep] = useState(() => {
    const saved = localStorage.getItem('pos_soundBeep');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [soundVoice, setSoundVoice] = useState(() => {
    const saved = localStorage.getItem('pos_soundVoice');
    return saved !== null ? JSON.parse(saved) : true;
  });

  // Simpan setingan suara ke local storage tiap kali diubah
  useEffect(() => { 
    localStorage.setItem('pos_soundBeep', JSON.stringify(soundBeep)); 
  }, [soundBeep]);
  
  useEffect(() => { 
    localStorage.setItem('pos_soundVoice', JSON.stringify(soundVoice)); 
  }, [soundVoice]);

  // === STATE DATABASE UTAMA ===
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [pengeluaran, setPengeluaran] = useState([]); 
  
  // === STATE KERANJANG KASIR ===
  const [cart, setCart] = useState(() => {
    try { 
      const saved = localStorage.getItem('kasirCart'); 
      return saved ? JSON.parse(saved) : []; 
    } catch(e) { 
      return []; 
    }
  });
  
  const [search, setSearch] = useState('');
  const [searchProduk, setSearchProduk] = useState(''); 
  const [searchPengeluaran, setSearchPengeluaran] = useState('');
  const [searchLaporan, setSearchLaporan] = useState(''); 
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // === STATE LAPORAN & BON ===
  const [laporanTab, setLaporanTab] = useState('transaksi'); 
  const [showBonModal, setShowBonModal] = useState(false);
  const [namaPelangganBon, setNamaPelangganBon] = useState('');

  // === STATE RESET DATA TAHUNAN ===
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedYearReset, setSelectedYearReset] = useState('2025');

  // === STATE INPUT KASIR & KAMERA ===
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [metodePembayaran, setMetodePembayaran] = useState('Tunai'); 
  const [isScanningKasir, setIsScanningKasir] = useState(false);
  const [isScanningToko, setIsScanningToko] = useState(false);
  
  // === STATE MODAL ===
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showQrisModal, setShowQrisModal] = useState(false);
  
  // === STATE PRINT ===
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);

  // === STATE PROFIL TOKO ===
  const [namaToko, setNamaToko] = useState('');
  const [alamat, setAlamat] = useState('');
  const [noTelp, setNoTelp] = useState('');
  const [qrisImage, setQrisImage] = useState(''); 
  const [pesanStruk, setPesanStruk] = useState('*** TERIMA KASIH ***'); 

  // === STATE UKURAN LABEL KUSTOM ===
  const [labelWidth, setLabelWidth] = useState(185);
  const [labelHeight, setLabelHeight] = useState(95);
  const [labelScale, setLabelScale] = useState(100);
  const [labelGap, setLabelGap] = useState(5);
  const [labelCols, setLabelColumns] = useState(4);
  
  // === STATE FORM PRODUK ===
  const [namaProd, setNamaProd] = useState('');
  const [hargaProd, setHargaProd] = useState('');
  const [hargaPromoProd, setHargaPromoProd] = useState('');
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [satuanProd, setSatuanProd] = useState('Pcs'); 
  const [editingProductId, setEditingProductId] = useState(null);

  // === STATE SORTIR & CETAK PILIHAN ===
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('terbaru');

  // === STATE CHART / GRAFIK ===
  const [chartVisualType, setChartVisualType] = useState('bar');
  const [chartFilter, setChartFilter] = useState('hari'); 
  const [reportFilter, setReportFilter] = useState('hari');

  const [namaPengeluaran, setNamaPengeluaran] = useState('');
  const [nominalPengeluaran, setNominalPengeluaran] = useState('');

  // === STATE DASHBOARD & VARIABEL LABA BERSIH ===
  const [dashboardStats, setDashboardStats] = useState({ 
    todaySales: 0, 
    totalProducts: 0, 
    lowStock: 0, 
    totalPengeluaran: 0, 
    labaBersih: 0 
  });
  
  const isProfit = dashboardStats.labaBersih >= 0;

  // REF PENGAMAN AGAR KAMERA TIDAK LOAD BERULANG
  const produkRef = useRef(produk);
  useEffect(() => { 
    produkRef.current = produk; 
  }, [produk]);

  // --- HELPER SUARA KERANJANG (Ckring/Blip-Ting Tempo Standar) MENGGUNAKAN SINGLETON ---
  const playBeep = () => {
    if (!soundBeep) return;
    try {
      if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      
      const currentTime = globalAudioCtx.currentTime;

      // Nada Pertama (Blip)
      const osc1 = globalAudioCtx.createOscillator();
      const gain1 = globalAudioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(globalAudioCtx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(1000, currentTime);
      gain1.gain.setValueAtTime(0.1, currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.1);
      osc1.start(currentTime);
      osc1.stop(currentTime + 0.1);

      // Nada Kedua (Ting - lebih tinggi & renyah)
      const osc2 = globalAudioCtx.createOscillator();
      const gain2 = globalAudioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(globalAudioCtx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1500, currentTime + 0.15); // Jeda tempo pas
      gain2.gain.setValueAtTime(0.1, currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.3);
      osc2.start(currentTime + 0.15);
      osc2.stop(currentTime + 0.3);
    } catch(e) { 
      console.log("Audio Context Error:", e); 
    }
  };

  // PENGATURAN JAM OTOMATIS & SENSOR KONEKSI
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setShowOfflineWarning(!navigator.onLine);

    const goOnline = () => {
      setIsOnline(true);
      setShowOfflineWarning(false);
    };
    
    const goOffline = () => {
      setIsOnline(false);
      setShowOfflineWarning(true); 
    };
    
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, []);

  // === SENSOR CERDAS CETAK STRUK & ROBOT SUARA (KHUSUS HP vs LAPTOP) ===
  useEffect(() => {
    if (strukData) {
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const textToSpeak = pesanStruk || 'Terima kasih';

      // 1. Eksekusi Suara (Jika tombol nyala)
      if (soundVoice) {
        try {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }
          const msg = new SpeechSynthesisUtterance(textToSpeak);
          msg.lang = 'id-ID'; 
          msg.rate = 1.0;     
          window.speechSynthesis.speak(msg);
        } catch(e) { 
          console.log("Speech Synthesis Error:", e); 
        }
      }

      // 2. Trik Jitu Layar Print (Dinamis untuk HP vs Statis untuk Laptop/Tanpa Suara)
      if (isMobile && soundVoice) {
        // HP + Suara Nyala: Hitung delay berdasarkan jumlah huruf (Minimal 1,5 detik)
        // Kecepatan ngomong rata-rata robot id-ID = ~100 milidetik per huruf
        const dynamicDelay = Math.max(textToSpeak.length * 100, 1500); 
        setTimeout(() => { window.print(); }, dynamicDelay);
      } else {
        // Laptop ATAU (HP tapi Suara Dimatikan): Tampil cepat (0,8 detik)
        setTimeout(() => { window.print(); }, 800);
      }
    }
  }, [strukData]); 
  // Perhatian: Dependensi [strukData] saja sudah cukup agar tidak terpanggil 2 kali.

  // === SENSOR KEYBOARD KHUSUS STRUK (ENTER / ESC) ===
  useEffect(() => {
    const handleStrukKeys = (e) => {
      if (strukData) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setStrukData(null); 
        } else if (e.key === 'Enter') {
          e.preventDefault();
          window.print(); 
        }
      }
    };
    
    window.addEventListener('keydown', handleStrukKeys);
    return () => window.removeEventListener('keydown', handleStrukKeys);
  }, [strukData]);

  // === NAVIGASI KEYBOARD PINTAR (SPATIAL NAVIGATION) ===
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT' || activeElement.tagName === 'TEXTAREA');

      if (isInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return; 

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if(e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault();

        const focusableElements = Array.from(document.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]'))
          .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);
        
        const currentIndex = focusableElements.indexOf(activeElement);
        if (currentIndex === -1) return;

        let nextElement = null;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          let nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
          if (nextIndex >= 0 && nextIndex < focusableElements.length) {
            nextElement = focusableElements[nextIndex];
          }
        } 
        else {
          const activeRect = activeElement.getBoundingClientRect();
          let bestDistance = Infinity;

          focusableElements.forEach(el => {
            if (el === activeElement) return;
            const rect = el.getBoundingClientRect();

            let isValidDirection = false;
            if (e.key === 'ArrowDown' && rect.top >= activeRect.bottom - 5) {
              isValidDirection = true;
            }
            if (e.key === 'ArrowUp' && rect.bottom <= activeRect.top + 5) {
              isValidDirection = true;
            }

            if (isValidDirection) {
              const xDist = Math.abs((rect.left + rect.width / 2) - (activeRect.left + activeRect.width / 2));
              const yDist = Math.abs((rect.top + rect.height / 2) - (activeRect.top + activeRect.height / 2));
              
              const distance = (xDist * 10) + yDist; 

              if (distance < bestDistance) {
                bestDistance = distance;
                nextElement = el;
              }
            }
          });
        }
        
        if (nextElement) {
          nextElement.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).then(() => {
      onAuthStateChanged(auth, (u) => { 
        setUser(u); 
        setLoading(false); 
      });
    });
  }, []);

  useEffect(() => { 
    localStorage.setItem('kasirCart', JSON.stringify(cart)); 
  }, [cart]);

  // LOGIKA PULL DATA FIREBASE
  useEffect(() => {
    if (!user) return;
    
    getDoc(doc(db, "profilToko", user.uid)).then(d => {
      if(d.exists()) { 
        setNamaToko(d.data().nama || ''); 
        setAlamat(d.data().alamat || ''); 
        setNoTelp(d.data().noTelp || ''); 
        setQrisImage(d.data().qrisImage || '');
        setPesanStruk(d.data().pesanStruk || '*** TERIMA KASIH ***'); 
        setLabelWidth(d.data().labelWidth || 185); 
        setLabelHeight(d.data().labelHeight || 95);
        setLabelScale(d.data().labelScale || 100); 
        setLabelGap(d.data().labelGap || 5);
        setLabelColumns(d.data().labelCols || 4);
      }
    });

    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTrans = query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubTrans = onSnapshot(qTrans, 
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const timeA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const timeB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return timeB - timeA;
        });
        setTransaksi(data);
      },
      (error) => {
        console.error("ERROR INDEX TRANSAKSI: ", error.message);
      }
    );

    const qPeng = query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubPengeluaran = onSnapshot(qPeng, 
      (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const timeA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const timeB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return timeB - timeA;
        });
        setPengeluaran(data);
      },
      (error) => {
        console.error("ERROR INDEX PENGELUARAN: ", error.message);
      }
    );

    return () => { 
      unsubProduk(); 
      unsubTrans(); 
      unsubPengeluaran(); 
    };
  }, [user]);

  // EFFECT: HITUNG STATISTIK DASHBOARD
  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    
    const todayTrans = transaksi.filter(t => 
      t.waktu && t.waktu.toDate && t.waktu.toDate().toISOString().split('T')[0] === today
    );
    
    const todayPeng = pengeluaran.filter(p => 
      p.waktu && p.waktu.toDate && p.waktu.toDate().toISOString().split('T')[0] === today
    );
    
    const omzetHariIni = todayTrans.filter(t => t.metode !== 'Bon' || t.statusBon === 'Lunas').reduce((sum, t) => sum + t.total, 0);
    const pengeluaranHariIni = todayPeng.reduce((sum, p) => sum + p.nominal, 0);

    setDashboardStats({
      totalProducts: produk.length,
      lowStock: produk.filter(p => p.stok < 50).length,
      todaySales: omzetHariIni,
      totalPengeluaran: pengeluaranHariIni,
      labaBersih: omzetHariIni - pengeluaranHariIni
    });
  }, [produk, transaksi, pengeluaran, user]);

  const addToCartRef = useRef();
  useEffect(() => { 
    addToCartRef.current = addToCart; 
  }, [cart]);

  // --- FUNGSI KAMERA (MODE AMAN ANTI BLANK) ---
  useEffect(() => {
    let html5QrCode;
    let isComponentMounted = true; 
    
    const startScanner = async () => {
      const scannerId = isScanningKasir ? "reader-kasir" : (isScanningToko ? "reader-toko" : null);
      if (!scannerId) return;

      html5QrCode = new Html5Qrcode(scannerId);
      try {
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isScanningKasir) {
              const found = produkRef.current.find(p => p.barcode === decodedText);
              if (found) { 
                addToCartRef.current(found); 
                setIsScanningKasir(false); 
              } else { 
                alert('❌ Barcode tidak terdaftar di database!'); 
                setIsScanningKasir(false); 
              }
            } else { 
              setBarcodeProd(decodedText); 
              setIsScanningToko(false); 
            }
          }, 
          undefined // Ignore warnings
        );
      } catch (err) {
        if (isComponentMounted) {
          console.error("Kamera Error:", err);
        }
      }
    };

    if (isScanningKasir || isScanningToko) {
      startScanner();
    }

    return () => {
      isComponentMounted = false;
      if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
          html5QrCode.clear();
        }).catch(console.error);
      }
    };
  }, [isScanningKasir, isScanningToko]);

  // --- MENU UPLOAD GAMBAR BACKGROUND (Maks 1MB) ---
  const handleBgUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1000000) {
        alert("❌ Upload Gagal! Ukuran gambar terlalu besar. Maksimal 1 MB.");
        e.target.value = ''; 
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => { 
        setBgLogin(reader.result); 
        localStorage.setItem('pos_bgLogin', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- MENU UPLOAD GAMBAR QRIS ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { 
        setQrisImage(reader.result); 
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try { 
      setLoading(true); 
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password); 
      } else {
        await signInWithEmailAndPassword(auth, email, password); 
      }
    } catch (error) { 
      alert('Gagal: ' + error.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleManualScan = (e) => {
    e.preventDefault();
    const found = produk.find(p => p.barcode === barcodeInput || p.barcode === String(barcodeInput));
    if (found) { 
      addToCart(found); 
      setBarcodeInput(''); 
    } else { 
      alert('Barcode tidak ditemukan!'); 
      setBarcodeInput(''); 
    }
  };

  const addToCart = (p) => {
    if (p.stok <= 0) return alert("Stok habis!");
    
    const hargaAktif = p.hargaPromo ? Number(p.hargaPromo) : Number(p.harga);
    
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if(existing.qty >= p.stok) { 
          alert("Stok tidak mencukupi!"); 
          return prev; 
        }
        playBeep(); // Panggil efek suara beep
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      playBeep(); // Panggil efek suara beep
      return [...prev, { ...p, harga: hargaAktif, hargaAsli: p.harga, qty: 1 }];
    });
  };

  const updateQuantity = (id, newQty) => {
    if (newQty <= 0) { 
      setCart(prev => prev.filter(item => item.id !== id)); 
      return; 
    }
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if(newQty > item.stok) { 
          alert(`Stok sisa ${item.stok}!`); 
          return { ...item, qty: item.stok }; 
        }
        return { ...item, qty: newQty };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  const kembalian = (metodePembayaran === 'Tunai' && paymentAmount !== '') ? Number(paymentAmount) - totalAmount : 0;

  const processPayment = () => {
    if (cart.length === 0) return alert('Keranjang kosong!');
    if (metodePembayaran === 'Tunai' && Number(paymentAmount) < totalAmount) return alert('Uang bayar kurang!');
    
    if (metodePembayaran === 'Bon') {
      setShowBonModal(true); 
    } else {
      finalizePayment(metodePembayaran); 
    }
  };

  const finalizePayment = (metode) => {
    const finalUangBayar = metode === 'Tunai' ? Number(paymentAmount) : totalAmount;
    
    const dataTrans = {
      userId: user.uid, 
      items: cart.map(i => ({
        nama: i.nama, 
        harga: i.harga, 
        hargaAsli: i.hargaAsli, 
        qty: i.qty, 
        satuan: i.satuan || 'Pcs'
      })),
      total: totalAmount, 
      uangBayar: finalUangBayar, 
      kembalian: kembalian, 
      metode: metode, 
      waktu: new Date() 
    };

    if (metode === 'Bon') {
      if (!namaPelangganBon.trim()) return alert("Nama pelanggan wajib diisi!");
      dataTrans.namaPelanggan = namaPelangganBon;
      dataTrans.statusBon = 'Belum Lunas';
    }

    try {
      addDoc(collection(db, "transaksi"), dataTrans);
      
      for (const item of cart) { 
        updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); 
      }
      
      // Memicu layar struk (dan suara di dalam useEffect)
      setStrukData(dataTrans); 
      
      setCart([]); 
      setPaymentAmount(''); 
      setMetodePembayaran('Tunai'); 
      setShowQrisModal(false); 
      setShowBonModal(false); 
      setNamaPelangganBon('');
    } catch (err) { 
      alert("Gagal memproses transaksi"); 
    }
  };

  const simpanProduk = (e) => {
    e.preventDefault();
    const promoVal = hargaPromoProd ? Number(hargaPromoProd) : null;
    
    if (editingProductId) {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "" && p.id !== editingProductId);
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      
      updateDoc(doc(db, "produk", editingProductId), { 
        nama: namaProd, 
        harga: Number(hargaProd), 
        hargaPromo: promoVal, 
        stok: Number(stokProd), 
        barcode: barcodeProd, 
        satuan: satuanProd 
      });
      setEditingProductId(null);
    } else {
      let bcode = barcodeProd;
      
      if (!bcode) {
        let isUnique = false;
        let attempt = 0;
        
        while (!isUnique && attempt < 100) {
          let tempCode = '';
          for (let i = 0; i < 3; i++) {
            const num = Math.floor(Math.random() * 10).toString();
            tempCode += num + num; 
          }
          
          const checkExists = produk.find(p => p.barcode === tempCode);
          if (!checkExists) {
            bcode = tempCode;
            isUnique = true;
          }
          attempt++;
        }
        if (!bcode) bcode = Math.floor(100000000000 + Math.random() * 900000000000).toString(); 
      } else {
        const checkDuplicate = produk.find(p => p.barcode === bcode);
        if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      }
      
      addDoc(collection(db, "produk"), { 
        nama: namaProd, 
        harga: Number(hargaProd), 
        hargaPromo: promoVal, 
        stok: Number(stokProd), 
        barcode: bcode, 
        satuan: satuanProd, 
        userId: user.uid, 
        createdAt: new Date() 
      });
    }
    
    setNamaProd(''); 
    setHargaProd(''); 
    setHargaPromoProd(''); 
    setStokProd(''); 
    setBarcodeProd(''); 
    setSatuanProd('Pcs');
  };

  const simpanPengeluaran = (e) => {
    e.preventDefault();
    addDoc(collection(db, "pengeluaran"), { 
      nama: namaPengeluaran, 
      nominal: Number(nominalPengeluaran), 
      userId: user.uid, 
      waktu: new Date() 
    });
    setNamaPengeluaran(''); 
    setNominalPengeluaran(''); 
  };

  const simpanProfil = () => {
    setDoc(doc(db, "profilToko", user.uid), { 
      nama: namaToko, 
      alamat, 
      noTelp, 
      qrisImage, 
      pesanStruk: pesanStruk || '*** TERIMA KASIH ***', 
      labelWidth: Number(labelWidth), 
      labelHeight: Number(labelHeight),
      labelScale: Number(labelScale), 
      labelGap: Number(labelGap), 
      labelCols: Number(labelCols)
    });
    alert("Profil & Pengaturan Toko Tersimpan!"); 
    setShowProfileModal(false);
  };

  const handleResetTahunan = async () => {
    if (!window.confirm(`⚠️ PERINGATAN TERAKHIR: Apakah Anda yakin ingin menghapus SEMUA transaksi pada tahun ${selectedYearReset}? Tindakan ini permanen dan tidak bisa dibatalkan!`)) return;
    
    const startOfYear = new Date(`${selectedYearReset}-01-01T00:00:00`);
    const endOfYear = new Date(`${selectedYearReset}-12-31T23:59:59`);
    
    try {
      const qReset = query(
        collection(db, "transaksi"), 
        where("userId", "==", user.uid), 
        where("waktu", ">=", startOfYear), 
        where("waktu", "<=", endOfYear)
      );
      
      const snapshot = await getDocs(qReset);
      
      if (snapshot.empty) {
        return alert(`Tidak ada data transaksi yang ditemukan di tahun ${selectedYearReset}.`);
      }
      
      let deletedCount = 0;
      for (const document of snapshot.docs) {
        deleteDoc(doc(db, "transaksi", document.id)); 
        deletedCount++;
      }
      
      alert(`Berhasil! Sebanyak ${deletedCount} transaksi di tahun ${selectedYearReset} telah dihapus permanen.`);
      setShowResetModal(false);
      
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus data. Pastikan indeks Firebase sudah dibuat. Cek Console (F12) untuk detail error.");
    }
  };

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    
    const cari = searchLaporan.toLowerCase();
    const matchCari = cari === '' || 
                      t.items.some(i => i.nama.toLowerCase().includes(cari)) || 
                      (t.metode && t.metode.toLowerCase().includes(cari)) || 
                      (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(cari));
                      
    if (!matchCari) return false;

    const dateObj = t.waktu.toDate ? t.waktu.toDate() : new Date(); 
    const today = new Date();
    
    if (reportFilter === 'hari') {
      return dateObj.toDateString() === today.toDateString();
    } else if (reportFilter === 'minggu') {
      return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    } else if (reportFilter === 'bulan') {
      return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    }
    
    return true;
  });

  const displayedLaporan = laporanTab === 'bon' 
    ? filteredTransaksi.filter(t => t.metode === 'Bon' && t.statusBon !== 'Lunas') 
    : filteredTransaksi;

  const exportExcel = () => {
    const headers = ["Tanggal,Jam,Metode Pembayaran,Nama Pelanggan (Bon),Status Bon,Item,Total,Tunai,Kembali"];
    const rows = displayedLaporan.map(t => {
      const d = t.waktu?.toDate ? t.waktu.toDate() : new Date();
      const items = t.items.map(i => `${i.qty} ${i.satuan || 'Pcs'} ${i.nama}`).join(' + ');
      
      return `${d.toLocaleDateString('id-ID')},${d.toLocaleTimeString('id-ID')},${t.metode || 'Tunai'},"${t.namaPelanggan || '-'}","${t.statusBon || '-'}","${items}",${t.total},${t.uangBayar},${t.kembalian}`;
    });
    
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers.concat(rows).join("\n")));
    link.setAttribute("download", `Laporan_${laporanTab === 'bon' ? 'Bon' : 'Transaksi'}_Kasir.csv`);
    document.body.appendChild(link); 
    link.click();
  };

  const getChartData = () => {
    let labels = []; 
    let values = []; 
    const now = new Date();
    
    if (chartFilter === 'jam') {
      const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === now.toDateString());
      for(let i=8; i<=22; i+=2) { 
        labels.push(`${i}:00`); 
        values.push(todayTrans.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu.toDate().getHours() >= i && t.waktu.toDate().getHours() < i+2).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'hari') {
      for(let i=6; i>=0; i--) { 
        const d = new Date(now); d.setDate(d.getDate() - i); 
        labels.push(`${d.getDate()}/${d.getMonth()+1}`); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'bulan') {
      for(let i=5; i>=0; i--) { 
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1); 
        labels.push(d.toLocaleString('default', { month: 'short' })); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getMonth() === d.getMonth() && t.waktu.toDate().getFullYear() === d.getFullYear()).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'tahun') {
      for(let i=4; i>=0; i--) { 
        const year = now.getFullYear() - i; 
        labels.push(year); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getFullYear() === year).reduce((s, t) => s + t.total, 0)); 
      }
    }
    const max = Math.max(...values, 1);
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max };
  };

  const chartData = getChartData();

  const filteredAndSortedProduk = [...produk].filter(p => {
    if (!searchProduk) return true;
    const k = searchProduk.toLowerCase();
    return p.nama.toLowerCase().includes(k) || p.barcode.includes(k);
  }).sort((a, b) => {
    if (sortOrder === 'terbaru') {
      return (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
    } else {
      return a.nama.localeCompare(b.nama);
    }
  });

  const toggleSelectProduct = (id) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const filteredPengeluaran = pengeluaran.filter(p => {
    if (!searchPengeluaran) return true;
    return p.nama.toLowerCase().includes(searchPengeluaran.toLowerCase());
  });

  // === TAMPILAN: LOADING & LOGIN (DENGAN BACKGROUND CUSTOM LOKAL) ===
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: "'Inter', sans-serif", color: '#FF7835' }}>
        <strong>Memuat Sistem...</strong>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        position: 'relative', 
        backgroundColor: '#FF7835', // Warna cadangan
        backgroundImage: bgLogin ? `url(${bgLogin})` : "url('https://images.unsplash.com/photo-1556740734-7f9a2b7a0f4d?auto=format&fit=crop&q=80&w=2070')", 
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '20px', 
        fontFamily: "'Inter', sans-serif" 
      }}>
        {/* Lapisan Hitam Transparan (Overlay) */}
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1 }}></div>

        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxWidth: '420px', zIndex: 10, position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF7835', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>
              Selamat Datang di Aplikasi
            </div>
            <h1 style={{ fontSize: '30px', fontWeight: '900', color: '#272734', margin: 0 }}>
              POS MODERN PRO
            </h1>
            <p style={{ color: '#27274F', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '600' }}>
              Sistem Kasir Bisnis Terpadu
            </p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <input 
                type="email" 
                placeholder="Alamat Email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} 
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <input 
                type="password" 
                placeholder="Password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} 
              />
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              style={{ width: '100%', padding: '18px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 15px -3px rgba(39, 39, 52, 0.4)' }}
            >
              {isRegister ? 'BUAT AKUN BARU' : 'MASUK KE SISTEM'}
            </button>
          </form>
          <p 
            onClick={() => setIsRegister(!isRegister)} 
            style={{ cursor: 'pointer', color: '#FF7835', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700' }}
          >
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}
          </p>
        </div>
        <div style={{ position: 'absolute', bottom: '20px', right: '24px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase', zIndex: 10 }}>
          created by : Muhamad Rofiki
        </div>
      </div>
    );
  }

  // === TAMPILAN UTAMA APLIKASI ===
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* --- HEADER --- */}
      <header className="no-print" style={{ flex: 'none', height: '70px', background: 'white', padding: '0 24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 40, boxSizing: 'border-box' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
          <h1 className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#FF7835', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {namaToko || 'POS MODERN PRO'}
          </h1>
          <p className="header-email" style={{ margin: '0', color: '#27274F', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Akun: {user.email}
          </p>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
          <div className="live-clock" style={{ textAlign: 'right', paddingRight: '16px', borderRight: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="date-text" style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
            <div className="time-text" style={{ fontSize: '15px', fontWeight: '900', color: '#272734', letterSpacing: '0.5px' }}>
              {currentTime.toLocaleTimeString('id-ID')}
            </div>
          </div>
          
          <button 
            tabIndex="0" 
            onClick={() => setShowProfileModal(true)} 
            style={{ background: '#fff7ed', border: '1px solid #FF7835', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#FF7835' }}
          >
            👤
          </button>
          
          <button 
            tabIndex="0" 
            onClick={() => { if(!isOnline) { alert("Sistem tidak bisa melakukan logout saat koneksi Offline!"); return; } signOut(auth); }} 
            disabled={!isOnline} 
            style={{ padding: '8px 16px', background: isOnline ? '#fee2e2' : '#e2e8f0', color: isOnline ? '#dc2626' : '#94a3b8', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: isOnline ? 'pointer' : 'not-allowed', fontSize: '12px', transition: '0.2s' }}
          >
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div style={{ height: '100%', overflowY: 'auto', padding: '24px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
              
              <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg, #4F46E5, #3B82F6)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>
                    Rp {dashboardStats.todaySales.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Omset Hari Ini
                  </div>
                </div>
                
                <div style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(20, 184, 166, 0.3)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>
                    Rp {dashboardStats.totalPengeluaran.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Pengeluaran Hari Ini
                  </div>
                </div>
                
                {/* LABA BERSIH */}
                <div style={{ background: 'white', border: `2px solid ${isProfit ? '#10b981' : '#ef4444'}`, padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '900', marginBottom: '4px', color: isProfit ? '#10b981' : '#ef4444' }}>
                    {isProfit ? '' : '- '}Rp {Math.abs(dashboardStats.labaBersih).toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
                    Laba Bersih Hari Ini
                  </div>
                </div>

                <div style={{ background: 'linear-gradient(135deg, #EA580C, #F59E0B)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}>
                  <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>
                    {dashboardStats.totalProducts} <span style={{ fontSize: '14px', fontWeight: '500' }}>/ {dashboardStats.lowStock} Tipis</span>
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Produk & Stok Tipis
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800' }}>
                    📈 Grafik Pendapatan
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    
                    <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '4px', display: 'flex', gap: '4px' }}>
                       <button 
                          tabIndex="0" 
                          onClick={() => setChartVisualType('bar')} 
                          style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'bar' ? 'white' : 'transparent', color: chartVisualType === 'bar' ? '#2563eb' : '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: chartVisualType === 'bar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '12px', transition: '0.2s' }}
                        >
                          📊 Balok
                        </button>
                       <button 
                          tabIndex="0" 
                          onClick={() => setChartVisualType('line')} 
                          style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'line' ? 'white' : 'transparent', color: chartVisualType === 'line' ? '#2563eb' : '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: chartVisualType === 'line' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '12px', transition: '0.2s' }}
                        >
                          📈 Kurva
                        </button>
                    </div>

                    <select 
                      tabIndex="0" 
                      value={chartFilter} 
                      onChange={(e) => setChartFilter(e.target.value)} 
                      style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '700', color: '#27274F', background: '#fff', fontSize: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
                    >
                      <option value="jam">Hari Ini (Per Jam)</option>
                      <option value="hari">7 Hari Terakhir</option>
                      <option value="bulan">6 Bulan Terakhir</option>
                      <option value="tahun">5 Tahun Terakhir</option>
                    </select>
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'flex-end', gap: '15px', paddingTop: '20px', minHeight: '150px' }}>
                  
                  {chartVisualType === 'line' && (
                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 20px)', zIndex: 1 }}>
                      <polyline 
                        points={chartData.data.map((d, i) => `${(i / (chartData.data.length - 1 || 1)) * 100},${100 - ((d.total / (chartData.max || 1)) * 100)}`).join(' ')} 
                        fill="none" 
                        stroke="#3b82f6" 
                        strokeWidth="3" 
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                  )}

                  {chartData.data.map((d, i) => (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative', zIndex: 2 }}>
                      
                      {d.total > 0 && (
                        <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '800', marginBottom: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: '4px' }}>
                          {d.total.toLocaleString()}
                        </div>
                      )}
                      
                      {chartVisualType === 'bar' ? (
                        <div style={{ width: '100%', maxWidth: '50px', background: 'linear-gradient(to top, #60a5fa, #2563eb)', borderRadius: '6px 6px 0 0', height: `${(d.total / (chartData.max || 1)) * 100}%`, minHeight: '8px', transition: '0.5s ease-out', boxShadow: '0 4px 6px rgba(37,99,235,0.2)' }}></div>
                      ) : (
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', height: `${(d.total / (chartData.max || 1)) * 100}%`, minHeight: '8px', transition: '0.5s ease-out' }}>
                           <div style={{ width: '12px', height: '12px', background: 'white', border: '3px solid #2563eb', borderRadius: '50%', transform: 'translateY(-6px)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>
                        </div>
                      )}
                      
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '10px', fontWeight: '700', textAlign: 'center', width: '100%' }}>
                        {d.label}
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* --- TAB KASIR --- */}
        {activeTab === 'kasir' && (
          <div className="desktop-row-mobile-col" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="kasir-left-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              
              <div className="kasir-tools" style={{ flex: 'none', display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'nowrap', width: '100%' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Cari nama..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                />
                <form onSubmit={handleManualScan} style={{ flex: 1, minWidth: 0 }}>
                  <input 
                    type="text" 
                    placeholder="🔫 Scan..." 
                    value={barcodeInput} 
                    onChange={(e) => setBarcodeInput(e.target.value)} 
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #FF7835', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} 
                  />
                </form>
                <button 
                  tabIndex="0" 
                  onClick={() => setIsScanningKasir(!isScanningKasir)} 
                  style={{ flex: 'none', padding: '10px 12px', background: isScanningKasir ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
                >
                  {isScanningKasir ? '❌ Tutup' : '📸 Kamera'}
                </button>
              </div>

              <div id="camera-popup-container" style={{ flex: 'none', background: '#272734', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', display: isScanningKasir ? 'block' : 'none' }}>
                <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px' }}>
                  Arahkan Barcode ke Kamera
                </p>
                <div id="reader-kasir"></div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px' }}>
                <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <div 
                      key={p.id} 
                      tabIndex="0" 
                      onClick={() => addToCart(p)} 
                      onKeyDown={(e) => { if(e.key === 'Enter') addToCart(p); }} 
                      style={{ 
                        background: 'white', 
                        borderRadius: '12px', 
                        padding: '12px', 
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)', 
                        cursor: 'pointer', 
                        border: p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent', 
                        position: 'relative', 
                        transition: 'transform 0.1s, border 0.1s',
                        display: 'flex', 
                        flexDirection: 'column', 
                        height: '115px', 
                        justifyContent: 'space-between', 
                        boxSizing: 'border-box', 
                        overflow: 'hidden'
                      }} 
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)'; 
                        e.currentTarget.style.border = '2px solid #FF7835';
                      }} 
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)'; 
                        e.currentTarget.style.border = p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent';
                      }}
                    >
                      {p.stok < 50 && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>
                          {p.stok === 0 ? 'HABIS' : 'TIPIS'}
                        </div>
                      )}
                      
                      <h3 style={{ 
                        margin: '0 0 4px 0', 
                        fontSize: '13px', 
                        fontWeight: '700', 
                        color: '#272734', 
                        lineHeight: '1.2', 
                        display: '-webkit-box', 
                        WebkitLineClamp: '2', 
                        WebkitBoxOrient: 'vertical', 
                        overflow: 'hidden', 
                        height: '31px' 
                      }}>
                        {p.nama}
                      </h3>
                      
                      <div className="harga-text" style={{ fontSize: '16px', fontWeight: '900', color: p.hargaPromo ? '#e11d48' : '#0ea5e9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.hargaPromo && (
                          <span style={{textDecoration: 'line-through', fontSize: '10px', color: '#94a3b8', marginRight: '4px'}}>
                            Rp{p.harga.toLocaleString()}
                          </span>
                        )}
                        Rp {(p.hargaPromo || p.harga).toLocaleString()}
                      </div>
                      
                      <div style={{ fontSize: '11px', color: '#27274F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}>
                          <span style={{ color: p.stok < 50 ? '#dc2626' : '#16a34a' }}>
                            {p.stok} {p.satuan || 'Pcs'}
                          </span>
                        </span>
                      </div>
                      
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kasir-right-panel" style={{ flex: '0 0 420px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 'none', padding: '16px 20px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffaf5' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#272734' }}>
                  🛒 Keranjang ({cart.length})
                </h2>
                {cart.length > 0 && (
                  <button 
                    tabIndex="0" 
                    onClick={() => { setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); }} 
                    style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: '700', cursor: 'pointer', transition: '0.2s', fontSize: '11px' }}
                  >
                    Kosongkan
                  </button>
                )}
              </div>
              
              <div className="cart-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#27274F', marginTop: '30px', fontSize: '13px', fontWeight: '500' }}>
                    Belum ada pesanan...
                  </div>
                ) : (
                  cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#272734' }}>
                        {item.nama} <span style={{fontSize:'11px', color:'#94a3b8'}}>({item.satuan || 'Pcs'})</span>
                      </h3>
                      <button 
                        tabIndex="0" 
                        onClick={() => updateQuantity(item.id, 0)} 
                        style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#FF7835' }}>
                        Rp {(item.harga * item.qty).toLocaleString()}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <button 
                          tabIndex="0" 
                          onClick={() => updateQuantity(item.id, item.qty - 1)} 
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#f1f5f9', border: 'none', color: '#27274F', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                        >
                          −
                        </button>
                        <input 
                          type="number" 
                          value={item.qty} 
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)} 
                          style={{ width: '30px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '800', color: '#272734', outline: 'none' }} 
                        />
                        <button 
                          tabIndex="0" 
                          onClick={() => addToCart(item)} 
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#FF7835', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                )))}
              </div>

              <div style={{ flex: 'none', padding: '16px 20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#27274F' }}>
                    Total Pembelian:
                  </span>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: '#272734' }}>
                    Rp {totalAmount.toLocaleString()}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {['Tunai', 'QRIS', 'Transfer', 'Bon'].map(metode => (
                    <button
                      key={metode} 
                      tabIndex="0" 
                      className="btn-metode"
                      onClick={() => {
                        if (metode === 'Bon' && cart.length === 0) {
                          alert('Keranjang masih kosong! Silakan tambahkan produk terlebih dahulu.');
                          return; 
                        }
                        setMetodePembayaran(metode);
                        if(metode !== 'Tunai' && metode !== 'Bon') {
                          setPaymentAmount(totalAmount);
                        } else {
                          setPaymentAmount('');
                        }
                      }}
                      style={{
                        flex: 1, 
                        padding: '8px 4px', 
                        borderRadius: '8px', 
                        cursor: 'pointer', 
                        fontWeight: '800', 
                        fontSize: '12px',
                        background: metodePembayaran === metode ? '#FF7835' : 'white', 
                        color: metodePembayaran === metode ? 'white' : '#27274F',
                        border: metodePembayaran === metode ? 'none' : '1px solid #cbd5e1', 
                        transition: 'all 0.2s',
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {metode === 'Tunai' ? '💵 Tunai' : metode === 'QRIS' ? '📱 QRIS' : metode === 'Transfer' ? '💳 Transfer' : '📝 Bon'}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  {metodePembayaran === 'Tunai' ? (
                    <input 
                      type="number" 
                      placeholder="Ketik Nominal Uang (Rp)" 
                      value={paymentAmount} 
                      onChange={(e) => setPaymentAmount(e.target.value)} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: paymentAmount !== '' && Number(paymentAmount) < totalAmount ? '2px solid #ef4444' : '2px solid #cbd5e1', fontSize: '16px', fontWeight: '800', outline: 'none', background: 'white', color: '#272734', boxSizing: 'border-box' }} 
                    />
                  ) : metodePembayaran === 'QRIS' ? (
                    <button 
                      tabIndex="0" 
                      onClick={() => setShowQrisModal(true)} 
                      disabled={!qrisImage} 
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', background: !qrisImage ? '#cbd5e1' : '#272734', color: 'white', border: 'none', fontWeight: '800', cursor: !qrisImage ? 'not-allowed' : 'pointer', fontSize: '13px', textTransform: 'uppercase' }}
                    >
                      {qrisImage ? '📱 TAMPILKAN QRIS' : '⚠️ QRIS BELUM DIATUR'}
                    </button>
                  ) : metodePembayaran === 'Transfer' ? (
                    <div style={{ padding: '10px', background: '#eff6ff', color: '#0369a1', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #bae6fd' }}>
                      💳 Pastikan transfer masuk sebelum cetak struk.
                    </div>
                  ) : (
                    <div style={{ padding: '10px', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #ffedd5' }}>
                      📝 Klik Bayar & Cetak di bawah untuk mencatat Bon.
                    </div>
                  )}
                </div>

                {metodePembayaran === 'Tunai' && paymentAmount !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px', background: Number(paymentAmount) >= totalAmount ? '#dcfce7' : '#fee2e2', borderRadius: '8px', border: `1px solid ${Number(paymentAmount) >= totalAmount ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: Number(paymentAmount) >= totalAmount ? '#16a34a' : '#dc2626' }}>
                      {Number(paymentAmount) >= totalAmount ? 'Kembalian:' : '⚠️ Uang Kurang:'}
                    </span>
                    <span style={{ fontWeight: '900', fontSize: '16px', color: Number(paymentAmount) >= totalAmount ? '#16a34a' : '#dc2626' }}>
                      Rp {Math.abs(kembalian).toLocaleString()}
                    </span>
                  </div>
                )}

                <button 
                  tabIndex="0" 
                  onClick={processPayment} 
                  disabled={cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))} 
                  style={{ width: '100%', padding: '14px', background: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#e2e8f0' : '#FF7835', color: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalAmount))) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
                >
                  BAYAR & CETAK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB TOKO (PRODUK) --- */}
        {activeTab === 'toko' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              {/* --- HEADER DATABASE PRODUK + PENCARIAN KIRI FILTER --- */}
              <div className="tabel-header-container" style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                    📦 Database Produk
                  </h3>
                  <input 
                    type="text" 
                    placeholder="🔍 Cari nama / barcode..." 
                    value={searchProduk} 
                    onChange={(e) => setSearchProduk(e.target.value)} 
                    style={{ flex: 1, maxWidth: '220px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none', color: '#272734', fontWeight: '600', margin: 0, boxSizing: 'border-box' }} 
                  />
                </div>

                <div className="action-buttons-mobile" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
                  <select 
                    tabIndex="0" 
                    value={sortOrder} 
                    onChange={e => setSortOrder(e.target.value)} 
                    style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '700', fontSize: '12px', color: '#27274F', background: '#f8fafc', margin: 0, width: 'auto' }}
                  >
                    <option value="terbaru">Terbaru</option>
                    <option value="az">A - Z</option>
                  </select>
                  
                  {selectedProducts.length > 0 && (
                    <button 
                      tabIndex="0" 
                      onClick={() => { 
                        setPrintData(produk.filter(p => selectedProducts.includes(p.id))); 
                        setPrintMode('label'); 
                      }} 
                      style={{ background: '#0ea5e9', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                    >
                      🖨️ Cetak ({selectedProducts.length})
                    </button>
                  )}
                  
                  <button 
                    tabIndex="0" 
                    onClick={() => { 
                      setPrintData(produk); 
                      setPrintMode('label'); 
                    }} 
                    style={{ background: '#FF7835', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    🖨️ Cetak Semua
                  </button>
                </div>
              </div>
              
              {/* TABEL PRODUK BISA SCROLL KANAN KIRI DI HP */}
              <div className="table-container" style={{ flex: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', color: '#27274F', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5, width: '30px', textAlign: 'center' }}>☑️</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Nama Produk</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Harga</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Stok</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Barcode</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProduk.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>
                          Tidak ada produk yang ditemukan.
                        </td>
                      </tr>
                    ) : (
                      filteredAndSortedProduk.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={selectedProducts.includes(p.id)} 
                            onChange={() => toggleSelectProduct(p.id)} 
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }} 
                          />
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {p.nama}
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0ea5e9', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {p.hargaPromo ? (
                            <>
                              <span style={{ textDecoration: 'line-through', fontSize: '10px', color: '#94a3b8' }}>
                                Rp {p.harga.toLocaleString()}
                              </span>
                              <br/>
                              <span style={{ color: '#e11d48', fontWeight: 'bold' }}>
                                Rp {p.hargaPromo.toLocaleString()}
                              </span>
                            </>
                          ) : (
                            <span>Rp {p.harga.toLocaleString()}</span>
                          )}
                        </td>
                        
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', color: p.stok < 50 ? '#dc2626' : '#16a34a', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11px' }}>
                            {p.stok} {p.satuan || 'Pcs'}
                          </span>
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#27274F', fontSize: '12px' }}>
                          {p.barcode}
                        </td>
                        
                        <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                          <button 
                            tabIndex="0" 
                            onClick={() => { 
                              setNamaProd(p.nama); 
                              setHargaProd(p.harga); 
                              setHargaPromoProd(p.hargaPromo || ''); 
                              setStokProd(p.stok); 
                              setBarcodeProd(p.barcode); 
                              setSatuanProd(p.satuan || 'Pcs'); 
                              setEditingProductId(p.id); 
                            }} 
                            style={{ background: '#272734', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Edit
                          </button>
                          
                          <button 
                            tabIndex="0" 
                            onClick={async () => { 
                              if(window.confirm('Yakin ingin menghapus produk ini?')) {
                                deleteDoc(doc(db, "produk", p.id)); 
                              }
                            }} 
                            style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-section sticky-box diet-form" style={{ flex: '0 0 350px', overflowY: 'visible', height: 'auto' }}>
              <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <h3 className="form-title" style={{ margin: '0 0 20px 0', color: '#FF7835', fontSize: '18px', fontWeight: '800' }}>
                  {editingProductId ? '✏️ Edit Produk' : '➕ Tambah Produk'}
                </h3>
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                  Nama Produk
                </label>
                <input 
                  className="form-input"
                  value={namaProd} 
                  onChange={e => setNamaProd(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} 
                />
                
                <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                      Harga Normal (Rp)
                    </label>
                    <input 
                      className="form-input"
                      value={hargaProd} 
                      onChange={e => setHargaProd(e.target.value)} 
                      required 
                      type="number" 
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                      Harga Promo (Rp)
                    </label>
                    <input 
                      className="form-input"
                      value={hargaPromoProd} 
                      onChange={e => setHargaPromoProd(e.target.value)} 
                      placeholder="Opsional" 
                      type="number" 
                      style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none', background: '#fef08a' }} 
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                      Stok Awal
                    </label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input 
                        className="form-input"
                        value={stokProd} 
                        onChange={e => setStokProd(e.target.value)} 
                        required 
                        type="number" 
                        style={{ width: '55%', padding: '12px 6px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} 
                      />
                      <select 
                        className="form-input"
                        tabIndex="0" 
                        value={satuanProd} 
                        onChange={e => setSatuanProd(e.target.value)} 
                        style={{ width: '45%', padding: '12px 4px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '11px', fontWeight: 'bold', outline: 'none' }}
                      >
                        <option value="Pcs">Pcs</option>
                        <option value="Kg">Kg</option>
                        <option value="Gram">Gram</option>
                        <option value="Liter">Liter</option>
                        <option value="Pack">Pack</option>
                        <option value="Box">Box</option>
                        <option value="Cup">Cup</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                  Barcode Produk
                </label>
                <div className="form-row barcode-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'nowrap', width: '100%' }}>
                  <input 
                    className="form-input"
                    value={barcodeProd} 
                    onChange={e => setBarcodeProd(e.target.value)} 
                    placeholder="Kosong = Kembar 6 Angka" 
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '12px', outline: 'none' }} 
                  />
                  <button 
                    className="form-input"
                    tabIndex="0" 
                    type="button" 
                    onClick={() => setIsScanningToko(!isScanningToko)} 
                    style={{ flex: 'none', padding: '10px 12px', background: isScanningToko ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}
                  >
                    {isScanningToko ? '❌ Tutup' : '📸 Scan'}
                  </button>
                </div>

                <div style={{ background: '#272734', padding: '12px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', display: isScanningToko ? 'block' : 'none' }}>
                  <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold' }}>
                    Arahkan Barcode ke Kamera
                  </p>
                  <div id="reader-toko"></div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="form-btn-submit"
                    tabIndex="0" 
                    type="submit" 
                    style={{ flex: 1, padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}
                  >
                    {editingProductId ? 'UPDATE' : 'SIMPAN'}
                  </button>
                  {editingProductId && (
                    <button 
                      className="form-btn-submit"
                      tabIndex="0" 
                      type="button" 
                      onClick={() => { 
                        setEditingProductId(null); 
                        setNamaProd(''); 
                        setHargaProd(''); 
                        setHargaPromoProd(''); 
                        setStokProd(''); 
                        setBarcodeProd(''); 
                        setSatuanProd('Pcs'); 
                      }} 
                      style={{ flex: 1, padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}
                    >
                      BATAL
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB PENGELUARAN --- */}
        {activeTab === 'pengeluaran' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              
              <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                  💸 Riwayat Pengeluaran
                </h3>
                <input 
                  type="text" 
                  placeholder="🔍 Cari keterangan..." 
                  value={searchPengeluaran} 
                  onChange={(e) => setSearchPengeluaran(e.target.value)} 
                  style={{ flex: 1, maxWidth: '220px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none', color: '#272734', fontWeight: '600', margin: 0, boxSizing: 'border-box' }} 
                />
              </div>
              
              <div style={{ padding: '8px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', fontSize: '11px', fontWeight: '600', marginBottom: '16px', border: '1px solid #ffedd5' }}>
                💡 Menampilkan 500 pengeluaran terbaru.
              </div>
              
              <div className="table-container" style={{ flex: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#27274F', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Tanggal & Waktu</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Keterangan</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Nominal</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, background: '#f8fafc', zIndex: 5 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPengeluaran.length === 0 ? <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>Belum ada pengeluaran.</td></tr> : 
                      filteredPengeluaran.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#27274F', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
                          {p.waktu ? (p.waktu.toDate ? p.waktu.toDate().toLocaleString('id-ID') : new Date(p.waktu).toLocaleString('id-ID')) : 'Baru saja'}
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px', whiteSpace: 'nowrap' }}>
                          {p.nama}
                        </td>
                        
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#e11d48', fontSize: '14px', whiteSpace: 'nowrap' }}>
                          - Rp {p.nominal.toLocaleString()}
                        </td>
                        
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                          <button 
                            tabIndex="0" 
                            onClick={async () => { 
                              if(window.confirm('Yakin hapus data ini?')) {
                                deleteDoc(doc(db, "pengeluaran", p.id)); 
                              }
                            }} 
                            style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-section sticky-box diet-form" style={{ flex: '0 0 350px', overflowY: 'visible', height: 'auto' }}>
              <form onSubmit={simpanPengeluaran} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <h3 className="form-title" style={{ margin: '0 0 20px 0', color: '#e11d48', fontSize: '18px', fontWeight: '800' }}>➖ Catat Pengeluaran</h3>
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                  Keterangan (Contoh: Bayar Listrik, Kulakan)
                </label>
                <input 
                  className="form-input"
                  value={namaPengeluaran} 
                  onChange={e => setNamaPengeluaran(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} 
                />
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>
                  Nominal Pengeluaran (Rp)
                </label>
                <input 
                  className="form-input"
                  value={nominalPengeluaran} 
                  onChange={e => setNominalPengeluaran(e.target.value)} 
                  required 
                  type="number" 
                  style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} 
                />
                
                <button 
                  className="form-btn-submit"
                  tabIndex="0" 
                  type="submit" 
                  style={{ width: '100%', padding: '14px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}
                >
                  SIMPAN PENGELUARAN
                </button>
              </form>
            </div>
          </div>
        )}

        {/* --- TAB LAPORAN --- */}
        {activeTab === 'laporan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box', width: '100%' }}>
            
            <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
              <h2 style={{ margin: '0', fontSize: '20px', color: '#272734', fontWeight: '800' }}>📋 Laporan Transaksi</h2>
              
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  tabIndex="0" 
                  className="tab-laporan-btn" 
                  onClick={() => setLaporanTab('transaksi')} 
                  style={{ padding: '8px 16px', background: laporanTab === 'transaksi' ? '#272734' : '#f1f5f9', color: laporanTab === 'transaksi' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '13px', transition: '0.2s' }}
                >
                  Semua Transaksi
                </button>
                <button 
                  tabIndex="0" 
                  className="tab-laporan-btn" 
                  onClick={() => setLaporanTab('bon')} 
                  style={{ padding: '8px 16px', background: laporanTab === 'bon' ? '#FF7835' : '#f1f5f9', color: laporanTab === 'bon' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '13px', transition: '0.2s' }}
                >
                  Buku Bon (Piutang)
                </button>
                <button 
                  tabIndex="0" 
                  onClick={exportExcel} 
                  style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                >
                  📥 Download Excel
                </button>
                <button 
                  tabIndex="0" 
                  onClick={() => setShowResetModal(true)} 
                  style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                >
                  🗑️ Hapus Data Lama
                </button>
              </div>
            </div>

            <div style={{ flex: 'none', background: 'white', padding: '12px 16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
              <input 
                type="text" 
                placeholder="🔍 Cari nama barang, metode bayar, atau nama pelanggan..." 
                value={searchLaporan} 
                onChange={(e) => setSearchLaporan(e.target.value)} 
                style={{ flex: 2, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: '200px' }} 
              />
              <select 
                tabIndex="0" 
                value={reportFilter} 
                onChange={(e) => setReportFilter(e.target.value)} 
                style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', fontWeight: '600', color: '#27274F', outline: 'none', minWidth: '150px' }}
              >
                <option value="hari">📅 Hari Ini</option>
                <option value="minggu">📈 Minggu Ini</option>
                <option value="bulan">📉 Bulan Ini</option>
                <option value="semua">📂 Semua Waktu</option>
              </select>
            </div>

            <div style={{ flex: 'none', padding: '6px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '6px', fontSize: '11px', fontWeight: '600', marginBottom: '8px', border: '1px solid #ffedd5' }}>
              💡 Menampilkan 500 transaksi terbaru agar aplikasi kencang. Gunakan kolom pencarian di atas untuk melihat data lama.
            </div>

            <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflowY: 'auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', width: '100%' }}>
              {displayedLaporan.length === 0 ? <div style={{ padding: '40px', textAlign: 'center', color: '#27274F', fontSize: '14px', fontWeight: '500' }}>Belum ada data di tabel ini.</div> : 
                displayedLaporan.map(t => (
                <div key={t.id} style={{ padding: '8px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '800', color: '#272734', fontSize: '12px', marginBottom: '4px' }}>
                      {t.waktu ? (t.waktu.toDate ? t.waktu.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' }) : new Date(t.waktu).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })) : 'Baru saja'} - {t.waktu ? (t.waktu.toDate ? t.waktu.toDate().toLocaleTimeString('id-ID') : new Date(t.waktu).toLocaleTimeString('id-ID')) : ''}
                    </div>
                    
                    {t.metode === 'Bon' && (
                      <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '900', color: '#272734' }}>👤 {t.namaPelanggan}</span>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '900', background: t.statusBon === 'Lunas' ? '#dcfce7' : '#fee2e2', color: t.statusBon === 'Lunas' ? '#16a34a' : '#dc2626' }}>
                          {t.statusBon === 'Lunas' ? '✓ LUNAS' : '⚠️ BELUM LUNAS'}
                        </span>
                      </div>
                    )}

                    <div style={{ color: '#27274F', fontSize: '11px', background: '#fff7ed', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', fontWeight: '700', marginBottom: '4px' }}>
                      {t.items.map(i => `${i.qty} ${i.satuan||'Pcs'} ${i.nama}`).join(', ')}
                    </div>
                    
                    <div style={{ fontSize: '11px', color: '#27274F', fontWeight: '700' }}>
                      Metode: <span style={{ color: t.metode === 'Tunai' ? '#FF7835' : '#0ea5e9' }}>{t.metode || 'Tunai'}</span>
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '900', color: '#FF7835', fontSize: '15px', marginBottom: '2px' }}>
                        Rp {t.total.toLocaleString()}
                      </div>
                      {t.metode === 'Tunai' && (
                        <div style={{ fontSize: '10px', color: '#27274F', fontWeight: '600' }}>
                          Tunai: Rp {t.uangBayar?.toLocaleString()} <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span> Kem: Rp {t.kembalian?.toLocaleString()}
                        </div>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {t.metode === 'Bon' && t.statusBon === 'Belum Lunas' && (
                        <button 
                          tabIndex="0" 
                          onClick={async () => { 
                            if(window.confirm(`Tandai tagihan Rp ${t.total.toLocaleString()} atas nama ${t.namaPelanggan} ini sudah LUNAS?`)) {
                              updateDoc(doc(db, "transaksi", t.id), { statusBon: 'Lunas', waktuLunas: new Date() }); 
                            }
                          }} 
                          style={{ background: '#10b981', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}
                        >
                          ✓ LUNAS
                        </button>
                      )}
                      <button 
                        tabIndex="0" 
                        onClick={() => setStrukData(t)} 
                        style={{ background: '#272734', color: 'white', border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}
                      >
                        🖨️ Cetak
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      {/* --- MODAL EDIT PROFIL TOKO & UKURAN LABEL --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '450px', maxHeight: '95vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>⚙️ Profil & Label</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setShowHelpModal(true)} 
                  style={{ background: '#eff6ff', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: '#2563eb' }}
                >
                  ?
                </button>
                <button 
                  onClick={() => setShowProfileModal(false)} 
                  style={{ background: '#fee2e2', border: 'none', width: '36px', height: '36px', borderRadius: '50%', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', color: 'red' }}
                >
                  ×
                </button>
              </div>
            </div>

            {/* FITUR BARU: PENGATURAN SUARA */}
            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
              <p style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '12px', color: '#272734'}}>🔔 Pengaturan Suara (Auto Save)</p>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px dashed #cbd5e1', paddingBottom: '8px' }}>
                 <span style={{fontSize: '12px', fontWeight: 'bold', color: '#475569'}}>🔊 Efek Suara Scanner (Beep)</span>
                 <input 
                   type="checkbox" 
                   checked={soundBeep} 
                   onChange={(e) => setSoundBeep(e.target.checked)} 
                   style={{transform: 'scale(1.5)', cursor: 'pointer'}} 
                 />
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <span style={{fontSize: '12px', fontWeight: 'bold', color: '#475569'}}>🗣️ Suara Robot Kasir (Terima Kasih)</span>
                 <input 
                   type="checkbox" 
                   checked={soundVoice} 
                   onChange={(e) => setSoundVoice(e.target.checked)} 
                   style={{transform: 'scale(1.5)', cursor: 'pointer'}} 
                 />
              </div>
            </div>

            {/* FITUR BARU: BACKGROUND LOGIN */}
            <div style={{ background: '#fffaf5', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '2px dashed #fed7aa' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#272734', marginBottom: '4px', display: 'block' }}>
                🖼️ Upload Background Login
              </label>
              <p style={{fontSize: '10px', color: '#ea580c', margin: '0 0 10px 0', fontWeight: 'bold'}}>*Maks 1 MB. Foto Lanskap/Memanjang.</p>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleBgUpload} 
                style={{ fontSize: '12px', marginBottom: '12px', display: bgLogin ? 'none' : 'block' }} 
              />
              {bgLogin && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', margin: '0 0 8px 0' }}>✓ Background Tersimpan</p>
                  <img src={bgLogin} alt="BG" style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }} />
                  <div>
                    <button 
                      onClick={() => { setBgLogin(''); localStorage.removeItem('pos_bgLogin'); }} 
                      style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🗑️ Hapus & Pakai Default
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>
              Nama Toko
            </label>
            <input 
              value={namaToko} 
              onChange={e => setNamaToko(e.target.value)} 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box' }} 
            />
            
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>
              Alamat
            </label>
            <input 
              value={alamat} 
              onChange={e => setAlamat(e.target.value)} 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '12px', boxSizing: 'border-box' }} 
            />
            
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>
              WhatsApp
            </label>
            <input 
              value={noTelp} 
              onChange={e => setNoTelp(e.target.value)} 
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }} 
            />

            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block' }}>
              Pesan Penutup Struk
            </label>
            <input 
              value={pesanStruk} 
              onChange={e => setPesanStruk(e.target.value)} 
              placeholder="Contoh: *** TERIMA KASIH ***"
              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }} 
            />
            
            <div style={{ background: '#fffaf5', padding: '16px', borderRadius: '16px', marginBottom: '20px', border: '2px dashed #fed7aa' }}>
              <label style={{ fontSize: '13px', fontWeight: '800', color: '#272734', marginBottom: '8px', display: 'block' }}>
                📱 Upload Gambar QRIS Toko
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                style={{ fontSize: '12px', marginBottom: '12px', display: qrisImage ? 'none' : 'block' }} 
              />
              {qrisImage && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', margin: '0 0 8px 0' }}>✓ Gambar QRIS Tersimpan</p>
                  <img src={qrisImage} alt="QRIS" style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '12px' }} />
                  <div>
                    <button 
                      onClick={() => setQrisImage('')} 
                      style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 16px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                    >
                      🗑️ Hapus & Ganti
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <p style={{fontWeight: 'bold', fontSize: '13px', marginBottom: '10px', color: '#272734'}}>📏 Pengaturan Kertas Label (px)</p>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                <div>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block'}}>
                    Lebar
                  </label>
                  <input 
                    type="number" 
                    value={labelWidth} 
                    onChange={e => setLabelWidth(e.target.value)} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: 0, boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block'}}>
                    Tinggi
                  </label>
                  <input 
                    type="number" 
                    value={labelHeight} 
                    onChange={e => setLabelHeight(e.target.value)} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: 0, boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block'}}>
                    Sekat/Gap
                  </label>
                  <input 
                    type="number" 
                    value={labelGap} 
                    onChange={e => setLabelGap(e.target.value)} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: 0, boxSizing: 'border-box' }} 
                  />
                </div>
                <div>
                  <label style={{fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block'}}>
                    Jml Kolom
                  </label>
                  <input 
                    type="number" 
                    value={labelCols} 
                    onChange={e => setLabelColumns(e.target.value)} 
                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: 0, boxSizing: 'border-box' }} 
                  />
                </div>
              </div>
              <div style={{marginTop:'15px'}}>
                <label style={{fontSize: '11px', fontWeight: 'bold', color: '#475569', marginBottom: '4px', display: 'block'}}>
                  Skala Isi Label (%)
                </label>
                <input 
                  type="number" 
                  value={labelScale} 
                  onChange={e => setLabelScale(e.target.value)} 
                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', marginBottom: 0, boxSizing: 'border-box' }} 
                />
              </div>
            </div>

            <button 
              onClick={simpanProfil} 
              style={{ width: '100%', padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer', fontSize: '14px' }}
            >
              SIMPAN PERUBAHAN
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL PUSAT BANTUAN (FAQ ACCORDION) --- */}
      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '25px', borderRadius: '20px', width: '100%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, color: '#2563eb' }}>📖 Pusat Bantuan</h3>
              <button 
                onClick={() => setShowHelpModal(false)} 
                style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}
              >
                ×
              </button>
            </div>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer', color: '#272734' }}>
                1. Cara Transaksi & Kasir
              </summary>
              <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5' }}>
                Gunakan tombol kamera atau scan manual barcode. Ubah jumlah barang di keranjang. Klik "Bayar" lalu pilih metode bayar. Untuk struk otomatis, pastikan printer thermal sudah tersambung dengan PC/HP Anda.
              </p>
            </details>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer', color: '#272734' }}>
                2. Cara Tambah Produk & Promo
              </summary>
              <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5' }}>
                Isi nama, harga normal, dan stok. Harga promo bersifat opsional. Jika diisi, kasir akan otomatis menggunakan harga promo dan label barcode akan berubah warna menjadi kuning.
              </p>
            </details>
            
            <details style={{ marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer', color: '#272734' }}>
                3. Panduan Cetak & Unduh Label (PENTING)
              </summary>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5' }}>
                <ul style={{ paddingLeft: '15px', margin: 0 }}>
                  <li><b>Unduh Label (PDF):</b> Klik tombol "🖨️ PRINT / SIMPAN PDF". Pada jendela yang muncul, ubah pilihan Printer (Destination) menjadi "Save as PDF" atau "Simpan sebagai PDF".</li>
                  <li><b>Kertas A4 Biasa:</b> Biarkan settingan Lebar 185, Tinggi 95, Kolom 4, Sekat 5.</li>
                  <li><b>Stiker Thermal Roll:</b> Masukkan ukuran stiker asli. Jika tulisan di label meluber/terpotong, turunkan angka <b>"Skala Isi Label"</b> (misal menjadi 70%).</li>
                  <li><b>Sekat/Gap:</b> Beri angka (px) untuk memberi jarak antar stiker agar pemotongan tidak mepet.</li>
                </ul>
              </div>
            </details>

            <details style={{ marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer', color: '#272734' }}>
                4. Laporan & Buku Bon
              </summary>
              <p style={{ fontSize: '13px', color: '#475569', marginTop: '8px', lineHeight: '1.5' }}>
                Semua transaksi tersimpan di menu Laporan. Khusus pembayaran "Bon", akan masuk ke halaman Buku Bon. Klik tombol "Lunas" di laporan jika pelanggan sudah melunasi tagihannya.
              </p>
            </details>

            <button 
              onClick={() => setShowHelpModal(false)} 
              style={{ width: '100%', padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '10px', marginTop: '15px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              SAYA MENGERTI
            </button>
          </div>
        </div>
      )}

      {/* --- POP-UP MODAL BON (PIUTANG) --- */}
      {showBonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'left', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#272734', fontSize: '22px', fontWeight: '900' }}>📝 Catat Bon Pelanggan</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px', fontWeight: '600' }}>Total Tagihan: <strong style={{ color: '#FF7835', fontSize: '20px' }}>Rp {totalAmount.toLocaleString()}</strong></p>
            
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', marginBottom: '8px', display: 'block' }}>
              Nama Pelanggan / Nomor WA <span style={{color: '#ef4444'}}>*</span>
            </label>
            <input 
              autoFocus 
              value={namaPelangganBon} 
              onChange={e => setNamaPelangganBon(e.target.value)} 
              placeholder="Contoh: Pak Budi" 
              style={{ width: '100%', padding: '16px', marginBottom: '24px', border: '2px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', fontSize: '15px', fontWeight: '700', outline: 'none' }} 
            />
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                tabIndex="0" 
                onClick={() => { setShowBonModal(false); setMetodePembayaran('Tunai'); }} 
                style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}
              >
                BATAL
              </button>
              <button 
                tabIndex="0" 
                onClick={() => finalizePayment('Bon')} 
                style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}
              >
                SIMPAN BON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TAMPIL QRIS --- */}
      {showQrisModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#272734', fontSize: '24px', fontWeight: '800' }}>Silakan Scan QRIS</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px' }}>Total Tagihan: <strong style={{ color: '#FF7835', fontSize: '18px' }}>Rp {totalAmount.toLocaleString()}</strong></p>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', display: 'inline-block', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <img src={qrisImage} alt="QRIS Toko" style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => setShowQrisModal(false)} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer', fontSize: '14px' }}>TUTUP</button>
              <button tabIndex="0" onClick={() => finalizePayment('QRIS')} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}>SUDAH DIBAYAR</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL RESET DATA TAHUNAN --- */}
      {showResetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9900, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 10px 0', color: '#dc2626', fontSize: '22px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>⚠️ Hapus Data Tahunan</h2>
            
            <div style={{ padding: '12px 16px', background: '#fee2e2', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '20px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', fontWeight: '700', lineHeight: '1.5' }}>
                PERINGATAN! Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah men-download data (Excel) untuk tahun tersebut sebelum menghapus.
              </p>
            </div>

            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', display: 'block', marginBottom: '8px' }}>Pilih Tahun Transaksi yang Ingin Dihapus:</label>
            <select tabIndex="0" value={selectedYearReset} onChange={e => setSelectedYearReset(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', marginBottom: '24px', fontSize: '15px', fontWeight: 'bold', color: '#272734', outline: 'none' }}>
              {Array.from({ length: 26 }, (_, i) => 2025 + i).map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => setShowResetModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#27274F', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>BATAL</button>
              <button tabIndex="0" onClick={handleResetTahunan} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)' }}>HAPUS PERMANEN</button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP PERINGATAN OFFLINE DENGAN TOMBOL OKE --- */}
      {showOfflineWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.9)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 16px 0', color: '#dc2626', fontSize: '20px', fontWeight: '900', lineHeight: '1.4' }}>
              MODE OFFLINE AKTIF<br />INTERNET TERPUTUS
            </h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px', fontWeight: '700', lineHeight: '1.6', background: '#fff7ed', padding: '12px', borderRadius: '12px', border: '1px solid #ffedd5' }}>
              Jangan refresh halaman atau menutup browser agar data transaksi tidak hilang!
            </p>
            <button tabIndex="0" onClick={() => setShowOfflineWarning(false)} style={{ width: '100%', padding: '16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)' }}>
              Oke, Saya Mengerti
            </button>
          </div>
        </div>
      )}

      {/* --- STRUK AREA DENGAN PESAN KUSTOM --- */}
      {strukData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', boxSizing: 'border-box' }}>
            <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', margin: 'auto' }}>
              <h2 style={{ margin: '0' }}>{namaToko || 'STRUK BELANJA'}</h2>
              <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>Telp/WA: {noTelp}</p>
              
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <p style={{ fontSize: '12px', textAlign: 'left', margin: '2px 0' }}>
                Tgl: {strukData.waktu ? (strukData.waktu instanceof Date ? strukData.waktu.toLocaleString('id-ID') : new Date(strukData.waktu).toLocaleString('id-ID')) : new Date().toLocaleString('id-ID')}
              </p>
              <p style={{ fontSize: '12px', textAlign: 'left', margin: '2px 0' }}>
                Metode: {strukData.metode}
              </p>
              
              {strukData.metode === 'Bon' && (
                <p style={{ fontSize: '13px', textAlign: 'left', margin: '4px 0', fontWeight: 'bold' }}>
                  PELANGGAN: {strukData.namaPelanggan}
                </p>
              )}
              
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              
              {strukData.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{it.qty} {it.satuan} {it.nama}</span>
                    <span>{(it.harga * it.qty).toLocaleString()}</span>
                  </div>
                  {/* --- KETERANGAN PROMO MUNCUL JIKA ADA DISKON --- */}
                  {it.hargaAsli && it.hargaAsli > it.harga && (
                    <div style={{ fontSize: '11px', textAlign: 'left', color: '#555' }}>
                      <span style={{textDecoration: 'line-through'}}>Rp {it.hargaAsli.toLocaleString()}</span> (Harga Promo)
                    </div>
                  )}
                </div>
              ))}
              
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>TOTAL</span>
                <span>Rp {strukData.total.toLocaleString()}</span>
              </div>
              
              {strukData.metode === 'Tunai' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
                    <span>TUNAI</span>
                    <span>Rp {strukData.uangBayar?.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}>
                    <span>KEMBALI</span>
                    <span>Rp {strukData.kembalian?.toLocaleString()}</span>
                  </div>
                </>
              )}
              
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{pesanStruk}</p>
              
              <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button 
                  tabIndex="0" 
                  onClick={() => window.print()} 
                  style={{ flex: 1, background: '#FF7835', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  Print (Enter)
                </button>
                <button 
                  tabIndex="0" 
                  onClick={() => setStrukData(null)} 
                  style={{ flex: 1, background: '#e2e8f0', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#27274F' }}
                >
                  Tutup (Esc)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CETAK LABEL: LAYOUT GRID DENGAN SEKAT & SKALA KUSTOM --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#272734', position: 'sticky', top: 0, zIndex: 10 }}>
            <button 
              onClick={() => window.print()} 
              style={{ background: '#FF7835', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              🖨️ PRINT / SIMPAN PDF
            </button>
            <button 
              onClick={() => setPrintMode(null)} 
              style={{ background: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', marginLeft: '10px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              TUTUP
            </button>
          </div>
          
          <div id="print-area" style={{ 
              background: '#fff', 
              padding: '10px', 
              display: 'grid', 
              gridTemplateColumns: `repeat(${labelCols}, auto)`, 
              gap: `${labelGap}px`, 
              justifyContent: 'center'
          }}>
            {printData.map((p, i) => (
              <div key={i} style={{ 
                border: '1px dashed #000', 
                width: `${labelWidth}px`, 
                height: `${labelHeight}px`, 
                display: 'flex', 
                background: p.hargaPromo ? '#fef08a' : '#fff', 
                boxSizing: 'border-box', 
                overflow: 'hidden',
                position: 'relative',
                printColorAdjust: 'exact', 
                WebkitPrintColorAdjust: 'exact'
              }}>
                {/* --- CONTAINER SKALA (ZOOM) --- */}
                <div style={{ 
                    display: 'flex', 
                    width: '100%', 
                    height: '100%', 
                    transform: `scale(${labelScale / 100})`, 
                    transformOrigin: 'top left',
                    width: `${(100 / (labelScale / 100))}%`, 
                    height: `${(100 / (labelScale / 100))}%`
                }}>
                  <div style={{ width: '25px', borderRight: '1px dashed #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase', textAlign:'center', maxHeight:'100%' }}>
                      {namaToko || 'TOKO'}
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3px', justifyContent: 'space-between' }}>
                    <div style={{ height: '30px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.nama}
                    </div>
                    
                    <div style={{ flex: 1, textAlign: 'center', display:'flex', flexDirection:'column', justifyContent:'center' }}>
                      <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=1&height=6`} style={{ width: '90%', height: '25px', margin:'0 auto' }} alt="barcode" />
                      <div style={{ fontSize: '8px', fontFamily: 'monospace', marginTop: '2px' }}>{p.barcode}</div>
                    </div>
                    
                    <div style={{ height: '28px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      {p.hargaPromo && <span style={{ fontSize: '8px', textDecoration: 'line-through' }}>Rp{p.harga.toLocaleString()}</span>}
                      <div style={{ fontSize: '15px', fontWeight: '900' }}>
                        Rp{(p.hargaPromo || p.harga).toLocaleString()}/<span style={{fontSize:'9px'}}>{p.satuan}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NAVIGASI BAWAH */}
      <nav className="no-print" style={{ flex: 'none', height: '65px', background: '#fff3e0', borderTop: '2px solid #ffd54f', display: 'flex', padding: '0', zIndex: 10 }}>
        {[ { id: 'dashboard', label: 'Dashboard', icon: '📊' }, { id: 'kasir', label: 'Kasir', icon: '💰' }, { id: 'toko', label: 'Produk', icon: '📦' }, { id: 'pengeluaran', label: 'Arus Kas', icon: '💸' }, { id: 'laporan', label: 'Laporan', icon: '📉' } ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveTab(tab.id)} 
            style={{ flex: 1, border: 'none', background: 'transparent', color: activeTab === tab.id ? '#FF7835' : '#9ca3af', fontSize: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
          >
            <span style={{fontSize: '20px', transform: activeTab === tab.id ? 'translateY(-2px)' : 'none', transition: '0.2s'}}>
              {tab.icon}
            </span>
            <span style={{fontWeight: activeTab === tab.id ? '800' : '600'}}>
              {tab.label}
            </span>
          </button>
        ))}
      </nav>

      {/* CSS GLOBAL DAN MEDIA QUERIES (HARAM DIHILANGKAN) */}
      <style>{`
        * { 
          -webkit-tap-highlight-color: transparent; 
        }
        
        @media print { 
          .no-print { 
            display: none !important; 
          } 
          body * { 
            visibility: hidden; 
          } 
          #strukArea, #strukArea * { 
            visibility: visible; 
          } 
          #strukArea { 
            position: absolute; 
            left: 50%; 
            top: 0; 
            transform: translateX(-50%); 
            width: 100%; 
            margin: 0 !important; 
            box-shadow: none !important; 
          } 
          #print-area, #print-area * { 
            visibility: visible; 
          } 
          #print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            display: grid !important; 
          } 
        }
        
        ::-webkit-scrollbar { 
          width: 6px; 
          height: 6px; 
        }
        ::-webkit-scrollbar-track { 
          background: transparent; 
        }
        ::-webkit-scrollbar-thumb { 
          background: #fed7aa; 
          border-radius: 10px; 
        }
        ::-webkit-scrollbar-thumb:hover { 
          background: #FF7835; 
        }

        .nav-btn:active { 
          transform: scale(0.95); 
          opacity: 0.7; 
        }
        
        @media (max-width: 768px) {
          .header-title { 
            font-size: 16px !important; 
          }
          .live-clock { 
            display: none !important; 
          }
          
          .desktop-row-mobile-col { 
            flex-direction: column !important; 
            overflow-y: auto !important; 
            padding-bottom: 80px !important; 
            gap: 8px !important; 
          }
          .mobile-reverse { 
            flex-direction: column-reverse !important; 
            justify-content: flex-start !important; 
          }
          
          .kasir-left-panel { 
            height: 35vh !important; 
            flex: none !important; 
            border-bottom: 2px solid #e2e8f0; 
          }
          .kasir-right-panel { 
            height: auto !important; 
            flex: none !important; 
          }
          
          .kasir-tools input, .kasir-tools button { 
            padding: 10px 8px !important; 
            font-size: 12px !important; 
            height: 40px !important; 
            box-sizing: border-box !important; 
          }
          
          /* PENYESUAIAN GRID & KOTAK PRODUK DI HP */
          .kasir-left-panel .grid-container { 
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; 
            gap: 8px !important; 
          }
          .kasir-left-panel .grid-container > div { 
            padding: 10px !important; 
            border-radius: 8px !important; 
            height: 110px !important; 
          }
          .kasir-left-panel .grid-container > div h3 { 
            font-size: 12px !important; 
            height: 28px !important; 
          }
          .kasir-left-panel .grid-container > div .harga-text { 
            font-size: 14px !important; 
          }
          
          .table-section { 
            min-height: 40vh !important; 
            flex: 1 !important; 
            margin-top: 0 !important;
          }
          
          .form-section { 
            height: auto !important; 
            max-height: none !important; 
            overflow-y: visible !important; 
            flex: none !important; 
            margin-bottom: 0 !important;
          }
          
          /* DIET FORM (Hanya di HP) */
          .diet-form .form-title {
            font-size: 16px !important;
            margin-bottom: 12px !important;
          }
          .diet-form .form-label {
            font-size: 11px !important;
            margin-bottom: 4px !important;
          }
          .diet-form .form-input {
            padding: 8px 10px !important;
            font-size: 12px !important;
            margin-bottom: 10px !important;
            height: 38px !important;
          }
          .diet-form .form-row {
            margin-bottom: 10px !important;
            gap: 8px !important;
          }
          .diet-form .barcode-row {
            margin-bottom: 16px !important;
          }
          .diet-form .form-btn-submit {
            padding: 10px !important;
            font-size: 12px !important;
            height: 40px !important;
          }
          
          /* ATURAN KAMERA (Tetap Memanjang/Persegi Panjang, Tidak Kotak) */
          #reader-kasir, #reader-toko { 
            width: 100% !important; 
            height: 200px !important; 
            border-radius: 8px !important; 
            overflow: hidden !important; 
            border: 2px solid #FF7835 !important; 
            position: relative !important;
            background: black !important;
          }
          #reader-kasir video, #reader-toko video { 
            object-fit: cover !important; 
            width: 100% !important; 
            height: 100% !important; 
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default App;