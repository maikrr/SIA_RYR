import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './barcode-scanner.html',
  styleUrls: ['./barcode-scanner.scss']
})
export class BarcodeScannerComponent implements AfterViewInit, OnDestroy {
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;
  private platformId = inject(PLATFORM_ID);
  private reader: any;
  private controls?: any;

  async ngAfterViewInit() {
    // ✅ No correr en SSR
    if (!isPlatformBrowser(this.platformId)) return;

    // ✅ Importar ZXing sólo en navegador
    const { BrowserMultiFormatReader } = await import('@zxing/browser');

    this.reader = new BrowserMultiFormatReader();

    const devices = await BrowserMultiFormatReader.listVideoInputDevices();
    const back = devices.find((d: MediaDeviceInfo) => /back|trás|rear|environment/i.test(d.label)) ?? devices[0];

    this.controls = await this.reader.decodeFromVideoDevice(
      back?.deviceId,
      this.videoRef.nativeElement,
      (res: any, _err: unknown, controls: any) => {
        const text = res?.getText?.();
        if (text) { controls?.stop?.(); this.dialogRef.close(text); }
      }
    );
  }

  constructor(private dialogRef: MatDialogRef<BarcodeScannerComponent>) {}
  ngOnDestroy() { this.controls?.stop?.(); }
  close(){ this.dialogRef.close(null); }
}
