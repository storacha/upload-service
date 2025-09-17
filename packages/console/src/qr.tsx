import React, { useRef, forwardRef } from 'react';
import QRCode from 'react-qrcode-logo';

interface StorachaQRCodeProps extends Partial<React.ComponentProps<typeof QRCode>> {
  value: string;
  onDownload?: (format?: 'png' | 'jpeg', filename?: string) => void;
  downloadLabel?: string;
}

export const StorachaQRCode = forwardRef<QRCode, StorachaQRCodeProps>(({
  value,
  size = 256,
  ecLevel = 'H',
  fgColor = '#E91315',
  bgColor = '#ffffff',
  logoImage = '/storacha-standalone.svg',
  logoWidth = 60,
  logoHeight = 60,
  removeQrCodeBehindLogo = true,
  logoPadding = 8,
  logoPaddingStyle = 'circle',
  qrStyle = 'dots',
  eyeRadius = [10, 10, 0, 0],
  enableCORS = true,
  onDownload,
  ...rest
}, ref) => {
  const qrRef = useRef<QRCode>(null);
  return (
    <div className="storacha-qr-container h-full">
      <QRCode
        ref={qrRef}
        value={value}
        size={size}
        ecLevel={ecLevel}
        fgColor={fgColor}
        bgColor={bgColor}
        logoImage={logoImage}
        logoWidth={logoWidth}
        logoHeight={logoHeight}
        removeQrCodeBehindLogo={removeQrCodeBehindLogo}
        logoPadding={logoPadding}
        logoPaddingStyle={logoPaddingStyle}
        qrStyle={qrStyle}
        eyeRadius={eyeRadius}
        enableCORS={enableCORS}
        {...rest}
      />
    </div>
  );
});

StorachaQRCode.displayName = 'StorachaQRCode';
