@echo off
chcp 65001 > nul
title Personel Takip ve Finans Yonetim Sistemi

echo ====================================================
echo  PERSONEL TAKIP VE FINANS YONETIM SISTEMI BASLATILIYOR
echo ====================================================
echo.

:: Bagimlilik kontrolu
if not exist node_modules (
    echo [INFO] Bagimliliklar yukleniyor, lutfen bekleyin...
    call npm install
)

:: Tarayiciyi ac (2 saniye sonra)
start "" cmd /c "timeout /t 2 /nobreak > nul & start http://localhost:3000"

echo.
echo ====================================================
echo  SISTEM BASARIYLA CALISIYOR
echo ====================================================
echo  Ana Portal:       http://localhost:3000
echo  Yonetici Paneli:  http://localhost:3000/admin.html
echo  Varsayilan Sifre: admin123
echo ====================================================
echo.
echo Sunucuyu durdurmak icin bu pencereyi kapatabilir veya Ctrl+C yapabilirsiniz.
echo.

:: Sunucuyu baslat
node server.js
pause