import { Injectable } from '@angular/core';
import { Passage, RideScoreData } from '../models/passage.model';
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
    rideScore: RideScoreData | null = null,
    scale = 2
  ): Promise<Blob | null> {
    const padding = 32;
    const rowHeight = 72;
    const headerHeight = 60;
    const summaryHeight = 60;
    const width = 920;
    const footerHeight = 36;

    // Calculate ride score section height
    let scoreBlockHeight = 0;
    if (rideScore && rideScore.score > 0) {
      scoreBlockHeight += 90; // separator + header + score bar
      if (rideScore.warnings.length > 0) scoreBlockHeight += rideScore.warnings.length * 26 + 16;
      scoreBlockHeight += 40; // clothing header
      const clothingRows = Math.ceil(rideScore.clothingItems.length / 3);
      scoreBlockHeight += clothingRows * 32 + 16;
      if (rideScore.tips.length > 0) scoreBlockHeight += rideScore.tips.length * 24 + 32;
      scoreBlockHeight += 30; // bottom spacing
    }

    const height = headerHeight + summaryHeight + passages.length * rowHeight + scoreBlockHeight + padding * 2 + 10 + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);

    // background with subtle gradient effect
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#4F46E5');
    grad.addColorStop(1, '#7C3AED');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, 5);

    // title/date
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 20px system-ui, Arial';
    ctx.fillText(`📅 ${dateLabel}`, padding, padding + 22);

    // summary row
    const summaryY = padding + 38;
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath(); ctx.roundRect(padding, summaryY, width - padding * 2, 38, 8); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = '12px system-ui, Arial';
    ctx.fillText(
      `📏 ${totalDistanceKm} km   ⏱ ${durationText}   🕐 ${departureTime} → ${arrivalTime}   📍 ${cityCount} villes`,
      padding + 12, summaryY + 24
    );

    // Column layout
    const colNum = padding + 8;
    const colCity = padding + 50;
    const colHour = padding + 230;
    const colDayNight = padding + 290;
    const colMeteoStart = padding + 340;
    const colMeteoEnd = width - padding;
    const colMeteoCenter = (colMeteoStart + colMeteoEnd) / 2;

    // header row
    const headerY = summaryY + 48;
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.roundRect(padding, headerY, width - padding * 2, 30, 6); ctx.fill();
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px system-ui, Arial';
    ctx.fillText('#', colNum, headerY + 20);
    ctx.fillText('VILLE', colCity, headerY + 20);
    ctx.fillText('HEURE', colHour, headerY + 20);
    ctx.fillText('', colDayNight, headerY + 20);
    ctx.fillText('MÉTÉO', colMeteoStart + 10, headerY + 20);

    // data rows
    const startY = headerY + 36;
    passages.forEach((p, idx) => {
      const rowTop = startY + idx * rowHeight;
      const textY = rowTop + rowHeight / 2;

      // row background with day/night tint
      if (p.weather?.isDay !== undefined) {
        ctx.fillStyle = p.weather.isDay ? '#fffbeb' : '#eef2ff';
      } else {
        ctx.fillStyle = idx % 2 === 0 ? '#ffffff' : '#f9fafb';
      }
      ctx.fillRect(padding, rowTop, width - padding * 2, rowHeight);

      // subtle row separator
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padding, rowTop + rowHeight);
      ctx.lineTo(width - padding, rowTop + rowHeight);
      ctx.stroke();

      // number badge
      ctx.fillStyle = '#4F46E5';
      ctx.beginPath();
      ctx.arc(colNum + 12, textY, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(String(idx + 1), colNum + 12, textY + 4);
      ctx.textAlign = 'left';

      // city name
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 14px system-ui, Arial';
      ctx.fillText(p.city, colCity, textY - 6);
      // distance under city
      ctx.fillStyle = '#ef4444';
      ctx.font = '11px system-ui, Arial';
      ctx.fillText(`📍 ${p.distanceKm} km`, colCity, textY + 10);

      // time
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 15px system-ui, Arial';
      const hh = String(p.time.getHours()).padStart(2, '0');
      const mm = String(p.time.getMinutes()).padStart(2, '0');
      ctx.fillText(`${hh}:${mm}`, colHour, textY + 2);

      // day/night indicator
      if (p.weather?.isDay !== undefined) {
        const dayLabel = p.weather.isDay ? '☀️ Jour' : '🌙 Nuit';
        ctx.fillStyle = p.weather.isDay ? '#d97706' : '#6366f1';
        ctx.font = '11px system-ui, Arial';
        ctx.fillText(dayLabel, colDayNight, textY + 2);
      }

      // weather block — structured layout in [colMeteoStart .. colMeteoEnd]
      if (p.weather) {
        const desc = getWeatherDescription(p.weather.code);

        // Large emoji
        ctx.font = '30px system-ui, Arial';
        ctx.fillStyle = '#111827';
        ctx.fillText(desc.emoji, colMeteoStart + 8, textY + 6);

        // Temperature (bold, next to emoji)
        ctx.font = 'bold 20px system-ui, Arial';
        ctx.fillStyle = '#111827';
        ctx.fillText(`${p.weather.temperature}°`, colMeteoStart + 52, textY - 2);

        // Apparent temperature
        if (p.weather.apparentTemperature !== undefined) {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '10px system-ui, Arial';
          ctx.fillText(`Ressenti ${p.weather.apparentTemperature}°`, colMeteoStart + 52, textY + 12);
        }

        // Weather description (right-center area)
        const descX = colMeteoCenter + 10;
        ctx.fillStyle = '#374151';
        ctx.font = '12px system-ui, Arial';
        ctx.fillText(desc.desc, descX, textY - 8);

        // Wind info
        ctx.fillStyle = '#64748b';
        ctx.font = '11px system-ui, Arial';
        ctx.fillText(`💨 ${p.weather.wind} km/h`, descX, textY + 6);

        // Rain details
        const precProb = p.weather.precipitationProbability ?? 0;
        const precMm = p.weather.precipitation ?? 0;
        ctx.fillStyle = precProb > 50 ? '#2563eb' : '#64748b';
        ctx.font = '11px system-ui, Arial';
        ctx.fillText(`🌧️ ${precProb}%  ·  ${precMm} mm`, descX, textY + 20);
      }
    });

    // Footer watermark
    const footerY = height - footerHeight;
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, footerY, width, footerHeight);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Meteo Ride — Prévisions générées automatiquement', width / 2, footerY + 22);
    ctx.textAlign = 'left';

    // ── Ride score section ──
    if (rideScore && rideScore.score > 0) {
      let sy = startY + passages.length * rowHeight + 24;

      // Separator line
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, sy);
      ctx.lineTo(width - padding, sy);
      ctx.stroke();
      sy += 22;

      // Score header: emoji + score/100 + label
      ctx.font = '24px system-ui, Arial';
      ctx.fillStyle = '#111827';
      ctx.fillText(rideScore.emoji, padding + 4, sy + 22);
      ctx.font = 'bold 20px system-ui, Arial';
      const scoreColor = rideScore.score >= 70 ? '#16a34a' : rideScore.score >= 40 ? '#f59e0b' : '#ef4444';
      ctx.fillStyle = scoreColor;
      ctx.fillText(`${rideScore.score}/100`, padding + 40, sy + 22);
      ctx.fillStyle = '#374151';
      ctx.font = '15px system-ui, Arial';
      ctx.fillText(`— ${rideScore.label}`, padding + 120, sy + 22);

      // Mini bar
      const barX = padding + 4;
      const barY2 = sy + 36;
      const barW = width - padding * 2 - 8;
      const barH = 10;
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath(); ctx.roundRect(barX, barY2, barW, barH, 5); ctx.fill();
      ctx.fillStyle = scoreColor;
      ctx.beginPath(); ctx.roundRect(barX, barY2, barW * rideScore.score / 100, barH, 5); ctx.fill();
      sy += 60;

      // Warnings
      if (rideScore.warnings.length > 0) {
        rideScore.warnings.forEach(w => {
          ctx.fillStyle = '#dc2626';
          ctx.font = '12px system-ui, Arial';
          ctx.fillText(`⚠️ ${w}`, padding + 8, sy);
          sy += 26;
        });
        sy += 10;
      }

      // Clothing header
      ctx.fillStyle = '#374151';
      ctx.font = 'bold 14px system-ui, Arial';
      ctx.fillText('👕 Tenue recommandée', padding + 4, sy);
      sy += 24;

      // Clothing items as pills (3 per row)
      const pillW = Math.floor((width - padding * 2 - 28) / 3);
      rideScore.clothingItems.forEach((item, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const px = padding + 4 + col * (pillW + 12);
        const py = sy + row * 32;
        ctx.fillStyle = '#f1f5f9';
        ctx.beginPath(); ctx.roundRect(px, py, pillW, 24, 6); ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.font = '12px system-ui, Arial';
        ctx.fillText(`${item.emoji} ${item.label}`, px + 8, py + 16);
      });
      const clothingRows = Math.ceil(rideScore.clothingItems.length / 3);
      sy += clothingRows * 32 + 16;

      // Tips
      if (rideScore.tips.length > 0) {
        ctx.fillStyle = '#374151';
        ctx.font = 'bold 13px system-ui, Arial';
        ctx.fillText('💡 Conseils', padding + 4, sy);
        sy += 22;
        rideScore.tips.forEach(t => {
          ctx.fillStyle = '#64748b';
          ctx.font = '12px system-ui, Arial';
          ctx.fillText(`• ${t}`, padding + 12, sy);
          sy += 24;
        });
      }
    }

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
    cityCount: number,
    rideScore: RideScoreData | null = null
  ): Promise<string> {
    try {
      const blob = await this.renderDataToPngBlob(passages, displayDate, totalDistanceKm, durationText, departureTime, arrivalTime, cityCount, rideScore, 2);
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
    cityCount: number,
    rideScore: RideScoreData | null = null
  ): Promise<string> {
    if (!('canShare' in navigator) && !('share' in navigator)) {
      return 'Partage non supporté par ce navigateur';
    }
    try {
      const blob = await this.renderDataToPngBlob(passages, displayDate, totalDistanceKm, durationText, departureTime, arrivalTime, cityCount, rideScore, 2);
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
