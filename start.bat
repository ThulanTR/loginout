@echo off
chcp 65001 >nul
title Personel Takip ve Finans Yonetim Sistemi
echo =======================================================
echo   PERSONEL TAKIP VE FINANS YONETIM SISTEMI
echo =======================================================
echo.
echo Sunucu baslatiliyor... Lutfen bekleyiniz.
echo.

set "PATH=%PATH%;C:\Program Files\nodejs"

REM Tarayıcıda uygulamayı 2 saniye sonra otomatik aç
start "" http://localhost:3000

REM Node.js sunucusunu başlat
node server.js

pause
