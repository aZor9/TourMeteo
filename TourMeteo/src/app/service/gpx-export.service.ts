import { Injectable } from '@angular/core';
import { Passage } from '../models/passage.model';
import { getWeatherDescription } from '../utils/weather-utils';

@Injectable({ providedIn: 'root' })
export class GpxExportService {

  /** Render passages data directly to a PNG blob using Canvas (no external lib) */
  async renderDataToPngBlob(
    passages: Passage[],
    dateLabel: string,
    totalDistanceKm: number,
    durationText: string,
    departureTime: string,
    arrivalTime: string,
    cityCount: number,
    scale = 2
  ): Promise<Blob | null> {
    const padding = 28;
    const rowHeight = 64;
    const headerHeight = 60;
    const summaryHeight = 60;
    const width = 860;
    const height = headerHeight + summaryHeight + passages.length * rowHeight + padding * 2 + 10;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);

    // background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // title/date
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 18px system-ui, Arial';
    ctx.fillText(`📅 ${dateLabel}`, padding, padding + 20);

    // summary row
    const summaryY = padding + 35;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padding, summaryY, width - padding * 2, 36);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, Arial';
    ctx.fillText(
      `📏 ${totalDistanceKm} km   ⏱ ${durationText}   🕐 ${departureTime} → ${arrivalTime}   📍 ${cityCount} villes`,
      padding + 8, summaryY + 23
    );

    // Column layout
    const colNum = padding + 8;
    const colCity = padding + 44;
    const colHour = padding + 240;
    const colMeteoStart = padding + 320;
    const colMeteoEnd = width - padding;
    const colMeteoCenter = (colMeteoStart + colMeteoEnd) / 2;

    // header row
    const headerY = summaryY + 44;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(padding, headerY, width - padding * 2, 28);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px system-ui, Arial';
    ctx.fillText('#', colNum, headerY + 18);
    ctx.fillText('VILLE', colCity, headerY + 18);
    ctx.fillText('HEURE', colHour, headerY + 18);
    ctx.fillText('MÉTÉO', colMeteoStart + 10, headerY + 18);

    // data rows
    const startY = headerY + 32;
    passages.forEach((p, idx) => {
      const rowTop = startY + idx * rowHeight;
      const textY = rowTop + rowHeight / 2;

      // row background
      if (p.weather?.isDay !== undefined) {
        ctx.fillStyle = p.weather.isDay ? '#fffbeb' : '#eef2ff';
      } else {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      }
      ctx.fillRect(padding, rowTop, width - padding * 2, rowHeight);

      // border
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padding, rowTop + rowHeight);
      ctx.lineTo(width - padding, rowTop + rowHeight);
      ctx.stroke();

      // number badge
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.arc(colNum + 10, textY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), colNum + 10, textY + 4);
      ctx.textAlign = 'left';

      // city name
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 13px system-ui, Arial';
      ctx.fillText(p.city, colCity, textY - 4);
      // distance under city
      ctx.fillStyle = '#ef4444';
      ctx.font = '11px system-ui, Arial';
      ctx.fillText(`📍 ${p.distanceKm} km`, colCity, textY + 12);

      // time
      ctx.fillStyle = '#374151';
      ctx.font = '14px system-ui, Arial';
      const hh = String(p.time.getHours()).padStart(2, '0');
      const mm = String(p.time.getMinutes()).padStart(2, '0');
      ctx.fillText(`${hh}:${mm}`, colHour, textY + 2);

      // weather — centered in [colMeteoStart .. colMeteoEnd]
      if (p.weather) {
        const desc = getWeatherDescription(p.weather.code);

        // Left part: wind + rain details
        ctx.fillStyle = '#64748b';
        ctx.font = '11px system-ui, Arial';
        const windStr = `💨 ${p.weather.wind} km/h`;
        const rainStr = `🌂 ${p.weather.precipitationProbability ?? 0}% · ${p.weather.precipitation ?? 0} mm`;
        ctx.fillText(`${windStr}  ${rainStr}`, colMeteoStart + 10, textY + 14);

        // Right part: emoji + temp + desc (centered in right half)
        const rightCenter = colMeteoCenter + (colMeteoEnd - colMeteoCenter) / 2;

        ctx.font = '26px system-ui, Arial';
        ctx.fillStyle = '#111827';
        ctx.textAlign = 'center';
        ctx.fillText(desc.emoji, rightCenter - 30, textY + 4);

        ctx.font = 'bold 18px system-ui, Arial';
        ctx.fillText(`${p.weather.temperature}°`, rightCenter + 16, textY - 2);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px system-ui, Arial';
        const apparentStr = p.weather.apparentTemperature !== undefined ? `Ressenti ${p.weather.apparentTemperature}°` : '';
        ctx.fillText(`${apparentStr} · ${desc.desc}`, rightCenter, textY + 16);
        ctx.textAlign = 'left';
      }
    });

    return await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/png'));
  }

  /** Export passages as downloadable PNG file */
  async exportAsImage(
    passages: Passage[],
    displayDate: string,
    totalDistanceKm: number,
    durationText: string,
    departureTime: string,
    arrivalTime: string,
    cityCount: number
  ): Promise<string> {
    try {
      const blob = await this.renderDataToPngBlob(passages, displayDate, totalDistanceKm, durationText, departureTime, arrivalTime, cityCount, 2);
      if (!blob) return 'Échec de génération';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gpx-passages-${displayDate.replace(/\//g, '-')}.png`;
      a.click();
      URL.revokeObjectURL(url);
      return 'Image téléchargée';
    } catch (e: any) {
      console.error('exportAsImage error', e);
      return 'Erreur export: ' + (e?.message || String(e));
    }
  }

  /** Share passages as PNG via Web Share API (fallback to download) */
  async shareImage(
    passages: Passage[],
    displayDate: string,
    totalDistanceKm: number,
    durationText: string,
    departureTime: string,
    arrivalTime: string,
    cityCount: number
  ): Promise<string> {
    if (!('canShare' in navigator) && !('share' in navigator)) {
      return 'Partage non supporté par ce navigateur';
    }
    try {
      const blob = await this.renderDataToPngBlob(passages, displayDate, totalDistanceKm, durationText, departureTime, arrivalTime, cityCount, 2);
      if (!blob) return 'Échec génération';
      const file = new File([blob], `gpx-passages-${displayDate.replace(/\//g, '-')}.png`, { type: 'image/png' });
      // @ts-ignore
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        // @ts-ignore
        await navigator.share({ files: [file], title: 'GPX Passages', text: `Passages ${displayDate}` });
        return 'Partagé';
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
        return 'Partage de fichiers non supporté; téléchargement lancé';
      }
    } catch (e: any) {
      console.error('shareImage error', e);
      return 'Erreur partage: ' + (e?.message || String(e));
    }
  }
}
