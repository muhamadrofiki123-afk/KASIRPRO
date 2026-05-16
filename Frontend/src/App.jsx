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

// --- CONFIG FIREBASE ASLI MILIK MAS ROFIKI ---
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

// === MESIN SUARA GLOBAL (SINGLETON) ===
let globalAudioCtx = null;

function App() {

  // === STATE AUTENTIKASI ===
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  // === PENGATURAN TOKO & SUARA (DIRAPIKAN AGAR TIDAK GANDA) ===
  const [minBelanjaPoin, setMinBelanjaPoin] = useState(20000); 
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

  // --- MESIN SUARA INTERNAL (WEB AUDIO API) ---
  const playBeep = () => {
    if (!soundBeep) return; 
    try {
      if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const osc = globalAudioCtx.createOscillator();
      const gain = globalAudioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, globalAudioCtx.currentTime); 
      gain.gain.setValueAtTime(0, globalAudioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, globalAudioCtx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, globalAudioCtx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(globalAudioCtx.destination);
      osc.start();
      osc.stop(globalAudioCtx.currentTime + 0.1);
    } catch (e) { console.log("Audio Error"); }
  };

  const playSuccessVoice = (text) => {
    if (!soundVoice) return; 
    try {
      const msg = new SpeechSynthesisUtterance();
      msg.text = text;
      msg.lang = 'id-ID'; 
      msg.rate = 1.1;
      window.speechSynthesis.speak(msg);
    } catch (e) { console.log("Speech Error"); }
  };

  // === STATE GLOBAL & SIDEBAR HAMBURGER ===
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);
  const [showOfflineWarning, setShowOfflineWarning] = useState(!window.navigator.onLine);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // === STATE DATABASE UTAMA ===
  const [produk, setProduk] = useState([]);
  const [transaksi, setTransaksi] = useState([]);
  const [pengeluaran, setPengeluaran] = useState([]); 
  const [pelanggan, setPelanggan] = useState([]); 
  
  // === STATE KERANJANG KASIR & LOYALTI POIN ===
  const [cart, setCart] = useState(() => {
    try { 
      const saved = localStorage.getItem('kasirCart'); 
      return saved ? JSON.parse(saved) : []; 
    } catch(e) { 
      return []; 
    }
  });
  
  const [memberTerpilih, setMemberTerpilih] = useState(null);
  const [gunakanPoin, setGunakanPoin] = useState(false);
  
  const [search, setSearch] = useState('');
  const [searchProduk, setSearchProduk] = useState(''); 
  const [searchPengeluaran, setSearchPengeluaran] = useState('');
  const [searchLaporan, setSearchLaporan] = useState('');
  const [searchPelanggan, setSearchPelanggan] = useState(''); 
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
  const [showMemberModal, setShowMemberModal] = useState(false);

  // === STATE KEAMANAN & PIN (TAHAP 1) ===
  const [isReportLocked, setIsReportLocked] = useState(() => {
    const saved = localStorage.getItem('pos_isReportLocked');
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [savedPin, setSavedPin] = useState(() => localStorage.getItem('pos_savedPin') || '');
  
  const [showPinModal, setShowPinModal] = useState(false);
  const [isForgotPinMode, setIsForgotPinMode] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinAction, setPinAction] = useState(''); // Menyimpan aksi (buka laporan, matikan gembok, dll)
  const [tempTargetTab, setTempTargetTab] = useState(''); // Menyimpan tujuan tab sementara

  // Menyimpan otomatis status gembok & PIN ke penyimpanan browser
  useEffect(() => { localStorage.setItem('pos_isReportLocked', JSON.stringify(isReportLocked)); }, [isReportLocked]);
  useEffect(() => { localStorage.setItem('pos_savedPin', savedPin); }, [savedPin]);

  // === MESIN PEMROSES PIN (TAHAP 2) ===
  const handlePinSubmit = (e) => {
    if (e) e.preventDefault();
    if (!pinInput) return;

    if (pinAction === 'verify_tab') {
      if (pinInput === savedPin) {
        setActiveTab(tempTargetTab);
        setShowPinModal(false);
        setPinInput('');
      } else {
        alert('❌ PIN yang Anda masukkan SALAH!');
        setPinInput('');
      }
    } else if (pinAction === 'turn_off_lock') {
      if (pinInput === savedPin) {
        setIsReportLocked(false);
        setShowPinModal(false);
        setPinInput('');
        alert('🔓 Gembok berhasil dinonaktifkan.');
      } else {
        alert('❌ PIN yang Anda masukkan SALAH!');
        setPinInput('');
      }
    } else if (pinAction === 'create_pin') {
      if (pinInput.length < 4) { alert('⚠️ PIN minimal 4 angka!'); return; }
      setSavedPin(pinInput);
      setIsReportLocked(true);
      setShowPinModal(false);
      setPinInput('');
      alert('🔒 PIN berhasil dibuat! Gembok laporan sekarang AKTIF.');
    }
  };

  const handleNumpad = (num) => {
    if (num === 'del') {
      setPinInput(prev => prev.slice(0, -1));
    } else if (num === 'ok') {
      handlePinSubmit();
    } else {
      if (pinInput.length < 6) setPinInput(prev => prev + num);
    }
  };

  // === SATPAM NAVIGASI (TAHAP 3) ===
  const handleNavClick = (tabName) => {
    // Jika gembok aktif dan yang diklik adalah menu rahasia
    if (isReportLocked && (tabName === 'laporan' || tabName === 'pengeluaran')) {
      setTempTargetTab(tabName);
      setPinAction('verify_tab');
      setShowPinModal(true);
    } else {
      // Jika aman, langsung buka halamannya
      setActiveTab(tabName);
    }
  };
  
  // === STATE PRINT ===
  const [strukData, setStrukData] = useState(null);
  const [printMode, setPrintMode] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [strukPengeluaran, setStrukPengeluaran] = useState(null); 

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
  const [hargaModalProd, setHargaModalProd] = useState('');
  const [statusBarcode, setStatusBarcode] = useState('');
  
  // CCTV PEMANTAU BARCODE (Bisa untuk Semua Ukuran Barcode & Kamera HP)
  useEffect(() => {
    // Syarat: Barcode harus ada dan minimal 8 digit (ukuran barcode paling pendek)
    if (barcodeProd && barcodeProd.length >= 8) {
      
      // Mesin menahan napas (menunggu) 0.8 detik setelah angka terakhir masuk
      const jedaPencarian = setTimeout(() => {
        setStatusBarcode('⏳ Mencari di internet...');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        fetch(`https://world.openfoodfacts.org/api/v0/product/${barcodeProd}.json`, { signal: controller.signal })
          .then(res => res.json())
          .then(data => {
            clearTimeout(timeoutId);
            if (data.status === 1 && data.product && data.product.product_name) {
              setNamaProd(data.product.product_name); // Pastikan ini nama state Mas Rofiki
              setStatusBarcode('✅ Produk Ditemukan!');
              setTimeout(() => setStatusBarcode(''), 1500);
            } else {
              setStatusBarcode('❌ Tidak terdaftar, ketik manual');
              setTimeout(() => setStatusBarcode(''), 2000);
            }
          }).catch(() => {
            clearTimeout(timeoutId);
            setStatusBarcode('❌ Gagal memuat/timeout');
            setTimeout(() => setStatusBarcode(''), 2000);
          });
      }, 800); // 800 milidetik = 0.8 detik waktu tunggu

      // Kalau angkanya berubah (Masih ngetik/scan), batalkan pencarian yang lama biar gak dobel
      return () => clearTimeout(jedaPencarian);
    }
  }, [barcodeProd]); // CCTV memantau setiap perubahan angka
  
  const [stokProd, setStokProd] = useState('');
  const [barcodeProd, setBarcodeProd] = useState('');
  const [satuanProd, setSatuanProd] = useState('Pcs'); 
  const [editingProductId, setEditingProductId] = useState(null);

  // === STATE FORM PELANGGAN BARU ===
  const [formPelangganNama, setFormPelangganNama] = useState('');
  const [formPelangganWa, setFormPelangganWa] = useState('');
  const [formPelangganEmail, setFormPelangganEmail] = useState('');
  const [formPelangganAlamat, setFormPelangganAlamat] = useState('');
  const [editingPelangganId, setEditingPelangganId] = useState(null);

  // === STATE SORTIR & CETAK PILIHAN ===
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [sortOrder, setSortOrder] = useState('terbaru');

  // === STATE CHART / GRAFIK / DASHBOARD ===
  const [chartVisualType, setChartVisualType] = useState('bar');
  const [chartFilter, setChartFilter] = useState('hari'); 
  const [reportFilter, setReportFilter] = useState('hari');
  const [dashboardTimeFilter, setDashboardTimeFilter] = useState('hari_ini'); 

  // === STATE FILTER KHUSUS PENGELUARAN (TANGGAL KUSTOM) ===
  const [pengeluaranStart, setPengeluaranStart] = useState('');
  const [pengeluaranEnd, setPengeluaranEnd] = useState('');

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

  const produkRef = useRef(produk);
  useEffect(() => { 
    produkRef.current = produk; 
  }, [produk]);
  // PENGATURAN JAM OTOMATIS & SENSOR KONEKSI
  useEffect(() => {
    setIsOnline(navigator.onLine);
    setShowOfflineWarning(!navigator.onLine);

    const goOnline = () => { setIsOnline(true); setShowOfflineWarning(false); };
    const goOffline = () => { setIsOnline(false); setShowOfflineWarning(true); };
    
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, []);

  // === SENSOR KEYBOARD KHUSUS STRUK (ENTER / ESC) ===
  useEffect(() => {
    const handleStrukKeys = (e) => {
      if (strukData || strukPengeluaran) {
        if (e.key === 'Escape') {
          e.preventDefault(); setStrukData(null); setStrukPengeluaran(null);
        } else if (e.key === 'Enter') {
          e.preventDefault(); window.print(); 
        }
      }
    };
    
    window.addEventListener('keydown', handleStrukKeys);
    return () => window.removeEventListener('keydown', handleStrukKeys);
  }, [strukData, strukPengeluaran]);

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
        } else {
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
        if (nextElement) nextElement.focus();
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
        setPesanStruk(d.data().pesanStruk || 'TERIMA KASIH'); 
        setLabelWidth(d.data().labelWidth || 185); 
        setLabelHeight(d.data().labelHeight || 95);
        setLabelScale(d.data().labelScale || 100); 
        setLabelGap(d.data().labelGap || 5); 
        setLabelColumns(d.data().labelCols || 4);
        setMinBelanjaPoin(d.data().minBelanjaPoin || 20000);
      }
    });

    const unsubProduk = onSnapshot(query(collection(db, "produk"), where("userId", "==", user.uid)), (snap) => {
      setProduk(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qTrans = query(collection(db, "transaksi"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubTrans = onSnapshot(qTrans, (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const tA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const tB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return tB - tA;
        });
        setTransaksi(data);
    });

    const qPeng = query(collection(db, "pengeluaran"), where("userId", "==", user.uid), orderBy("waktu", "desc"), limit(500));
    const unsubPengeluaran = onSnapshot(qPeng, (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        data.sort((a, b) => {
          const tA = a.waktu?.toMillis ? a.waktu.toMillis() : Date.now();
          const tB = b.waktu?.toMillis ? b.waktu.toMillis() : Date.now();
          return tB - tA;
        });
        setPengeluaran(data);
    });

    const unsubPelanggan = onSnapshot(query(collection(db, "pelanggan"), where("userId", "==", user.uid)), (snap) => {
      setPelanggan(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { 
      unsubProduk(); 
      unsubTrans(); 
      unsubPengeluaran(); 
      unsubPelanggan(); 
    };
  }, [user]);

  // EFFECT: HITUNG STATISTIK DASHBOARD
  useEffect(() => {
    if (!user) return;
    
    const now = new Date();
    let startDate = new Date(); 
    let endDate = new Date();
    
    if (dashboardTimeFilter === 'hari_ini') {
      startDate.setHours(0, 0, 0, 0); 
      endDate.setHours(23, 59, 59, 999);
    } else if (dashboardTimeFilter === 'kemarin') {
      startDate.setDate(startDate.getDate() - 1); 
      startDate.setHours(0, 0, 0, 0);
      endDate.setDate(endDate.getDate() - 1); 
      endDate.setHours(23, 59, 59, 999);
    } else if (dashboardTimeFilter === 'minggu_ini') {
      const day = startDate.getDay(); 
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff); 
      startDate.setHours(0, 0, 0, 0); 
      endDate.setHours(23, 59, 59, 999);
    } else if (dashboardTimeFilter === 'bulan_ini') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); 
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dashboardTimeFilter === 'tahun_ini') {
      startDate = new Date(now.getFullYear(), 0, 1); 
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    const fTrans = transaksi.filter(t => {
      if(!t.waktu || !t.waktu.toDate) return false;
      const tDate = t.waktu.toDate(); 
      return tDate >= startDate && tDate <= endDate;
    });
    
    const fPeng = pengeluaran.filter(p => {
      if(!p.waktu || !p.waktu.toDate) return false;
      const pDate = p.waktu.toDate(); 
      return pDate >= startDate && pDate <= endDate;
    });
    
    const omzet = fTrans.filter(t => t.metode !== 'Bon' || t.statusBon === 'Lunas').reduce((sum, t) => sum + t.total, 0);
    const totModal = fTrans.filter(t => t.metode !== 'Bon' || t.statusBon === 'Lunas').reduce((sM, t) => {
       const mTr = t.items.reduce((sI, i) => sI + (Number(i.hargaModal || 0) * i.qty), 0); 
       return sM + mTr;
    }, 0);
    const totPengOp = fPeng.reduce((sum, p) => sum + p.nominal, 0);

    setDashboardStats({
      totalProducts: produk.length, 
      lowStock: produk.filter(p => p.stok < 50).length,
      todaySales: omzet, 
      totalPengeluaran: totPengOp, 
      labaBersih: omzet - totModal - totPengOp
    });
  }, [produk, transaksi, pengeluaran, user, dashboardTimeFilter]);

  const addToCartRef = useRef();
  useEffect(() => { 
    addToCartRef.current = addToCart; 
  }, [cart]);

  // --- FUNGSI KAMERA ---
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
          undefined
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
    if (typeof playBeep === 'function') playBeep();
    
    const hargaAktif = p.hargaPromo ? Number(p.hargaPromo) : Number(p.harga);
    
    setCart(prev => {
      const existing = prev.find(item => item.id === p.id);
      if (existing) {
        if(existing.qty >= p.stok) { 
          alert("Stok tidak mencukupi!"); 
          return prev; 
        }
        return prev.map(item => item.id === p.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...p, harga: hargaAktif, hargaAsli: p.harga, hargaModal: p.hargaModal || 0, qty: 1 }];
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

  // === KALKULASI POIN & TOTAL KERANJANG ===
  const totalAmountVal = cart.reduce((sum, item) => sum + (item.harga * item.qty), 0);
  
  let totalSetelahDiskon = totalAmountVal;
  let diskonPoin = 0;
  let poinDipakai = 0;
  let poinDidapat = 0;

  if (memberTerpilih && gunakanPoin) {
    diskonPoin = (memberTerpilih.poin || 0) * 100; // 1 Poin = Rp 100
    if (diskonPoin > totalAmountVal) {
      diskonPoin = totalAmountVal;
    }
    poinDipakai = Math.ceil(diskonPoin / 100);
    totalSetelahDiskon = totalAmountVal - diskonPoin;
  } else if (memberTerpilih && !gunakanPoin) {
    const syaratPoin = Number(minBelanjaPoin) || 20000;
    poinDidapat = Math.floor(totalAmountVal / syaratPoin);
  }

  const kembalianVal = (metodePembayaran === 'Tunai' && paymentAmount !== '') ? Number(paymentAmount) - totalSetelahDiskon : 0;

  const processPayment = () => {
    if (cart.length === 0) return alert('Keranjang kosong!');
    if (metodePembayaran === 'Tunai' && Number(paymentAmount) < totalSetelahDiskon) return alert('Uang bayar kurang!');
    
    if (metodePembayaran === 'Bon') {
      if (memberTerpilih) {
        finalizePayment('Bon');
      } else {
        setShowBonModal(true); 
      }
    } else {
      finalizePayment(metodePembayaran); 
    }
  };

  const finalizePayment = async (metode) => {
    const finalUangBayar = metode === 'Tunai' ? Number(paymentAmount) : totalSetelahDiskon;
    
    const dataTrans = {
      userId: user.uid, 
      waktu: new Date(),
      totalKotor: totalAmountVal,
      diskonPoin: diskonPoin,
      poinDipakai: poinDipakai,
      poinDidapat: poinDidapat,
      total: totalSetelahDiskon, 
      uangBayar: finalUangBayar, 
      kembalian: kembalianVal, 
      metode: metode, 
      idMember: memberTerpilih ? memberTerpilih.id : null,
      namaPelanggan: memberTerpilih ? memberTerpilih.nama : (metode === 'Bon' ? namaPelangganBon : '-'),
      items: cart.map(i => ({
        idProduk: i.id,
        nama: i.nama, 
        harga: i.harga, 
        hargaAsli: i.hargaAsli, 
        hargaModal: i.hargaModal || 0, 
        qty: i.qty, 
        satuan: i.satuan || 'Pcs'
      }))
    };

    if (metode === 'Bon') {
      if (!dataTrans.namaPelanggan || dataTrans.namaPelanggan.trim() === '-' || dataTrans.namaPelanggan.trim() === '') {
        return alert("Nama pelanggan wajib diisi untuk Bon!");
      }
      dataTrans.statusBon = 'Belum Lunas';
    }

    try {
      // 1. SUARA ROBOT JALAN DULUAN
      if (typeof playSuccessVoice === 'function') {
        playSuccessVoice(`Terima kasih, transaksi berhasil. Total harga ${totalSetelahDiskon.toLocaleString()} rupiah.`);
      }

      // 2. BERSIHKAN LAYAR & MUNCULKAN STRUK INSTAN
      const keranjangSementara = [...cart]; 
      setStrukData(dataTrans); 
      setCart([]); 
      setPaymentAmount(''); 
      setMetodePembayaran('Tunai'); 
      setShowQrisModal(false); 
      setShowBonModal(false); 
      setNamaPelangganBon(''); 
      setMemberTerpilih(null); 
      setGunakanPoin(false);

      // 3. PROSES DATABASE DI BELAKANG (Firebase)
      await addDoc(collection(db, "transaksi"), dataTrans);
      
      for (const item of keranjangSementara) { 
        await updateDoc(doc(db, "produk", item.id), { stok: increment(-item.qty) }); 
      }

      if (memberTerpilih) {
        const memberRef = doc(db, "pelanggan", memberTerpilih.id);
        if (gunakanPoin && poinDipakai > 0) {
           await updateDoc(memberRef, { poin: increment(-poinDipakai) });
        } else if (!gunakanPoin && poinDidapat > 0) {
           await updateDoc(memberRef, { poin: increment(poinDidapat) });
        }
      }
      
    } catch (err) { 
      console.log("Antrean Offline: " + err.message); 
    }
  };

  const simpanPelanggan = async (e) => {
    e.preventDefault();
    try {
      if (editingPelangganId) {
        await updateDoc(doc(db, "pelanggan", editingPelangganId), {
          nama: formPelangganNama, wa: formPelangganWa, email: formPelangganEmail, alamat: formPelangganAlamat
        });
        setEditingPelangganId(null);
      } else {
        await addDoc(collection(db, "pelanggan"), {
          nama: formPelangganNama, wa: formPelangganWa, email: formPelangganEmail, alamat: formPelangganAlamat,
          poin: 0, userId: user.uid, createdAt: new Date()
        });
      }
      setFormPelangganNama(''); setFormPelangganWa(''); setFormPelangganEmail(''); setFormPelangganAlamat('');
      // alert("✅ Data Member Berhasil Disimpan!");
      setShowMemberModal(false); 
    } catch (error) {
      alert("❌ Gagal menyimpan data: " + error.message);
    }
  };

  const simpanProduk = (e) => {
    e.preventDefault();
    const promoVal = hargaPromoProd ? Number(hargaPromoProd) : null;
    const modalVal = hargaModalProd ? Number(hargaModalProd) : 0;
    
    if (editingProductId) {
      const checkDuplicate = produk.find(p => p.barcode === barcodeProd && barcodeProd !== "" && p.id !== editingProductId);
      if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      
      updateDoc(doc(db, "produk", editingProductId), { 
        nama: namaProd, harga: Number(hargaProd), hargaPromo: promoVal, hargaModal: modalVal, 
        stok: Number(stokProd), barcode: barcodeProd, satuan: satuanProd 
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
            const num = Math.floor(Math.random() * 10).toString(); tempCode += num + num; 
          }
          const checkExists = produk.find(p => p.barcode === tempCode);
          if (!checkExists) { bcode = tempCode; isUnique = true; }
          attempt++;
        }
        if (!bcode) bcode = Math.floor(100000000000 + Math.random() * 900000000000).toString(); 
      } else {
        const checkDuplicate = produk.find(p => p.barcode === bcode);
        if (checkDuplicate) return alert("⚠️ Barcode sudah digunakan oleh produk lain!");
      }
      
      addDoc(collection(db, "produk"), { 
        nama: namaProd, harga: Number(hargaProd), hargaPromo: promoVal, hargaModal: modalVal, 
        stok: Number(stokProd), barcode: bcode, satuan: satuanProd, userId: user.uid, createdAt: new Date() 
      });
    }
    setNamaProd(''); setHargaProd(''); setHargaPromoProd(''); setHargaModalProd('');
    setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs');
  };

  const simpanPengeluaran = (e) => {
    e.preventDefault();
    addDoc(collection(db, "pengeluaran"), { 
      nama: namaPengeluaran, nominal: Number(nominalPengeluaran), userId: user.uid, waktu: new Date() 
    });
    // alert("Pengeluaran berhasil dicatat!");
    setNamaPengeluaran(''); setNominalPengeluaran(''); 
  };

  const simpanProfil = () => {
    setDoc(doc(db, "profilToko", user.uid), { 
      nama: namaToko, alamat, noTelp, qrisImage, pesanStruk,
      minBelanjaPoin: Number(minBelanjaPoin),
      labelWidth: Number(labelWidth), labelHeight: Number(labelHeight),
      labelScale: Number(labelScale), labelGap: Number(labelGap), labelCols: Number(labelCols)
    });
    // alert("Profil & Pengaturan Toko Tersimpan!"); 
    setShowProfileModal(false);
  };

  const handleResetTahunan = async () => {
    if (!window.confirm(`⚠️ PERINGATAN TERAKHIR: Apakah Anda yakin ingin menghapus SEMUA transaksi pada tahun ${selectedYearReset}? Tindakan ini permanen!`)) return;
    const startOfYear = new Date(`${selectedYearReset}-01-01T00:00:00`);
    const endOfYear = new Date(`${selectedYearReset}-12-31T23:59:59`);
    try {
      const qReset = query(collection(db, "transaksi"), where("userId", "==", user.uid), where("waktu", ">=", startOfYear), where("waktu", "<=", endOfYear));
      const snapshot = await getDocs(qReset);
      if (snapshot.empty) return alert(`Tidak ada data di tahun ${selectedYearReset}.`);
      let deletedCount = 0;
      for (const document of snapshot.docs) { deleteDoc(doc(db, "transaksi", document.id)); deletedCount++; }
      alert(`Berhasil! ${deletedCount} transaksi di tahun ${selectedYearReset} telah dihapus.`);
      setShowResetModal(false);
    } catch (error) { alert("Gagal menghapus data."); }
  };

  const pengeluaranTersaring = pengeluaran.filter(p => {
    if (!p.nama.toLowerCase().includes(searchPengeluaran.toLowerCase())) return false;
    if (!pengeluaranStart || !pengeluaranEnd) return true;
    const pDate = p.waktu?.toDate ? p.waktu.toDate() : new Date(p.waktu);
    const sDate = new Date(pengeluaranStart); sDate.setHours(0,0,0,0);
    const eDate = new Date(pengeluaranEnd); eDate.setHours(23,59,59,999);
    return pDate >= sDate && pDate <= eDate;
  });
  
  const totalPengeluaranTersaring = pengeluaranTersaring.reduce((sum, p) => sum + p.nominal, 0);

  const filteredTransaksi = transaksi.filter(t => {
    if (!t.waktu) return false;
    const cari = searchLaporan.toLowerCase();
    const matchCari = cari === '' || t.items.some(i => i.nama.toLowerCase().includes(cari)) || (t.metode && t.metode.toLowerCase().includes(cari)) || (t.namaPelanggan && t.namaPelanggan.toLowerCase().includes(cari));
    if (!matchCari) return false;

    const dateObj = t.waktu.toDate ? t.waktu.toDate() : new Date(); 
    const today = new Date();
    
    if (reportFilter === 'hari') return dateObj.toDateString() === today.toDateString();
    else if (reportFilter === 'minggu') return dateObj >= new Date(today.setDate(today.getDate() - today.getDay()));
    else if (reportFilter === 'bulan') return dateObj.getMonth() === today.getMonth() && dateObj.getFullYear() === today.getFullYear();
    return true;
  });

  const displayedLaporan = laporanTab === 'bon' ? filteredTransaksi.filter(t => t.metode === 'Bon' && t.statusBon !== 'Lunas') : filteredTransaksi;
  const pelangganTersaring = pelanggan.filter(p => p.nama.toLowerCase().includes(searchPelanggan.toLowerCase()) || (p.wa && p.wa.includes(searchPelanggan)));

  const exportExcelTrans = () => {
    const headers = ["Tanggal", "Jam", "Metode Pembayaran", "Nama Pelanggan", "Status", "Items", "Diskon Poin", "Total", "Laba Kotor"];
    const rows = displayedLaporan.map(t => {
      const d = t.waktu?.toDate ? t.waktu.toDate() : new Date();
      const items = t.items.map(i => `${i.qty} ${i.satuan || 'Pcs'} ${i.nama}`).join(' + ');
      const labaKotor = t.items.reduce((sum, item) => sum + ((item.harga - (item.hargaModal || 0)) * item.qty), 0);
      return [ d.toLocaleDateString('id-ID'), d.toLocaleTimeString('id-ID'), t.metode || 'Tunai', `"${t.namaPelanggan || '-'}"`, `"${t.statusBon || '-'}"`, `"${items}"`, t.diskonPoin || 0, t.total, labaKotor ].join(';');
    });
    const csvStr = "\uFEFF" + headers.join(';') + "\n" + rows.join("\n");
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Laporan_${laporanTab === 'bon' ? 'Bon' : 'Transaksi'}_Kasir.csv`; link.click();
  };

  const exportExcelPengeluaran = () => {
    const headers = ["Tanggal", "Waktu", "Keterangan", "Nominal"];
    const rows = pengeluaranTersaring.map(p => {
      const d = p.waktu?.toDate ? p.waktu.toDate() : new Date();
      return [ d.toLocaleDateString('id-ID'), d.toLocaleTimeString('id-ID'), `"${p.nama}"`, p.nominal ].join(';');
    });
    const totalRow = ["", "", "TOTAL KESELURUHAN", totalPengeluaranTersaring].join(';');
    const csvStr = "\uFEFF" + headers.join(';') + "\n" + rows.join("\n") + "\n" + totalRow;
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Laporan_Pengeluaran.csv`; link.click();
  };
  
  const exportExcelPelanggan = () => {
    const headers = ["Nama Pelanggan", "WhatsApp", "Poin", "Email", "Alamat", "Tanggal Daftar"];
    const rows = pelangganTersaring.map(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString('id-ID') : '-';
      return [ `"${p.nama}"`, `"${p.wa || '-'}"`, p.poin || 0, `"${p.email || '-'}"`, `"${p.alamat || '-'}"`, `"${d}"` ].join(';');
    });
    const csvStr = "\uFEFF" + headers.join(';') + "\n" + rows.join("\n");
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob);
    link.download = `Data_Member_Pelanggan.csv`; link.click();
  };

  const getChartData = () => {
    let labels = []; let values = []; const now = new Date();
    if (chartFilter === 'jam') {
      const todayTrans = transaksi.filter(t => t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === now.toDateString());
      for(let i=8; i<=22; i+=2) { 
        labels.push(`${i}:00`); values.push(todayTrans.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu.toDate().getHours() >= i && t.waktu.toDate().getHours() < i+2).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'hari') {
      for(let i=6; i>=0; i--) { 
        const d = new Date(now); d.setDate(d.getDate() - i); labels.push(`${d.getDate()}/${d.getMonth()+1}`); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().toDateString() === d.toDateString()).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'bulan') {
      for(let i=5; i>=0; i--) { 
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1); labels.push(d.toLocaleString('default', { month: 'short' })); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getMonth() === d.getMonth() && t.waktu.toDate().getFullYear() === d.getFullYear()).reduce((s, t) => s + t.total, 0)); 
      }
    } else if (chartFilter === 'tahun') {
      for(let i=4; i>=0; i--) { 
        const year = now.getFullYear() - i; labels.push(year); 
        values.push(transaksi.filter(t => (t.metode !== 'Bon' || t.statusBon === 'Lunas') && t.waktu && t.waktu.toDate && t.waktu.toDate().getFullYear() === year).reduce((s, t) => s + t.total, 0)); 
      }
    }
    return { data: labels.map((l, i) => ({ label: l, total: values[i] })), max: Math.max(...values, 1) };
  };

  const chartDataFinal = getChartData();

  const getTopProductsVal = () => {
     const pS = {};
     transaksi.forEach(t => {
         if(t.metode === 'Bon' && t.statusBon !== 'Lunas') return;
         t.items.forEach(i => {
             const k = i.nama; const laba = (i.harga - (i.hargaModal || 0)) * i.qty;
             if(!pS[k]) pS[k] = { nama: i.nama, qty: i.qty, laba: laba }; 
             else { pS[k].qty += i.qty; pS[k].laba += laba; }
         });
     });
     return Object.values(pS).sort((a, b) => b.qty - a.qty).slice(0, 10);
  };
  const topProductsFinal = getTopProductsVal();

  const filteredAndSortedProduk = [...produk].filter(p => {
    if (!searchProduk) return true;
    const k = searchProduk.toLowerCase(); return p.nama.toLowerCase().includes(k) || p.barcode.includes(k);
  }).sort((a, b) => {
    if (sortOrder === 'terbaru') return (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
    return a.nama.localeCompare(b.nama);
  });

  const toggleSelectProduct = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  // === TAMPILAN: LOADING & LOGIN ===
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', flexDirection: 'column', textAlign: 'center' }}>
        {/* Spinner Animasi */}
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #FF7835', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        
        {/* Teks Selamat Datang */}
        <h2 style={{ marginTop: '20px', color: '#272734', fontWeight: '900', letterSpacing: '1px' }}>
          SELAMAT DATANG
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Sedang menyiapkan dashboard Anda...</p>
        
        <style>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ 
        minHeight: '100vh', position: 'relative', backgroundColor: '#FF7835', 
        backgroundImage: bgLogin ? `url(${bgLogin})` : "url('https://images.unsplash.com/photo-1556740734-7f9a2b7a0f4d?auto=format&fit=crop&q=80&w=2070')", 
        backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: "'Inter', sans-serif" 
      }}>
        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)', zIndex: 1 }}></div>
        <div style={{ background: 'white', padding: '48px 40px', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', width: '100%', maxWidth: '420px', zIndex: 10, position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#FF7835', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '10px' }}>Selamat Datang di Aplikasi</div>
            <h1 style={{ fontSize: '30px', fontWeight: '900', color: '#272734', margin: 0 }}>POS MODERN PRO</h1>
            <p style={{ color: '#27274F', fontSize: '14px', margin: '8px 0 0 0', fontWeight: '600' }}>UMKM Digital Solution</p>
          </div>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '20px' }}>
              <input type="email" placeholder="Alamat Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '16px 20px', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '16px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', background: '#272734', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 10px 15px -3px rgba(39, 39, 52, 0.4)' }}>
              {isRegister ? 'BUAT AKUN BARU' : 'MASUK KE SISTEM'}
            </button>
          </form>
          <p onClick={() => setIsRegister(!isRegister)} style={{ cursor: 'pointer', color: '#FF7835', marginTop: '24px', textAlign: 'center', fontSize: '14px', fontWeight: '700' }}>
            {isRegister ? 'Sudah punya akun? Login' : 'Belum punya akun? Daftar disini'}
          </p>
        </div>
      </div>
    );
  }

  // === TAMPILAN UTAMA APLIKASI ===
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif", background: '#f8fafc', overflow: 'hidden' }}>
      
      {/* --- HEADER --- */}
      <header className="no-print" style={{ flex: 'none', height: '70px', background: 'white', padding: '0 24px', boxShadow: '0 2px 10px rgba(0, 0, 0, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 40, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
          <button tabIndex="0" onClick={() => setIsSidebarOpen(true)} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#272734', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>☰</button>
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <h1 className="header-title" style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#FF7835', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{namaToko || 'POS MODERN PRO'}</h1>
            <p className="header-email" style={{ margin: '0', color: '#27274F', fontSize: '11px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Akun: {user.email}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 'none' }}>
          <div className="live-clock" style={{ textAlign: 'right', paddingRight: '16px', borderRight: '2px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="date-text" style={{ fontSize: '11px', fontWeight: '700', color: '#64748b' }}>{currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}</div>
            <div className="time-text" style={{ fontSize: '15px', fontWeight: '900', color: '#272734', letterSpacing: '0.5px' }}>{currentTime.toLocaleTimeString('id-ID')}</div>
          </div>
          <button onClick={() => setShowHelpModal(true)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#475569', marginRight: '8px' }}>❓</button>
          <button tabIndex="0" onClick={() => setShowProfileModal(true)} style={{ background: '#fff7ed', border: '1px solid #FF7835', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', cursor: 'pointer', color: '#FF7835' }}>👤</button>
        </div>
      </header>

      {/* --- SIDEBAR HAMBURGER MENU --- */}
      <div className="no-print" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: isSidebarOpen ? 'block' : 'none', transition: 'opacity 0.3s' }} onClick={() => setIsSidebarOpen(false)}>
        <div style={{ width: '280px', height: '100%', background: 'white', display: 'flex', flexDirection: 'column', transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform 0.3s ease-in-out', boxShadow: '5px 0 15px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '24px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', letterSpacing: '1px' }}>MENU UTAMA</h2>
              <p style={{ margin: 0, fontSize: '12px', opacity: 0.9, fontWeight: '600' }}>POS Modern Pro</p>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '28px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
          <div style={{ flex: 1, padding: '16px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
  {[ 
    { id: 'dashboard', label: 'Dashboard', icon: '📊' }, 
    { id: 'kasir', label: 'Kasir & Transaksi', icon: '💰' }, 
    { id: 'toko', label: 'Database Produk', icon: '📦' }, 
    { id: 'pengeluaran', label: 'Arus Kas / Biaya', icon: '💸' }, 
    { id: 'laporan', label: 'Laporan Penjualan', icon: '📉' }, 
    { id: 'pelanggan', label: 'CRM & Pelanggan', icon: '👥' } 
  ].map(tab => (
    <button 
      key={tab.id} 
      onClick={() => { 
        handleNavClick(tab.id); // <-- Ini kuncinya, memanggil fungsi Satpam
        setIsSidebarOpen(false); 
      }} 
      style={{ background: activeTab === tab.id ? '#fff7ed' : 'transparent', color: activeTab === tab.id ? '#FF7835' : '#475569', border: 'none', borderRight: activeTab === tab.id ? '4px solid #FF7835' : '4px solid transparent', padding: '16px 24px', textAlign: 'left', fontSize: '15px', fontWeight: activeTab === tab.id ? '800' : '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '16px', transition: 'background 0.2s, color 0.2s' }}
    >
      <span style={{ fontSize: '20px' }}>{tab.icon}</span>
      
      {/* Ini akan memunculkan teks nama menunya (misal: Laporan Penjualan) */}
      {tab.label} 
      
      {isReportLocked && (tab.id === 'laporan' || tab.id === 'pengeluaran') && (
        <span style={{ marginLeft: 'auto', fontSize: '14px' }}>🔒</span>
      )}
    </button>
  ))}
</div>
          
          <div style={{ padding: '24px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#94a3b8', textAlign: 'center', fontWeight: '600' }}>Aplikasi Kasir V.2.0<br/>© 2026 Muhamad Rofiki</div>
        </div>
      </div>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          
        {/* --- TAB DASHBOARD --- */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-container" style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', width: '100%', overflow: 'hidden' }}>
            <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
               <h2 style={{margin: 0, color: '#272734', fontWeight: '900'}}>🎯 Ringkasan Bisnis</h2>
               <select value={dashboardTimeFilter} onChange={(e) => setDashboardTimeFilter(e.target.value)} style={{ padding: '8px 16px', borderRadius: '10px', border: '2px solid #FF7835', background: '#fffaf5', color: '#ea580c', fontWeight: '800', outline: 'none', cursor: 'pointer' }}>
                  <option value="hari_ini">📅 Hari Ini</option>
                  <option value="kemarin">🔙 Kemarin</option>
                  <option value="minggu_ini">📈 Minggu Ini</option>
                  <option value="bulan_ini">📉 Bulan Ini</option>
                  <option value="tahun_ini">🏆 Tahun Ini</option>
               </select>
            </div>

            <div style={{ flex: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div style={{ background: 'linear-gradient(135deg, #4F46E5, #3B82F6)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>Rp {dashboardStats.todaySales.toLocaleString()}</div>
                <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Omset ({dashboardTimeFilter.replace('_', ' ')})</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(20, 184, 166, 0.3)' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>Rp {dashboardStats.totalPengeluaran.toLocaleString()}</div>
                <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pengeluaran ({dashboardTimeFilter.replace('_', ' ')})</div>
              </div>
              <div style={{ background: 'white', border: `2px solid ${isProfit ? '#10b981' : '#ef4444'}`, padding: '20px', borderRadius: '16px', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '26px', fontWeight: '900', marginBottom: '4px', color: isProfit ? '#10b981' : '#ef4444' }}>{isProfit ? '' : '- '}Rp {Math.abs(dashboardStats.labaBersih).toLocaleString()}</div>
                <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>Laba Bersih ({dashboardTimeFilter.replace('_', ' ')})</div>
              </div>
              <div style={{ background: 'linear-gradient(135deg, #EA580C, #F59E0B)', color: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(245, 158, 11, 0.3)' }}>
                <div style={{ fontSize: '26px', fontWeight: '800', marginBottom: '4px' }}>{dashboardStats.totalProducts} <span style={{ fontSize: '14px', fontWeight: '500' }}>/ {dashboardStats.lowStock} Tipis</span></div>
                <div style={{ fontSize: '12px', opacity: 0.9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Produk & Stok Tipis</div>
              </div>
            </div>

            <div className="dashboard-bottom-panel" style={{ display: 'flex', flexDirection: 'row', gap: '20px', flex: 1, minHeight: 0 }}>
                {/* GRAFIK PENDAPATAN */}
                <div style={{ flex: 2, background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, color: '#272734', fontSize: '16px', fontWeight: '800' }}>📈 Grafik Pendapatan</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '4px', display: 'flex', gap: '4px' }}>
                         <button onClick={() => setChartVisualType('bar')} style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'bar' ? 'white' : 'transparent', color: chartVisualType === 'bar' ? '#2563eb' : '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: chartVisualType === 'bar' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '11px', transition: '0.2s' }}>📊 Bar</button>
                         <button onClick={() => setChartVisualType('line')} style={{ border: 'none', padding: '6px 12px', borderRadius: '6px', background: chartVisualType === 'line' ? 'white' : 'transparent', color: chartVisualType === 'line' ? '#2563eb' : '#64748b', fontWeight: 'bold', cursor: 'pointer', boxShadow: chartVisualType === 'line' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontSize: '11px', transition: '0.2s' }}>📈 Line</button>
                      </div>
                      <select value={chartFilter} onChange={(e) => setChartFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '700', color: '#27274F', background: '#fff', fontSize: '11px' }}>
                        <option value="jam">Hari Ini (Per Jam)</option><option value="hari">7 Hari Terakhir</option><option value="bulan">6 Bulan Terakhir</option><option value="tahun">5 Tahun Terakhir</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', position: 'relative', alignItems: 'flex-end', gap: '15px', paddingTop: '20px', minHeight: 0 }}>
                    {chartVisualType === 'line' && (
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 'calc(100% - 20px)', zIndex: 1 }}>
                        <polyline points={chartDataFinal.data.map((d, i) => `${(i / (chartDataFinal.data.length - 1 || 1)) * 100},${100 - ((d.total / (chartDataFinal.max || 1)) * 100)}`).join(' ')} fill="none" stroke="#3b82f6" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {chartDataFinal.data.map((d, i) => (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', position: 'relative', zIndex: 2 }}>
                        {d.total > 0 && <div style={{ fontSize: '10px', color: '#2563eb', fontWeight: '800', marginBottom: '6px', textAlign: 'center', background: 'rgba(255,255,255,0.8)', padding: '2px 4px', borderRadius: '4px' }}>{d.total.toLocaleString()}</div>}
                        {chartVisualType === 'bar' ? ( <div style={{ width: '100%', maxWidth: '40px', background: 'linear-gradient(to top, #60a5fa, #2563eb)', borderRadius: '6px 6px 0 0', height: `${(d.total / (chartDataFinal.max || 1)) * 100}%`, minHeight: '8px', transition: '0.5s ease-out' }}></div> ) : ( <div style={{ width: '100%', display: 'flex', justifyContent: 'center', height: `${(d.total / (chartDataFinal.max || 1)) * 100}%`, minHeight: '8px' }}><div style={{ width: '10px', height: '10px', background: 'white', border: '3px solid #2563eb', borderRadius: '50%', transform: 'translateY(-5px)' }}></div></div> )}
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '10px', fontWeight: '700', textAlign: 'center', width: '100%' }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* BEST SELLER */}
                <div style={{ flex: 1, background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: '#272734', fontSize: '16px', fontWeight: '800', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏆 Top Produk (Terlaris)</span><span style={{fontSize: '11px', color: '#10b981', background: '#dcfce7', padding: '4px 8px', borderRadius: '8px'}}>All Time</span>
                  </h3>
                  <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    {topProductsFinal.length === 0 ? (
                        <div style={{textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '50px'}}>Belum ada data penjualan...</div>
                    ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', position: 'sticky', top: 0, background: 'white' }}>
                              <th style={{ padding: '8px 0' }}>Nama Item</th><th style={{ padding: '8px 0', textAlign: 'center' }}>Terjual</th><th style={{ padding: '8px 0', textAlign: 'right' }}>Laba Kotor</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topProductsFinal.map((p, i) => (
                              <tr key={i} style={{ borderBottom: '1px dashed #f1f5f9' }}>
                                <td style={{ padding: '12px 0', fontWeight: '700', color: '#272734' }}>{i+1}. {p.nama}</td>
                                <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: '800', color: '#FF7835' }}>{p.qty}x</td>
                                <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '800', color: '#10b981' }}>Rp {p.laba.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                    )}
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
                <input type="text" placeholder="🔍 Cari nama..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                <form onSubmit={handleManualScan} style={{ flex: 1, minWidth: 0 }}>
                  <input type="text" placeholder="🔫 Scan..." value={barcodeInput} onChange={(e) => setBarcodeInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '2px solid #FF7835', borderRadius: '10px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                </form>
                <button tabIndex="0" onClick={() => setIsScanningKasir(!isScanningKasir)} style={{ flex: 'none', padding: '10px 12px', background: isScanningKasir ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}>{isScanningKasir ? '❌ Tutup' : '📸 Kamera'}</button>
              </div>

              <div id="camera-popup-container" style={{ flex: 'none', background: '#272734', padding: '16px', borderRadius: '12px', marginBottom: '16px', textAlign: 'center', display: isScanningKasir ? 'block' : 'none' }}>
                <p style={{ color: 'white', margin: '0 0 10px 0', fontWeight: 'bold', fontSize: '14px' }}>Arahkan Barcode ke Kamera</p>
                <div id="reader-kasir"></div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', paddingBottom: '20px' }}>
                <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {produk.filter(p => p.nama.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search)).map(p => (
                    <div key={p.id} tabIndex="0" onClick={() => addToCart(p)} onKeyDown={(e) => { if(e.key === 'Enter') addToCart(p); }} style={{ background: 'white', borderRadius: '12px', padding: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'pointer', border: p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent', position: 'relative', transition: 'transform 0.1s, border 0.1s', display: 'flex', flexDirection: 'column', height: '115px', justifyContent: 'space-between', boxSizing: 'border-box', overflow: 'hidden' }} onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.border = '2px solid #FF7835'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.border = p.stok < 50 ? '2px solid #fee2e2' : '2px solid transparent'; }}>
                      {p.stok < 50 && <div style={{ position: 'absolute', top: '6px', right: '6px', background: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '6px', fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px' }}>{p.stok === 0 ? 'HABIS' : 'TIPIS'}</div>}
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '700', color: '#272734', lineHeight: '1.2', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '31px' }}>{p.nama}</h3>
                      <div className="harga-text" style={{ fontSize: '16px', fontWeight: '900', color: p.hargaPromo ? '#e11d48' : '#0ea5e9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {p.hargaPromo && <span style={{textDecoration: 'line-through', fontSize: '10px', color: '#94a3b8', marginRight: '4px'}}>Rp{p.harga.toLocaleString()}</span>} Rp {(p.hargaPromo || p.harga).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: '#27274F', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontWeight: '800' }}><span style={{ color: p.stok < 50 ? '#dc2626' : '#16a34a' }}>{p.stok} {p.satuan || 'Pcs'}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="kasir-right-panel" style={{ flex: '0 0 420px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <div style={{ flex: 'none', padding: '16px 20px', borderBottom: '2px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffaf5' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#272734' }}>🛒 Keranjang ({cart.length})</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button tabIndex="0" onClick={() => setShowMemberModal(true)} style={{ background: '#3b82f6', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: '700', cursor: 'pointer', transition: '0.2s', fontSize: '11px' }}>👤 + Member</button>
                  {cart.length > 0 && <button tabIndex="0" onClick={() => { setCart([]); setPaymentAmount(''); setMetodePembayaran('Tunai'); setMemberTerpilih(null); setGunakanPoin(false); }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: '700', cursor: 'pointer', transition: '0.2s', fontSize: '11px' }}>Kosongkan</button>}
                </div>
              </div>
              
              <div className="cart-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
                {cart.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#27274F', marginTop: '30px', fontSize: '13px', fontWeight: '500' }}>Belum ada pesanan...</div>
                ) : (
                  cart.map(item => (
                  <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#272734' }}>{item.nama} <span style={{fontSize:'11px', color:'#94a3b8'}}>({item.satuan || 'Pcs'})</span></h3>
                      <button tabIndex="0" onClick={() => updateQuantity(item.id, 0)} style={{ background: '#fee2e2', border: 'none', color: '#dc2626', width: '20px', height: '20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>×</button>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: '900', color: '#FF7835' }}>Rp {(item.harga * item.qty).toLocaleString()}</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: 'white', padding: '2px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <button tabIndex="0" onClick={() => updateQuantity(item.id, item.qty - 1)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#f1f5f9', border: 'none', color: '#27274F', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>−</button>
                        <input type="number" value={item.qty} onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)} style={{ width: '30px', textAlign: 'center', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '800', color: '#272734', outline: 'none' }} />
                        <button tabIndex="0" onClick={() => addToCart(item)} style={{ width: '24px', height: '24px', borderRadius: '4px', background: '#FF7835', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>+</button>
                      </div>
                    </div>
                  </div>
                )))}
              </div>

              <div style={{ flex: 'none', padding: '16px 20px', background: '#fffaf5', borderTop: '2px solid #fed7aa' }}>
                {memberTerpilih && (
                  <div style={{ padding: '8px 12px', background: '#dcfce7', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #bbf7d0' }}>
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534' }}>👤 {memberTerpilih.nama}</span>
                      <div style={{ fontSize: '10px', color: '#15803d', fontWeight: '600' }}>Saldo: {memberTerpilih.poin || 0} Poin</div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {memberTerpilih.poin > 0 && <button onClick={() => setGunakanPoin(!gunakanPoin)} style={{ background: gunakanPoin ? '#16a34a' : 'white', color: gunakanPoin ? 'white' : '#16a34a', border: '1px solid #16a34a', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer' }}>{gunakanPoin ? '✅ Poin Dipakai' : '🎁 Pakai Poin'}</button>}
                      <button onClick={() => { setMemberTerpilih(null); setGunakanPoin(false); }} style={{ background: 'transparent', border: 'none', color: '#dc2626', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#27274F' }}>Total {gunakanPoin ? 'Diskon Poin:' : 'Pembelian:'}</span>
                  <div style={{ textAlign: 'right' }}>
                    {gunakanPoin && <div style={{ fontSize: '12px', color: '#94a3b8', textDecoration: 'line-through' }}>Rp {totalAmountVal.toLocaleString()}</div>}
                    <span style={{ fontSize: '20px', fontWeight: '900', color: gunakanPoin ? '#16a34a' : '#272734' }}>Rp {totalSetelahDiskon.toLocaleString()}</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                  {['Tunai', 'QRIS', 'Transfer', 'Bon'].map(metode => (
                    <button key={metode} tabIndex="0" className="btn-metode" onClick={() => { if (metode === 'Bon' && cart.length === 0) { alert('Keranjang masih kosong!'); return; } setMetodePembayaran(metode); if(metode !== 'Tunai' && metode !== 'Bon') { setPaymentAmount(totalSetelahDiskon); } else { setPaymentAmount(''); } }} style={{ flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer', fontWeight: '800', fontSize: '12px', background: metodePembayaran === metode ? '#FF7835' : 'white', color: metodePembayaran === metode ? 'white' : '#27274F', border: metodePembayaran === metode ? 'none' : '1px solid #cbd5e1', transition: 'all 0.2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {metode === 'Tunai' ? '💵 Tunai' : metode === 'QRIS' ? '📱 QRIS' : metode === 'Transfer' ? '💳 Trans' : '📝 Bon'}
                    </button>
                  ))}
                </div>

                <div style={{ marginBottom: '12px' }}>
                  {metodePembayaran === 'Tunai' ? (
                    <input type="number" placeholder="Ketik Nominal Uang (Rp)" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: paymentAmount !== '' && Number(paymentAmount) < totalSetelahDiskon ? '2px solid #ef4444' : '2px solid #cbd5e1', fontSize: '16px', fontWeight: '800', outline: 'none', background: 'white', color: '#272734', boxSizing: 'border-box' }} />
                  ) : metodePembayaran === 'QRIS' ? (
                    <button tabIndex="0" onClick={() => setShowQrisModal(true)} disabled={!qrisImage} style={{ width: '100%', padding: '12px', borderRadius: '8px', background: !qrisImage ? '#cbd5e1' : '#272734', color: 'white', border: 'none', fontWeight: '800', cursor: !qrisImage ? 'not-allowed' : 'pointer', fontSize: '13px', textTransform: 'uppercase' }}>{qrisImage ? '📱 TAMPILKAN QRIS' : '⚠️ QRIS BELUM DIATUR'}</button>
                  ) : metodePembayaran === 'Transfer' ? (
                    <div style={{ padding: '10px', background: '#eff6ff', color: '#0369a1', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #bae6fd' }}>💳 Pastikan transfer masuk sebelum cetak struk.</div>
                  ) : (
                    <div style={{ padding: '10px', background: '#fff7ed', color: '#ea580c', borderRadius: '8px', textAlign: 'center', fontWeight: '700', fontSize: '12px', border: '1px solid #ffedd5' }}>📝 {memberTerpilih ? `Bon akan tercatat atas nama ${memberTerpilih.nama}` : 'Klik Bayar & Cetak untuk mencatat nama Bon.'}</div>
                  )}
                </div>

                {metodePembayaran === 'Tunai' && paymentAmount !== '' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '10px', background: Number(paymentAmount) >= totalSetelahDiskon ? '#dcfce7' : '#fee2e2', borderRadius: '8px', border: `1px solid ${Number(paymentAmount) >= totalSetelahDiskon ? '#bbf7d0' : '#fecaca'}` }}>
                    <span style={{ fontWeight: '800', fontSize: '12px', color: Number(paymentAmount) >= totalSetelahDiskon ? '#16a34a' : '#dc2626' }}>{Number(paymentAmount) >= totalSetelahDiskon ? 'Kembalian:' : '⚠️ Uang Kurang:'}</span>
                    <span style={{ fontWeight: '900', fontSize: '16px', color: Number(paymentAmount) >= totalSetelahDiskon ? '#16a34a' : '#dc2626' }}>Rp {Math.abs(kembalianVal).toLocaleString()}</span>
                  </div>
                )}

                <button tabIndex="0" onClick={processPayment} disabled={cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalSetelahDiskon))} style={{ width: '100%', padding: '14px', background: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalSetelahDiskon))) ? '#e2e8f0' : '#FF7835', color: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalSetelahDiskon))) ? '#94a3b8' : 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '800', cursor: (cart.length === 0 || (metodePembayaran === 'Tunai' && (paymentAmount === '' || Number(paymentAmount) < totalSetelahDiskon))) ? 'not-allowed' : 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}>BAYAR & CETAK</button>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB TOKO (PRODUK) --- */}
        {activeTab === 'toko' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div className="tabel-header-container" style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800', whiteSpace: 'nowrap' }}>📦 Database Produk</h3>
                  <input type="text" placeholder="🔍 Cari nama / barcode..." value={searchProduk} onChange={(e) => setSearchProduk(e.target.value)} style={{ flex: 1, maxWidth: '220px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none', color: '#272734', fontWeight: '600', margin: 0, boxSizing: 'border-box' }} />
                </div>
                <div className="action-buttons-mobile" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px' }}>
                  <select tabIndex="0" value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: '700', fontSize: '12px', color: '#27274F', background: '#f8fafc', margin: 0, width: 'auto' }}>
                    <option value="terbaru">Terbaru</option><option value="az">A - Z</option>
                  </select>
                  {selectedProducts.length > 0 && <button tabIndex="0" onClick={() => { setPrintData(produk.filter(p => selectedProducts.includes(p.id))); setPrintMode('label'); }} style={{ background: '#0ea5e9', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>🖨️ Cetak ({selectedProducts.length})</button>}
                  <button tabIndex="0" onClick={() => { setPrintData(produk); setPrintMode('label'); }} style={{ background: '#FF7835', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>🖨️ Cetak Semua</button>
                </div>
              </div>
              
              <div className="table-container" style={{ flex: 1, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                  <thead>
                    <tr style={{ background: '#fff7ed', color: '#27274F', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5, width: '30px', textAlign: 'center' }}>☑️</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Nama Produk</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Harga Jual</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Modal</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Stok</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Barcode</th>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #fed7aa', position: 'sticky', top: 0, background: '#fff7ed', zIndex: 5 }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSortedProduk.length === 0 ? ( <tr><td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>Tidak ada produk.</td></tr> ) : ( filteredAndSortedProduk.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px', textAlign: 'center' }}><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={() => toggleSelectProduct(p.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} /></td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.nama}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#0ea5e9', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.hargaPromo ? ( <><span style={{ textDecoration: 'line-through', fontSize: '10px', color: '#94a3b8' }}>Rp {p.harga.toLocaleString()}</span><br/><span style={{ color: '#e11d48', fontWeight: 'bold' }}>Rp {p.hargaPromo.toLocaleString()}</span></> ) : ( <span>Rp {p.harga.toLocaleString()}</span> )}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>Rp {(p.hargaModal || 0).toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}><span style={{ background: p.stok < 50 ? '#fee2e2' : '#dcfce7', color: p.stok < 50 ? '#dc2626' : '#16a34a', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11px' }}>{p.stok} {p.satuan || 'Pcs'}</span></td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#27274F', fontSize: '12px' }}>{p.barcode}</td>
                        <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                          <button tabIndex="0" onClick={() => { setNamaProd(p.nama); setHargaProd(p.harga); setHargaPromoProd(p.hargaPromo || ''); setHargaModalProd(p.hargaModal || ''); setStokProd(p.stok); setBarcodeProd(p.barcode); setSatuanProd(p.satuan || 'Pcs'); setEditingProductId(p.id); }} style={{ background: '#272734', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Edit</button>
                          <button tabIndex="0" onClick={async () => { if(window.confirm('Yakin hapus produk ini?')) { deleteDoc(doc(db, "produk", p.id)); } }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="form-section sticky-box diet-form" style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
              <form onSubmit={simpanProduk} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', flex: 1, overflowY: 'auto' }}>
                <h3 className="form-title" style={{ margin: '0 0 20px 0', color: '#FF7835', fontSize: '18px', fontWeight: '800' }}>{editingProductId ? '✏️ Edit Produk' : '➕ Tambah Produk'}</h3>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Nama Produk</label>
                <input className="form-input" value={namaProd} onChange={e => setNamaProd(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Harga Normal</label><input className="form-input" value={hargaProd} onChange={e => setHargaProd(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} /></div>
                  <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Harga Promo</label><input className="form-input" value={hargaPromoProd} onChange={e => setHargaPromoProd(e.target.value)} placeholder="Opsional" type="number" style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none', background: '#fef08a' }} /></div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}><label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', display: 'block', marginBottom: '6px' }}>Harga Modal / Beli</label><input className="form-input" value={hargaModalProd} onChange={e => setHargaModalProd(e.target.value)} placeholder="Opsional" type="number" style={{ width: '100%', padding: '12px', border: '1px solid #a7f3d0', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none', background: '#ecfdf5' }} /></div>
                </div>
                <div className="form-row" style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Stok Awal</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <input className="form-input" value={stokProd} onChange={e => setStokProd(e.target.value)} required type="number" style={{ width: '55%', padding: '12px 6px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                      <select className="form-input" tabIndex="0" value={satuanProd} onChange={e => setSatuanProd(e.target.value)} style={{ width: '45%', padding: '12px 4px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '11px', fontWeight: 'bold', outline: 'none' }}>
                        <option value="Pcs">Pcs</option><option value="Kg">Kg</option><option value="Gram">Gram</option><option value="Liter">Liter</option><option value="Pack">Pack</option><option value="Box">Box</option><option value="Cup">Cup</option>
                      </select>
                    </div>
                  </div>
                </div>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Barcode Produk</label>
                <div className="form-row barcode-row" style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'nowrap', width: '100%' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                        <input
                          type="text"
                          placeholder="Scan Barcode Kamera / Ketik..."
                          value={barcodeProd} 
                          onChange={(e) => setBarcodeProd(e.target.value)}
                          style={{
                            width: '100%', padding: '12px', background: '#f8fafc',
                            border: '1px solid #e2e8f0', borderRadius: '12px', outline: 'none'
                          }}
                        />
                        
                        {/* INDIKATOR STATUS */}
                        {statusBarcode && (
                          <span style={{ 
                            fontSize: '11px', 
                            color: statusBarcode.includes('✅') ? '#10B981' : (statusBarcode.includes('❌') ? '#EF4444' : '#FF7835'), 
                            marginTop: '4px', 
                            display: 'block', 
                            fontWeight: '500' 
                          }}>
                            {statusBarcode}
                          </span>
                        )}
                      </div>
                          <button className="form-input" tabIndex="0" type="button" onClick={() => setIsScanningToko(!isScanningToko)} style={{ flex: 'none', padding: '10px 12px', background: isScanningToko ? '#ef4444' : '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>{isScanningToko ? '❌ Tutup' : '📸 Scan'}</button>
                </div>
                <div style={{ background: '#272734', padding: '12px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', display: isScanningToko ? 'block' : 'none' }}>
                  <p style={{ color: 'white', margin: '0 0 10px 0', fontSize: '12px', fontWeight: 'bold' }}>Arahkan Barcode ke Kamera</p>
                  <div id="reader-toko"></div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="form-btn-submit" tabIndex="0" type="submit" style={{ flex: 1, padding: '14px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>{editingProductId ? 'UPDATE' : 'SIMPAN'}</button>
                  {editingProductId && <button className="form-btn-submit" tabIndex="0" type="button" onClick={() => { setEditingProductId(null); setNamaProd(''); setHargaProd(''); setHargaPromoProd(''); setHargaModalProd(''); setStokProd(''); setBarcodeProd(''); setSatuanProd('Pcs'); }} style={{ flex: 1, padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>BATAL</button>}
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
                <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800', whiteSpace: 'nowrap' }}>💸 Riwayat Pengeluaran</h3>
                <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '600px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="text" placeholder="🔍 Cari keterangan..." value={searchPengeluaran} onChange={(e) => setSearchPengeluaran(e.target.value)} style={{ flex: 1, minWidth: '150px', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none', color: '#272734', fontWeight: '600', margin: 0, boxSizing: 'border-box' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f8fafc', padding: '4px 8px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{fontSize:'10px', fontWeight:'700', color:'#64748b'}}>Dari:</span><input type="date" value={pengeluaranStart} onChange={e => setPengeluaranStart(e.target.value)} style={{ border:'none', background:'transparent', fontSize:'11px', outline:'none', color:'#272734', fontWeight:'bold' }} />
                    <span style={{fontSize:'10px', fontWeight:'700', color:'#64748b'}}>Sampai:</span><input type="date" value={pengeluaranEnd} onChange={e => setPengeluaranEnd(e.target.value)} style={{ border:'none', background:'transparent', fontSize:'11px', outline:'none', color:'#272734', fontWeight:'bold' }} />
                  </div>
                  <button onClick={exportExcelPengeluaran} style={{ background: '#10b981', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>📥 Excel</button>
                </div>
              </div>
              <div style={{ padding: '12px 16px', background: '#fff7ed', borderRadius: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div><span style={{fontSize:'12px', color:'#ea580c', fontWeight:'700'}}>Total Rekap Sesuai Filter:</span><div style={{fontSize:'20px', fontWeight:'900', color:'#272734'}}>Rp {totalPengeluaranTersaring.toLocaleString()}</div></div>
                {(pengeluaranStart || pengeluaranEnd) && <button onClick={() => { setPengeluaranStart(''); setPengeluaranEnd(''); }} style={{ background:'white', border:'1px solid #ea580c', color:'#ea580c', padding:'6px 12px', borderRadius:'8px', fontSize:'11px', fontWeight:'800', cursor:'pointer' }}>Reset Filter Tanggal</button>}
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
                    {pengeluaranTersaring.length === 0 ? ( <tr><td colSpan="4" style={{ padding: '24px', textAlign: 'center', color: '#27274F' }}>Belum ada data pengeluaran.</td></tr> ) : ( pengeluaranTersaring.map(p => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px', color: '#27274F', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>{p.waktu ? (p.waktu.toDate ? p.waktu.toDate().toLocaleString('id-ID') : new Date(p.waktu).toLocaleString('id-ID')) : 'Baru saja'}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '700', color: '#272734', fontSize: '13px', whiteSpace: 'nowrap' }}>{p.nama}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '800', color: '#e11d48', fontSize: '14px', whiteSpace: 'nowrap' }}>- Rp {p.nominal.toLocaleString()}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', display: 'flex', gap: '6px' }}>
                          <button tabIndex="0" onClick={() => setStrukPengeluaran(p)} style={{ background: '#272734', border: 'none', padding: '6px 10px', borderRadius: '6px', color: 'white', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>🖨️ Cetak Bukti</button>
                          <button tabIndex="0" onClick={async () => { if(window.confirm('Yakin hapus data ini?')) { deleteDoc(doc(db, "pengeluaran", p.id)); } }} style={{ background: '#fee2e2', border: 'none', padding: '6px 10px', borderRadius: '6px', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', fontSize: '11px' }}>Hapus</button>
                        </td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="form-section sticky-box diet-form" style={{ flex: '0 0 350px', overflowY: 'visible', height: 'auto' }}>
              <form onSubmit={simpanPengeluaran} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
                <h3 className="form-title" style={{ margin: '0 0 20px 0', color: '#e11d48', fontSize: '18px', fontWeight: '800' }}>➖ Catat Pengeluaran</h3>
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Keterangan (Contoh: Bayar Listrik)</label>
                <input className="form-input" value={namaPengeluaran} onChange={e => setNamaPengeluaran(e.target.value)} required style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', color: '#27274F', display: 'block', marginBottom: '6px' }}>Nominal Pengeluaran (Rp)</label>
                <input className="form-input" value={nominalPengeluaran} onChange={e => setNominalPengeluaran(e.target.value)} required type="number" style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontSize: '13px', outline: 'none' }} />
                <button className="form-btn-submit" tabIndex="0" type="submit" style={{ width: '100%', padding: '14px', background: '#e11d48', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>SIMPAN PENGELUARAN</button>
              </form>
            </div>
          </div>
        )}
        {/* --- TAB CRM & PELANGGAN --- */}
        {activeTab === 'pelanggan' && (
          <div className="desktop-row-mobile-col mobile-reverse" style={{ height: '100%', display: 'flex', padding: '16px', gap: '16px', boxSizing: 'border-box', width: '100%' }}>
            <div className="table-section" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, color: '#272734', fontSize: '18px', fontWeight: '800' }}>👥 Database Pelanggan</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" placeholder="🔍 Cari nama / WA..." value={searchPelanggan} onChange={(e) => setSearchPelanggan(e.target.value)} style={{ padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', outline: 'none' }} />
                  <button onClick={exportExcelPelanggan} style={{ background: '#10b981', color: 'white', padding: '10px 16px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>📥 Excel</button>
                </div>
              </div>
              <div className="table-container" style={{ flex: 1, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: '12px' }}>
                      <th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Nama</th><th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>WhatsApp</th><th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Poin</th><th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Alamat</th><th style={{ padding: '12px 16px', borderBottom: '2px solid #e2e8f0' }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pelangganTersaring.map(p => {
                      const cleanWa = p.wa ? p.wa.replace(/\D/g, '').replace(/^0/, '62') : '';
                      return (
                        <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '12px 16px', fontWeight: '800' }}>{p.nama}</td>
                           <td style={{ padding: '12px 16px' }}><a href={`https://wa.me/${cleanWa}`} target="_blank" rel="noreferrer" style={{ color: '#16a34a', textDecoration: 'none', fontWeight: 'bold' }}>💬 {p.wa}
                          </a>
                          </td>
                          <td style={{ padding: '12px 16px', fontWeight: '900', color: '#FF7835' }}>{p.poin || 0} Pts</td>
                          <td style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b' }}>{p.alamat || '-'}</td>
                          <td style={{ padding: '12px 16px', display: 'flex', gap: '6px' }}>
                            <button onClick={() => { setFormPelangganNama(p.nama); setFormPelangganWa(p.wa || ''); setFormPelangganEmail(p.email || ''); setFormPelangganAlamat(p.alamat || ''); setEditingPelangganId(p.id); }} style={{ background: '#272734', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Edit</button>
                            <button onClick={() => deleteDoc(doc(db, "pelanggan", p.id))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Hapus</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
           {/* --- Form Input Pelanggan --- */}
            <div className="form-section sticky-box diet-form" style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
              <form onSubmit={simpanPelanggan} style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', flex: 1, overflowY: 'auto' }}>
                <h3 className="form-title" style={{ margin: '0 0 20px 0', color: '#3b82f6', fontSize: '18px', fontWeight: '800' }}>
                  {editingPelangganId ? '✏️ Edit Member' : '➕ Member Baru'}
                </h3>
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Nama Lengkap *</label>
                <input className="form-input" required value={formPelangganNama} onChange={e => setFormPelangganNama(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                
                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>WhatsApp *</label>
                <input className="form-input" required value={formPelangganWa} onChange={e => setFormPelangganWa(e.target.value)} placeholder="Contoh: 08123456789" style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />

                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Email (Opsional)</label>
                <input className="form-input" type="email" value={formPelangganEmail} onChange={e => setFormPelangganEmail(e.target.value)} placeholder="email@contoh.com" style={{ width: '100%', padding: '12px', marginBottom: '16px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />

                <label className="form-label" style={{ fontSize: '12px', fontWeight: '700', display: 'block', marginBottom: '6px' }}>Alamat Lengkap</label>
                <textarea className="form-input" value={formPelangganAlamat} onChange={e => setFormPelangganAlamat(e.target.value)} rows="3" style={{ width: '100%', padding: '12px', marginBottom: '24px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="form-btn-submit" type="submit" style={{ flex: 1, padding: '14px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}>
                    {editingPelangganId ? 'UPDATE' : 'SIMPAN'}
                  </button>
                  {editingPelangganId && (
                    <button className="form-btn-submit" type="button" onClick={() => { setEditingPelangganId(null); setFormPelangganNama(''); setFormPelangganWa(''); setFormPelangganEmail(''); setFormPelangganAlamat(''); }} style={{ flex: 1, padding: '14px', background: '#272734', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}>
                      BATAL
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}
        
        {/* --- TAB LAPORAN (TRANSAKSI & BON) --- */}
        {activeTab === 'laporan' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '16px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', width: '100%' }}>
              <h2 style={{ margin: '0', fontSize: '20px', color: '#272734', fontWeight: '800' }}>📋 Laporan Transaksi</h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button tabIndex="0" className="tab-laporan-btn" onClick={() => setLaporanTab('transaksi')} style={{ padding: '8px 16px', background: laporanTab === 'transaksi' ? '#272734' : '#f1f5f9', color: laporanTab === 'transaksi' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '13px', transition: '0.2s' }}>Semua Transaksi</button>
                <button tabIndex="0" className="tab-laporan-btn" onClick={() => setLaporanTab('bon')} style={{ padding: '8px 16px', background: laporanTab === 'bon' ? '#FF7835' : '#f1f5f9', color: laporanTab === 'bon' ? 'white' : '#64748b', borderRadius: '8px', fontWeight: '800', border: 'none', cursor: 'pointer', fontSize: '13px', transition: '0.2s' }}>Buku Bon (Piutang)</button>
                <button tabIndex="0" onClick={exportExcelTrans} style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>📥 Download Excel</button>
                <button tabIndex="0" onClick={() => setShowResetModal(true)} style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}>🗑️ Hapus Data Lama</button>
              </div>
            </div>

            <div style={{ flex: 'none', background: 'white', padding: '12px 16px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '8px', display: 'flex', gap: '12px', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
              <input type="text" placeholder="🔍 Cari nama barang, metode bayar, atau nama pelanggan..." value={searchLaporan} onChange={(e) => setSearchLaporan(e.target.value)} style={{ flex: 2, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none', minWidth: '200px' }} />
              <select tabIndex="0" value={reportFilter} onChange={(e) => setReportFilter(e.target.value)} style={{ flex: 1, padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc', fontSize: '13px', fontWeight: '600', color: '#27274F', outline: 'none', minWidth: '150px' }}>
                <option value="hari">📅 Hari Ini</option><option value="minggu">📈 Minggu Ini</option><option value="bulan">📉 Bulan Ini</option><option value="semua">📂 Semua Waktu</option>
              </select>
            </div>

            <div style={{ flex: 'none', padding: '6px 12px', background: '#fff7ed', color: '#ea580c', borderRadius: '6px', fontSize: '11px', fontWeight: '600', marginBottom: '8px', border: '1px solid #ffedd5' }}>
              💡 Menampilkan 500 transaksi terbaru agar aplikasi kencang. Gunakan kolom pencarian di atas untuk melihat data lama.
            </div>

            <div style={{ flex: 1, background: 'white', borderRadius: '16px', overflowY: 'auto', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', width: '100%' }}>
              {displayedLaporan.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#27274F', fontSize: '14px', fontWeight: '500' }}>Belum ada data di tabel ini.</div>
              ) : (
                displayedLaporan.map(t => (
                <div key={t.id} style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                      {t.diskonPoin > 0 && <span style={{ marginLeft: '8px', color: '#16a34a', fontWeight: '800' }}>🎁 Diskon Poin: Rp {t.diskonPoin.toLocaleString()}</span>}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: '900', color: '#FF7835', fontSize: '15px', marginBottom: '2px' }}>Rp {t.total.toLocaleString()}</div>
                      {t.metode === 'Tunai' && (
                        <div style={{ fontSize: '10px', color: '#27274F', fontWeight: '600' }}>
                          Tunai: Rp {t.uangBayar?.toLocaleString()} <span style={{ margin: '0 4px', color: '#cbd5e1' }}>|</span> Kem: Rp {t.kembalian?.toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {t.metode === 'Bon' && t.statusBon === 'Belum Lunas' && (
                        <button tabIndex="0" onClick={async () => { if(window.confirm(`Tandai tagihan Rp ${t.total.toLocaleString()} atas nama ${t.namaPelanggan} ini sudah LUNAS?`)) { updateDoc(doc(db, "transaksi", t.id), { statusBon: 'Lunas', waktuLunas: new Date() }); } }} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(16,185,129,0.3)' }}>✓ LUNAS</button>
                      )}
                      <button tabIndex="0" onClick={() => setStrukData(t)} style={{ background: '#272734', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>🖨️ Cetak</button>
                    </div>
                  </div>
                </div>
              )))}
            </div>
          </div>
        )}
      </main> 
      {/* --- BATAS AKHIR AREA MAIN (KONTEN UTAMA) --- */}

      {/* --- MODAL POP-UP CARI MEMBER (KASIR) --- */}
      {showMemberModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#3b82f6', fontSize: '18px', fontWeight: '800' }}>Cari / Daftar Member</h3>
              <button onClick={() => setShowMemberModal(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            <input autoFocus type="text" placeholder="🔍 Ketik nama atau WA..." value={searchPelanggan} onChange={e => setSearchPelanggan(e.target.value)} style={{ width: '100%', padding: '14px', marginBottom: '16px', border: '2px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: '600', outline: 'none', boxSizing: 'border-box' }} />
            
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '16px' }}>
              {pelangganTersaring.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>Member tidak ditemukan.</div>
              ) : (
                pelangganTersaring.map(p => (
                  <div key={p.id} onClick={() => { setMemberTerpilih(p); setShowMemberModal(false); setSearchPelanggan(''); }} style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '800', color: '#272734', fontSize: '14px' }}>{p.nama}</div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>{p.wa}</div>
                    </div>
                    <div style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 8px', borderRadius: '6px', fontWeight: '800', fontSize: '11px' }}>{p.poin || 0} Pts</div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => { setShowMemberModal(false); setActiveTab('pelanggan'); }} style={{ width: '100%', padding: '14px', background: '#eff6ff', color: '#3b82f6', border: '2px dashed #bfdbfe', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', fontSize: '13px' }}>➕ DAFTARKAN MEMBER BARU</button>
          </div>
        </div>
      )}

    {/* --- MODAL PENGATURAN TOKO (LANDSCAPE DESKTOP) --- */}
      {showProfileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: '#272734' }}>⚙️ Pengaturan & Profil Toko</h2>
              <button onClick={() => setShowProfileModal(false)} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>

            {/* Container Grid: Landscape di Desktop, Vertikal di HP */}
            <div className="desktop-row-mobile-col" style={{ display: 'flex', gap: '30px' }}>
              
              {/* === KOLOM 1: IDENTITAS TOKO === */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: '#FF7835', marginBottom: '15px', borderLeft: '4px solid #FF7835', paddingLeft: '10px' }}>🏠 Identitas Toko</h4>
                
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Nama Toko</label>
                <input value={namaToko} onChange={e => setNamaToko(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing: 'border-box' }} />
                
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Alamat Lengkap</label>
                <input value={alamat} onChange={e => setAlamat(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing: 'border-box' }} />
                
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Nomor HP / WA</label>
                <input value={noTelp} onChange={e => setNoTelp(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '15px', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing: 'border-box' }} />
                
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Pesan Footer Struk</label>
                <textarea value={pesanStruk} onChange={e => setPesanStruk(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '10px', boxSizing: 'border-box', height: '80px', resize: 'none' }} />
              </div>

              {/* === KOLOM 2: LOYALITAS & LABEL THERMAL === */}
              <div style={{ flex: 1 }}>
                <h4 style={{ color: '#3b82f6', marginBottom: '15px', borderLeft: '4px solid #3b82f6', paddingLeft: '10px' }}>🎁 Loyalitas & Label</h4>
                
                <div style={{ background: '#eff6ff', padding: '15px', borderRadius: '15px', marginBottom: '20px' }}>
                   <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Minimal Belanja per 1 Poin (Rp)</label>
                   <input type="number" value={minBelanjaPoin} onChange={e => setMinBelanjaPoin(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #bfdbfe', borderRadius: '8px', fontWeight: 'bold', boxSizing: 'border-box' }} />
                </div>

                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '13px', margin: '0 0 10px 0' }}>🏷️ Ukuran Label Thermal (px)</p>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Lebar</label>
                      <input type="number" value={labelWidth} onChange={e => setLabelWidth(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Tinggi</label>
                      <input type="number" value={labelHeight} onChange={e => setLabelHeight(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Sekat/Gap</label>
                      <input type="number" value={labelGap} onChange={e => setLabelGap(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Kolom</label>
                      <input type="number" value={labelCols} onChange={e => setLabelColumns(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  
                  <div>
                    <label style={{fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px'}}>Skala Isi Label (%)</label>
                    <input type="number" value={labelScale} onChange={e => setLabelScale(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {/* === KOLOM 3: MEDIA, SUARA & TOMBOL === */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ color: '#10b981', marginBottom: '15px', borderLeft: '4px solid #10b981', paddingLeft: '10px' }}>📱 Media & Suara</h4>
                
                {/* Background Login (Opsional, kalau tidak dipakai abaikan saja) */}
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
                  <p style={{fontWeight: 'bold', fontSize: '11px', margin: '0 0 8px 0'}}>🖼️ Background Login (Maks 1MB)</p>
                  <input type="file" accept="image/*" onChange={handleBgUpload} style={{ fontSize: '11px', width: '100%' }} />
                  {bgLogin && <button onClick={() => { setBgLogin(''); localStorage.removeItem('pos_bgLogin'); }} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', marginTop: '8px', cursor: 'pointer' }}>Hapus BG</button>}
                </div>

                <div style={{ background: '#f0fdf4', padding: '15px', borderRadius: '15px', marginBottom: 'auto' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={soundBeep} onChange={e => setSoundBeep(e.target.checked)} /> Bunyi Beep saat klik
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                    <input type="checkbox" checked={soundVoice} onChange={e => setSoundVoice(e.target.checked)} /> Suara Robot Transaksi
                  </label>
                </div>
                {/* --- KOTAK KEAMANAN PIN --- */}
                <div style={{ background: '#fef2f2', padding: '15px', borderRadius: '15px', marginTop: '15px', border: '1px solid #fecaca' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: '#991b1b' }}>
                    <input 
                      type="checkbox" 
                      checked={isReportLocked} 
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPinAction('create_pin');
                          setShowPinModal(true);
                        } else {
                          setPinAction('turn_off_lock');
                          setShowPinModal(true);
                        }
                      }} 
                    /> 
                    🔒 Gembok Laporan & Keuangan
                  </label>
                  <p style={{ margin: '5px 0 0 25px', fontSize: '11px', color: '#dc2626' }}>Wajib PIN untuk buka Laporan & Arus Kas</p>
                </div>
                
                <div style={{ marginTop: '20px' }}>
                  <button onClick={simpanProfil} style={{ width: '100%', padding: '15px', background: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', boxShadow: '0 4px 6px rgba(16,185,129,0.2)' }}>
                    SIMPAN PERUBAHAN
                  </button>
                  <button onClick={() => signOut(auth)} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#ef4444', border: '2px solid #ef4444', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '15px' }}>
                    LOGOUT / KELUAR
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PIN KEAMANAN (BRANKAS) --- */}
      {showPinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 11000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '350px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            {/* JIKA BUKAN MODE LUPA PIN (Tampil Numpad ATM biasa) */}
            {!isForgotPinMode ? (
              <>
                <h2 style={{ margin: '0 0 10px 0', color: '#272734' }}>
                  {pinAction === 'create_pin' ? 'Buat PIN Baru' : '🔒 Masukkan PIN'}
                </h2>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
                  {pinAction === 'create_pin' ? 'Buat PIN 4-6 angka rahasia untuk mengunci laporan.' : 'Otorisasi dibutuhkan untuk mengakses menu ini.'}
                </p>

                <form onSubmit={handlePinSubmit}>
                  <input 
                    type="password" 
                    autoFocus
                    value={pinInput} 
                    onChange={(e) => setPinInput(e.target.value.replace(/[^0-9]/g, '').slice(0,6))}
                    style={{ width: '100%', padding: '15px', fontSize: '28px', textAlign: 'center', letterSpacing: '15px', borderRadius: '15px', border: '2px solid #cbd5e1', marginBottom: '20px', fontWeight: 'bold', boxSizing: 'border-box', background: '#f8fafc' }}
                    placeholder="••••"
                  />
                </form>

                {/* NUMPAD TOUCHSCREEN */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  {['1','2','3','4','5','6','7','8','9','del','0','ok'].map((btn) => (
                    <button 
                      key={btn}
                      onClick={() => handleNumpad(btn)}
                      style={{ 
                        padding: '15px', fontSize: '20px', fontWeight: 'bold', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: '0.2s',
                        background: btn === 'del' ? '#fee2e2' : btn === 'ok' ? '#dcfce7' : '#f1f5f9',
                        color: btn === 'del' ? '#dc2626' : btn === 'ok' ? '#166534' : '#334155'
                      }}
                    >
                      {btn === 'del' ? '⌫' : btn === 'ok' ? 'OK' : btn}
                    </button>
                  ))}
                </div>
                
                {/* TOMBOL LUPA PIN (Hanya muncul saat minta PIN, tidak muncul saat lagi bikin PIN) */}
                {pinAction !== 'create_pin' && (
                  <button onClick={() => setIsForgotPinMode(true)} style={{ color: '#ef4444', fontSize: '13px', border: 'none', background: 'transparent', cursor: 'pointer', marginBottom: '10px', fontWeight: 'bold' }}>Lupa PIN Keamanan?</button>
                )}

                <button onClick={() => { setShowPinModal(false); setPinInput(''); setIsForgotPinMode(false); }} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>BATAL</button>
              </>
            ) : (
              
              /* JIKA MODE LUPA PIN AKTIF (Tampil form Password M-Banking) */
              <>
                <h2 style={{ margin: '0 0 10px 0', color: '#272734' }}>Lupa PIN?</h2>
                <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: '1.5' }}>
                  Masukkan Password Login Toko Anda untuk mereset PIN keamanan.
                </p>
                
                <input 
                  type="password" 
                  autoFocus
                  value={adminPasswordInput} 
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '15px', fontSize: '16px', borderRadius: '15px', border: '2px solid #cbd5e1', marginBottom: '20px', boxSizing: 'border-box', background: '#f8fafc' }}
                  placeholder="Password Utama Toko"
                />

                <button 
                  onClick={() => {
                    // SILAKAN GANTI 'admin123' DI BAWAH INI DENGAN PASSWORD TOKO MAS ROFIKI
                    if(adminPasswordInput === 'admin123') {
                      setIsReportLocked(false);
                      setSavedPin('');
                      setShowPinModal(false);
                      setIsForgotPinMode(false);
                      setAdminPasswordInput('');
                    } else {
                      alert('❌ Password Utama Salah!');
                      setAdminPasswordInput('');
                    }
                  }}
                  style={{ width: '100%', padding: '15px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' }}
                >
                  Verifikasi & Reset PIN
                </button>
                
                <button onClick={() => { setIsForgotPinMode(false); setAdminPasswordInput(''); }} style={{ width: '100%', padding: '12px', background: 'transparent', color: '#94a3b8', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>Kembali</button>
              </>
            )}

          </div>
        </div>
      )}   

      {showHelpModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.7)', zIndex: 10500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '100%', maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: '2px solid #f1f5f9', paddingBottom: '15px' }}>
               <h2 style={{ color: '#FF7835', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '22px', fontWeight: '900' }}>📖 Panduan & Tanya Jawab POS</h2>
               <button onClick={() => setShowHelpModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '35px', height: '35px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {/* Q&A 1 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Bagaimana cara kerja sistem Poin Pelanggan?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Setiap belanja kelipatan nominal tertentu (misal Rp 20.000) otomatis jadi 1 Poin. Poin bisa ditukar menjadi diskon saat transaksi berikutnya dengan mencentang "Gunakan Poin" (1 Poin = Rp 100).</p>
              </div>

              {/* Q&A 2 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Bagaimana cara mencatat pelanggan yang ngutang (Kasbon)?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Pilih metode pembayaran <b>"📝 Bon"</b> di kasir. Tagihan akan otomatis tersimpan di menu Laporan Buku Bon (Piutang) dan bisa ditagih kapan saja.</p>
              </div>

              {/* Q&A 3 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Darimana sistem menghitung Laba Bersih di Dashboard?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Laba Bersih = (Total Omzet) - (Total Harga Modal Barang Terjual) - (Total Pengeluaran Toko). Pastikan Harga Modal diisi saat input produk.</p>
              </div>

              {/* Q&A 4 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Bagaimana cara mencetak label Barcode?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Di menu Database Produk, centang barang yang diinginkan lalu klik tombol biru <b>"🖨️ Cetak"</b>. Atur ukuran label di menu Profil agar pas dengan kertas thermal Anda.</p>
              </div>

              {/* Q&A 5 */}
              <div style={{ padding: '15px', background: '#fff7ed', borderRadius: '15px', border: '1px solid #ffedd5' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#c2410c', fontSize: '15px' }}>⚠️ Apakah bisa dipakai saat internet mati?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#9a3412', lineHeight: '1.6' }}>Bisa (Offline Mode). Data akan tersimpan sementara di browser dan akan otomatis sinkron saat internet menyala kembali. Jangan tutup browser saat sedang offline.</p>
              </div>

              {/* Q&A 6 */}
              <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '15px', border: '1px solid #dcfce7' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#15803d', fontSize: '15px' }}>❓ Cara memindahkan laporan ke Excel?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#166534', lineHeight: '1.6' }}>Klik tombol hijau bertuliskan <b>"📥 Excel"</b> di setiap tab laporan. Data akan langsung terunduh dalam format file Excel/CSV.</p>
              </div>

              {/* Q&A 7 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Cara mencatat biaya listrik, galon, atau gaji?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Masuk ke tab <b>Arus Kas</b>, masukkan keterangan pengeluaran dan nominal uang, lalu simpan. Ini akan memotong laba bersih di dashboard secara otomatis.</p>
              </div>

              {/* Q&A 8 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Suara robot kasirnya berisik, apakah bisa dimatikan?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Masuk ke menu Profil (👤), di pojok kanan bawah hilangkan centang pada opsi <b>"Suara Robot"</b> untuk mematikannya.</p>
              </div>

              {/* Q&A 9 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Cara memunculkan gambar QRIS saat bayar?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Upload foto QRIS toko Anda di menu Pengaturan Toko. QRIS akan muncul otomatis saat Anda memilih metode pembayaran <b>"📱 QRIS"</b> di kasir.</p>
              </div>

              {/* Q&A 10 */}
              <div style={{ padding: '15px', background: '#fef2f2', borderRadius: '15px', border: '1px solid #fee2e2' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#b91c1c', fontSize: '15px' }}>🗑️ Cara menghapus data transaksi tahun lalu?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#991b1b', lineHeight: '1.6' }}>Gunakan tombol <b>"Hapus Data Lama"</b> di tab Laporan. Pastikan sudah download backup ke Excel terlebih dahulu karena data yang dihapus tidak bisa dikembalikan.</p>
              </div>

              {/* Q&A 11 */}
              <div style={{ padding: '15px', background: '#f8fafc', borderRadius: '15px', border: '1px solid #e2e8f0' }}>
                <strong style={{ display: 'block', marginBottom: '8px', color: '#272734', fontSize: '15px' }}>❓ Cara ubah harga atau stok barang yang salah input?</strong>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: '1.6' }}>Cari barang di <b>Database Produk</b>, klik tombol hitam "Edit", ubah harganya di form kanan, lalu klik <b>"UPDATE"</b>.</p>
              </div>

            </div>

            <button onClick={() => setShowHelpModal(false)} style={{ width: '100%', padding: '15px', background: '#FF7835', color: 'white', border: 'none', borderRadius: '12px', marginTop: '25px', fontWeight: '900', cursor: 'pointer' }}>SAYA MENGERTI</button>
          </div>
        </div>
      )}

      {/* --- POP-UP MODAL BON --- */}
      {showBonModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'left', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: '#272734' }}>📝 Catat Bon Pelanggan</h2>
            <p style={{ margin: '0 0 24px 0', fontWeight: '600', color: '#27274F' }}>Tagihan: <strong style={{ color: '#FF7835', fontSize: '20px' }}>Rp {totalSetelahDiskon.toLocaleString()}</strong></p>
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', display: 'block', marginBottom: '8px' }}>Nama Pelanggan <span style={{color: '#ef4444'}}>*</span></label>
            <input autoFocus list="dataPelanggan" value={namaPelangganBon} onChange={e => setNamaPelangganBon(e.target.value)} placeholder="Contoh: Pak Budi" style={{ width: '100%', padding: '16px', marginBottom: '24px', border: '2px solid #cbd5e1', borderRadius: '12px', fontSize: '15px', fontWeight: '700', outline: 'none', boxSizing: 'border-box' }} />
            <datalist id="dataPelanggan">{pelanggan.map(p => (<option key={p.id} value={p.nama} />))}</datalist>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => { setShowBonModal(false); setMetodePembayaran('Tunai'); }} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '800', cursor:'pointer' }}>BATAL</button>
              <button onClick={() => finalizePayment('Bon')} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor:'pointer', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}>SIMPAN BON</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL TAMPIL QRIS --- */}
      {showQrisModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.85)', zIndex: 9500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '100%', maxWidth: '400px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#272734', fontSize: '24px', fontWeight: '800' }}>Silakan Scan QRIS</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px' }}>Total: <strong style={{ color: '#FF7835', fontSize: '18px' }}>Rp {totalSetelahDiskon.toLocaleString()}</strong></p>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', marginBottom: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              <img src={qrisImage} alt="QRIS" style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: '8px' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowQrisModal(false)} style={{ flex: 1, padding: '16px', background: '#f1f5f9', color: '#27274F', border: 'none', borderRadius: '12px', fontWeight: '700', cursor:'pointer', fontSize: '14px' }}>TUTUP</button>
              <button onClick={() => finalizePayment('QRIS')} style={{ flex: 2, padding: '16px', background: 'linear-gradient(135deg, #FF7835 0%, #E5601E 100%)', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '800', cursor:'pointer', fontSize: '14px', boxShadow: '0 10px 15px -3px rgba(255, 120, 53, 0.4)' }}>SUDAH BAYAR</button>
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
              <p style={{ margin: 0, fontSize: '13px', color: '#b91c1c', fontWeight: '700', lineHeight: '1.5' }}>PERINGATAN! Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah men-download data (Excel) untuk tahun tersebut sebelum menghapus.</p>
            </div>
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#27274F', display: 'block', marginBottom: '8px' }}>Pilih Tahun Transaksi yang Ingin Dihapus:</label>
            <select tabIndex="0" value={selectedYearReset} onChange={e => setSelectedYearReset(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #cbd5e1', marginBottom: '24px', fontSize: '15px', fontWeight: 'bold', color: '#272734', outline: 'none' }}>
              {Array.from({ length: 26 }, (_, i) => 2025 + i).map(year => ( <option key={year} value={year}>{year}</option> ))}
            </select>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button tabIndex="0" onClick={() => setShowResetModal(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#27274F', fontWeight: '800', cursor: 'pointer', fontSize: '14px' }}>BATAL</button>
              <button tabIndex="0" onClick={handleResetTahunan} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', background: '#dc2626', color: 'white', fontWeight: '900', cursor: 'pointer', fontSize: '14px', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)' }}>HAPUS PERMANEN</button>
            </div>
          </div>
        </div>
      )}

      {/* --- POPUP PERINGATAN OFFLINE --- */}
      {showOfflineWarning && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(39, 39, 52, 0.9)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', padding: '16px' }}>
          <div style={{ background: 'white', padding: '32px', borderRadius: '24px', maxWidth: '420px', width: '100%', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: '50px', marginBottom: '16px' }}>⚠️</div>
            <h2 style={{ margin: '0 0 16px 0', color: '#dc2626', fontSize: '20px', fontWeight: '900', lineHeight: '1.4' }}>MODE OFFLINE AKTIF<br />INTERNET TERPUTUS</h2>
            <p style={{ margin: '0 0 24px 0', color: '#27274F', fontSize: '14px', fontWeight: '700', lineHeight: '1.6', background: '#fff7ed', padding: '12px', borderRadius: '12px', border: '1px solid #ffedd5' }}>Jangan refresh halaman atau menutup browser agar data transaksi tidak hilang!</p>
            <button tabIndex="0" onClick={() => setShowOfflineWarning(false)} style={{ width: '100%', padding: '16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '900', cursor: 'pointer', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 6px rgba(220, 38, 38, 0.3)' }}>Oke, Saya Mengerti</button>
          </div>
        </div>
      )}

      {/* --- STRUK PENGELUARAN (BUKTI KAS KELUAR) --- */}
      {strukPengeluaran && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', boxSizing: 'border-box' }}>
            <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', margin: 'auto' }}>
              <h2 style={{ margin: '0' }}>{namaToko || 'TOKO SAYA'}</h2>
              <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>Telp/WA: {noTelp}</p>
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <h3 style={{ margin: '5px 0', textDecoration: 'underline' }}>BUKTI KAS KELUAR</h3>
              <p style={{ fontSize: '12px', textAlign: 'left', margin: '8px 0 2px 0' }}>Tgl: {strukPengeluaran.waktu?.toDate ? strukPengeluaran.waktu.toDate().toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}</p>
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <div style={{ fontSize: '14px', textAlign: 'left', marginBottom: '10px' }}><strong>KETERANGAN:</strong><br/>{strukPengeluaran.nama}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', padding: '10px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000' }}><span>NOMINAL</span><span>Rp {strukPengeluaran.nominal.toLocaleString()}</span></div>
              <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <div style={{ textAlign: 'center' }}><p style={{ margin: '0 0 30px 0' }}>Kasir/Admin</p><p style={{ margin: 0 }}>(..................)</p></div>
                <div style={{ textAlign: 'center' }}><p style={{ margin: '0 0 30px 0' }}>Penerima Dana</p><p style={{ margin: 0 }}>(..................)</p></div>
              </div>
              <div className="no-print" style={{ marginTop: '30px', display: 'flex', gap: '10px' }}>
                <button onClick={() => window.print()} style={{ flex: 1, background: '#FF7835', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print (Enter)</button>
                <button onClick={() => setStrukPengeluaran(null)} style={{ flex: 1, background: '#e2e8f0', color: '#27274F', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup (Esc)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- STRUK TRANSAKSI KASIR --- */}
      {strukData && !strukPengeluaran && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', zIndex: 9999, overflowY: 'auto' }}>
          <div style={{ minHeight: '100%', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '40px 20px', boxSizing: 'border-box' }}>
            <div id="strukArea" style={{ background: '#fff', width: '320px', padding: '24px', textAlign: 'center', color: '#000', fontFamily: 'monospace', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', margin: 'auto' }}>
              <h2 style={{ margin: '0' }}>{namaToko || 'STRUK BELANJA'}</h2>
              <p style={{ fontSize: '12px', margin: '5px 0' }}>{alamat}<br/>Telp/WA: {noTelp}</p>
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <p style={{ fontSize: '12px', textAlign: 'left', margin: '2px 0' }}>
                Tgl: {strukData.waktu?.toDate ? strukData.waktu.toDate().toLocaleString('id-ID') : new Date().toLocaleString('id-ID')}<br/>Metode: {strukData.metode}
              </p>
              {strukData.metode === 'Bon' && <p style={{ fontSize: '13px', textAlign: 'left', margin: '4px 0', fontWeight: 'bold' }}>PELANGGAN: {strukData.namaPelanggan}</p>}
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              {strukData.items.map((it, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', fontSize: '14px', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>{it.qty} {it.satuan} {it.nama}</span><span>{(it.harga * it.qty).toLocaleString()}</span></div>
                  {it.hargaAsli > it.harga && <div style={{ fontSize: '11px', textAlign: 'left', color: '#555' }}><span style={{textDecoration: 'line-through'}}>Rp {it.hargaAsli.toLocaleString()}</span> (Promo)</div>}
                </div>
              ))}
              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px' }}>
                <span>TOTAL</span><span>Rp {strukData.totalKotor?.toLocaleString() || strukData.total.toLocaleString()}</span>
              </div>
              {strukData.diskonPoin > 0 && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px', color: '#16a34a' }}><span>DISKON POIN</span><span>-Rp {strukData.diskonPoin.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', marginTop: '5px' }}><span>GRAND TOTAL</span><span>Rp {strukData.total.toLocaleString()}</span></div>
                </>
              )}
              {strukData.metode === 'Tunai' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>BAYAR</span><span>Rp {strukData.uangBayar?.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '5px' }}><span>KEMBALI</span><span>Rp {strukData.kembalian?.toLocaleString()}</span></div>
                </>
              )}
              {/* --- BAGIAN POIN MEMBER (TAMBAHKAN INI) --- */}
                {strukData.poinDidapat > 0 && (
                  <>
                    <div style={{ borderTop: '2px dashed #000', margin: '10px 0' }}></div>
                    <p style={{ fontSize: '12px', textAlign: 'center', margin: '4px 0', fontWeight: 'bold' }}>
                      🎉 Yeyy! Anda mendapatkan {strukData.poinDidapat} Poin!
                    </p>
                  </>
                )}

              <div style={{ borderTop: '2px dashed #000', margin: '15px 0' }}></div>
              <p style={{ fontSize: '14px', fontWeight: 'bold' }}>{pesanStruk}</p>
              <div className="no-print" style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button onClick={() => window.print()} style={{ flex: 1, background: '#FF7835', color: '#fff', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Print (Enter)</button>
                <button onClick={() => setStrukData(null)} style={{ flex: 1, background: '#e2e8f0', color: '#27274F', padding: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Tutup (Esc)</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CETAK LABEL PRODUK --- */}
      {printMode === 'label' && printData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.9)', zIndex: 9999, overflowY: 'auto' }}>
          <div className="no-print" style={{ textAlign: 'center', padding: '15px', background: '#272734', position: 'sticky', top: 0, zIndex: 10 }}>
            <button onClick={() => window.print()} style={{ background: '#FF7835', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor:'pointer' }}>🖨️ PRINT SIMPAN PDF</button>
            <button onClick={() => setPrintMode(null)} style={{ background: 'white', color: '#272734', padding: '12px 24px', border: 'none', borderRadius: '10px', marginLeft: '10px', cursor:'pointer', fontWeight: 'bold' }}>TUTUP</button>
          </div>
          <div id="print-area" style={{ background: '#fff', padding: '10px', display: 'grid', gridTemplateColumns: `repeat(${labelCols}, auto)`, gap: `${labelGap}px`, justifyContent: 'center' }}>
            {printData.map((p, i) => (
              <div key={i} style={{ border: '1px dashed #000', width: `${labelWidth}px`, height: `${labelHeight}px`, display: 'flex', background: p.hargaPromo ? '#fef08a' : '#fff', boxSizing: 'border-box', overflow: 'hidden', position: 'relative' }}>
                <div style={{ display: 'flex', width: '100%', height: '100%', transform: `scale(${labelScale / 100})`, transformOrigin: 'top left', width: `${(100 / (labelScale / 100))}%`, height: `${(100 / (labelScale / 100))}%` }}>
                  <div style={{ width: '25px', borderRight: '1px dashed #000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '8px', fontWeight: 'bold', textAlign: 'center', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{namaToko || 'TOKO'}</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3px', justifyContent: 'space-between' }}>
                    <div style={{ height: '30px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{p.nama}</div>
                    <div style={{ flex: 1, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <img src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${p.barcode}&scale=1&height=6`} style={{ width: '90%', height: '25px', margin: '0 auto' }} alt="bc" />
                      <div style={{ fontSize: '8px', fontFamily: 'monospace', marginTop: '2px' }}>{p.barcode}</div>
                    </div>
                    <div style={{ height: '28px', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                      {p.hargaPromo && <span style={{ fontSize: '8px', textDecoration: 'line-through' }}>Rp{p.harga.toLocaleString()}</span>}
                      <div style={{ fontSize: '15px', fontWeight: '900' }}>Rp{(p.hargaPromo || p.harga).toLocaleString()}/<span style={{fontSize:'9px'}}>{p.satuan}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* CSS GLOBAL DAN MEDIA QUERIES */}
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        @media print { 
          .no-print { display: none !important; } 
          body * { visibility: hidden; } 
          #strukArea, #strukArea * { visibility: visible; } 
          #strukArea { position: absolute; left: 50%; top: 0; transform: translateX(-50%); width: 100%; margin: 0 !important; box-shadow: none !important; } 
          #print-area, #print-area * { visibility: visible; } 
          #print-area { position: absolute; left: 0; top: 0; width: 100%; display: grid !important; } 
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #fed7aa; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #FF7835; }
        .nav-btn:active { transform: scale(0.95); opacity: 0.7; }
        @media (max-width: 768px) {
          .header-title { font-size: 16px !important; } 
          .live-clock { display: none !important; }
          .desktop-row-mobile-col { flex-direction: column !important; overflow-y: auto !important; padding-bottom: 20px !important; gap: 8px !important; }
          .dashboard-container { overflow-y: auto !important; display: block !important; }
          .dashboard-bottom-panel { flex-direction: column !important; }
          .dashboard-bottom-panel > div { min-height: 300px !important; flex: none !important; margin-bottom: 16px; }
          .mobile-reverse { flex-direction: column-reverse !important; justify-content: flex-start !important; }
          .kasir-left-panel { height: 35vh !important; flex: none !important; border-bottom: 2px solid #e2e8f0; } 
          .kasir-right-panel { height: auto !important; flex: none !important; }
          .kasir-tools input, .kasir-tools button { padding: 10px 8px !important; font-size: 12px !important; height: 40px !important; box-sizing: border-box !important; }
          .kasir-left-panel .grid-container { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)) !important; gap: 8px !important; }
          .kasir-left-panel .grid-container > div { padding: 10px !important; border-radius: 8px !important; height: 110px !important; }
          .kasir-left-panel .grid-container > div h3 { font-size: 12px !important; height: 28px !important; }
          .kasir-left-panel .grid-container > div .harga-text { font-size: 14px !important; }
          .table-section { min-height: 40vh !important; flex: 1 !important; margin-top: 0 !important; }
          .form-section { height: auto !important; max-height: none !important; overflow-y: visible !important; flex: none !important; margin-bottom: 0 !important; }
          .diet-form .form-title { font-size: 16px !important; margin-bottom: 12px !important; }
          .diet-form .form-label { font-size: 11px !important; margin-bottom: 4px !important; }
          .diet-form .form-input { padding: 8px 10px !important; font-size: 12px !important; margin-bottom: 10px !important; height: 38px !important; }
          .diet-form .form-row { margin-bottom: 10px !important; gap: 8px !important; }
          .diet-form .barcode-row { margin-bottom: 16px !important; }
          .diet-form .form-btn-submit { padding: 10px !important; font-size: 12px !important; height: 40px !important; }
          #reader-kasir, #reader-toko { width: 100% !important; height: 200px !important; border-radius: 8px !important; overflow: hidden !important; border: 2px solid #FF7835 !important; position: relative !important; background: black !important; }
          #reader-kasir video, #reader-toko video { object-fit: cover !important; width: 100% !important; height: 100% !important; position: absolute !important; top: 0 !important; left: 0 !important; }
        }
      `}</style>
    </div>
  );
}

export default App;