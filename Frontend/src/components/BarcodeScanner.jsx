import React, { useEffect, useRef } from 'react';
import Quagga from 'quagga';

function BarcodeScanner({ onDetected, onClose }) {
  const scannerRef = useRef(null);

  useEffect(() => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            width: { min: 640 },
            height: { min: 480 },
            facingMode: 'environment', // Fokus menggunakan kamera belakang (jika ada)
          },
        },
        locator: {
          patchSize: 'medium',
          halfSample: true,
        },
        // Agar kinerjanya lebih cepat membaca
        numOfWorkers: navigator.hardwareConcurrency || 2, 
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader', 'upc_e_reader', 'code_128_reader'],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error(err);
          alert("Kamera tidak dapat diakses atau diblokir oleh browser.");
          return;
        }
        Quagga.start();
      }
    );

    Quagga.onDetected((result) => {
      if (result.codeResult && result.codeResult.code) {
        onDetected(result.codeResult.code); 
        Quagga.stop(); 
      }
    });

    return () => {
      Quagga.stop();
    };
  }, [onDetected]);

  return (
    <div className="relative flex flex-col items-center w-full">
      <p className="text-sm text-gray-600 mb-2 font-medium">
        Arahkan barcode produk ke kamera...
      </p>

      {/* Trik Rahasia: Kita tambahkan tag <style> khusus di sini 
        untuk memaksa video dan garis deteksi Quagga menjadi responsif 100% 
      */}
      <style>
        {`
          #scanner-container video {
            width: 100% !important;
            height: auto !important;
            border-radius: 0.5rem;
          }
          #scanner-container canvas.drawingBuffer {
            position: absolute;
            top: 0;
            left: 0;
            width: 100% !important;
            height: auto !important;
          }
        `}
      </style>

      {/* Kotak kamera utama */}
      <div 
        id="scanner-container"
        ref={scannerRef} 
        className="w-full relative bg-black rounded-lg shadow-inner overflow-hidden flex justify-center items-center"
      >
        {/* Quagga otomatis akan memasukkan elemen videonya ke dalam sini */}
      </div>
      
      <button 
        onClick={onClose} 
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition w-full font-medium"
      >
        Batalkan Scan
      </button>
    </div>
  );
}

export default BarcodeScanner;